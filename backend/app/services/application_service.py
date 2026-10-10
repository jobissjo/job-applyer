import json
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.profile import UserProfile
from app.models.job import Job
from app.models.job_title import JobTitlePreference
from app.models.resume import Resume
from app.models.hr_contact import HRContact
from app.models.cover_letter import CoverLetter
from app.models.application import Application
from app.models.email_settings import EmailSettings
from app.services.llm.manager import LLMManager
from app.services.llm.prompts.job_matching import JOB_MATCHING_SYSTEM_PROMPT, format_job_matching_prompt
from app.services.llm.prompts.cover_letter import COVER_LETTER_SYSTEM_PROMPT, format_cover_letter_prompt
from app.services.resume_service import ResumeService
from app.services.email_service import EmailService
from app.services.job_access import get_accessible_job
from app.schemas.job import JobAnalyzeResponse
from app.utils.logger import logger


class ApplicationService:

    @staticmethod
    async def save_reviewed_cover_letter(
        user_id: int,
        job_id: int,
        content: str,
        resume_id: Optional[int],
        db: AsyncSession
    ) -> CoverLetter:
        job = await get_accessible_job(job_id, user_id, db)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if resume_id is not None:
            resume = await db.get(Resume, resume_id)
            if not resume or resume.user_id != user_id:
                raise HTTPException(status_code=404, detail="Resume not found")
        letter = CoverLetter(
            user_id=user_id,
            job_id=job_id,
            job_title=job.title,
            resume_id=resume_id,
            content=content
        )
        db.add(letter)
        await db.flush()
        return letter

    @staticmethod
    async def analyze_job(user_id: int, job_id: int, db: AsyncSession) -> JobAnalyzeResponse:
        # 1. Fetch Job
        job = await get_accessible_job(job_id, user_id, db)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

        # 2. Fetch User Profile
        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        res_prof = await db.execute(stmt_prof)
        profile = res_prof.scalar_one_or_none()

        profile_summary = ""
        if profile:
            profile_summary = (
                f"Candidate: {profile.name}, Experience: {profile.years_of_experience or 0} yrs. "
                f"Current: {profile.current_company or 'N/A'}. Location: {profile.location or 'N/A'}. "
                f"Details: {profile.additional_details or ''}"
            )

        # 3. Fetch User Active Job Title Preferences
        stmt_titles = select(JobTitlePreference).where(
            JobTitlePreference.user_id == user_id,
            JobTitlePreference.active == True
        )
        res_titles = await db.execute(stmt_titles)
        user_titles = list(res_titles.scalars().all())

        if not user_titles:
            return JobAnalyzeResponse(
                matched=False,
                match_score=0,
                reason="You have not configured any active job titles yet. Please add job titles in Job Titles preferences.",
                has_hr_contact=bool(job.contact_email),
                hr_email=job.contact_email
            )

        title_strings = [t.title for t in user_titles]

        # 4. Prompt LLM with failover
        user_prompt = format_job_matching_prompt(
            candidate_titles=title_strings,
            job_title=job.title,
            job_company=job.company,
            job_description=f"{job.description or ''}\n\nRequirements: {job.requirements or ''}",
            user_profile_summary=profile_summary
        )

        llm_raw_response = await LLMManager.generate_with_failover(
            user_id=user_id,
            prompt=user_prompt,
            system_instruction=JOB_MATCHING_SYSTEM_PROMPT,
            json_mode=True,
            db=db
        )

        try:
            parsed = json.loads(llm_raw_response)
        except Exception:
            # Clean possible markdown wrapping ```json ... ```
            cleaned = llm_raw_response.strip()
            if "```" in cleaned:
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
                cleaned = cleaned.strip()
            try:
                parsed = json.loads(cleaned)
            except Exception as e:
                logger.error(f"Failed to parse LLM matching output: {llm_raw_response}")
                parsed = {
                    "matched": False,
                    "job_title": None,
                    "match_score": 0,
                    "reason": f"Could not parse LLM output: {str(e)}"
                }

        matched = parsed.get("matched", False)
        matched_title_str = parsed.get("job_title")
        match_score = parsed.get("match_score", 0)
        reason = parsed.get("reason", "")

        matched_title_obj = None
        if matched and matched_title_str:
            for t in user_titles:
                if t.title.lower() == matched_title_str.lower():
                    matched_title_obj = t
                    break

        recommended_resume = None
        if matched_title_obj:
            recommended_resume = await ResumeService.get_mapped_resume_for_title(
                user_id=user_id,
                job_title_id=matched_title_obj.id,
                db=db
            )

        # Check HR Contact: either on job or in user HR contacts
        stmt_hr = select(HRContact).where(HRContact.user_id == user_id, HRContact.job_id == job_id)
        res_hr = await db.execute(stmt_hr)
        user_hr = res_hr.scalars().first()
        effective_email = user_hr.email if user_hr else job.contact_email

        return JobAnalyzeResponse(
            matched=matched,
            job_title=matched_title_obj.title if matched_title_obj else None,
            job_title_id=matched_title_obj.id if matched_title_obj else None,
            match_score=match_score,
            reason=reason,
            recommended_resume_id=recommended_resume.id if recommended_resume else None,
            recommended_resume_title=recommended_resume.title if recommended_resume else None,
            has_hr_contact=bool(effective_email),
            hr_email=effective_email
        )

    @staticmethod
    async def generate_cover_letter(
        user_id: int,
        job_id: int,
        job_title_id: Optional[int] = None,
        resume_id: Optional[int] = None,
        custom_instructions: Optional[str] = None,
        db: Optional[AsyncSession] = None
    ) -> CoverLetter:
        job = await get_accessible_job(job_id, user_id, db)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

        # Fetch profile
        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        res_prof = await db.execute(stmt_prof)
        profile = res_prof.scalar_one_or_none()
        profile_dict = {
            "name": profile.name if profile else "Applicant",
            "current_company": profile.current_company if profile else None,
            "years_of_experience": profile.years_of_experience if profile else None,
            "location": profile.location if profile else None,
            "notice_period": profile.notice_period if profile else None,
            "additional_details": profile.additional_details if profile else None,
        }

        # Resolve job title
        target_title_str = job.title
        if job_title_id:
            title_obj = await db.get(JobTitlePreference, job_title_id)
            if title_obj and title_obj.user_id == user_id:
                target_title_str = title_obj.title

        # Resolve resume
        resume_text = ""
        if resume_id:
            res_obj = await db.get(Resume, resume_id)
            if res_obj and res_obj.user_id == user_id and res_obj.extracted_text:
                resume_text = res_obj.extracted_text

        prompt = format_cover_letter_prompt(
            candidate_profile=profile_dict,
            target_job_title=target_title_str,
            job_company=job.company,
            job_description=f"{job.description or ''}\n{job.requirements or ''}",
            resume_text=resume_text,
            custom_instructions=custom_instructions or ""
        )

        content = await LLMManager.generate_with_failover(
            user_id=user_id,
            prompt=prompt,
            system_instruction=COVER_LETTER_SYSTEM_PROMPT,
            json_mode=False,
            db=db
        )

        # Save CoverLetter
        cover_letter = CoverLetter(
            user_id=user_id,
            job_id=job_id,
            job_title=target_title_str,
            resume_id=resume_id,
            content=content.strip()
        )
        db.add(cover_letter)
        await db.commit()
        await db.refresh(cover_letter)
        return cover_letter

    @staticmethod
    async def prepare_or_update_application(
        user_id: int,
        job_id: int,
        resume_id: Optional[int] = None,
        cover_letter_id: Optional[int] = None,
        hr_contact_id: Optional[int] = None,
        email_subject: Optional[str] = None,
        notes: Optional[str] = None,
        db: Optional[AsyncSession] = None
    ) -> Application:
        job = await get_accessible_job(job_id, user_id, db)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

        # Application attachments and contacts must belong to this user and job.
        if resume_id is not None:
            resume = await db.get(Resume, resume_id)
            if not resume or resume.user_id != user_id:
                raise HTTPException(status_code=404, detail="Resume not found")
        if cover_letter_id is not None:
            letter = await db.get(CoverLetter, cover_letter_id)
            if not letter or letter.user_id != user_id or letter.job_id != job_id:
                raise HTTPException(status_code=404, detail="Cover letter not found")
        if hr_contact_id is not None:
            contact = await db.get(HRContact, hr_contact_id)
            if not contact or contact.user_id != user_id or contact.job_id != job_id:
                raise HTTPException(status_code=404, detail="HR contact not found")

        # Verify HR contact availability
        effective_email = None
        if hr_contact_id:
            hr_obj = await db.get(HRContact, hr_contact_id)
            if hr_obj and hr_obj.user_id == user_id:
                effective_email = hr_obj.email
        else:
            # Check user-saved HR contact
            stmt_hr = select(HRContact).where(HRContact.user_id == user_id, HRContact.job_id == job_id)
            res_hr = await db.execute(stmt_hr)
            user_hr = res_hr.scalars().first()
            if user_hr:
                effective_email = user_hr.email
                hr_contact_id = user_hr.id
            elif job.contact_email:
                effective_email = job.contact_email

        # Determine status strictly:
        # If no HR contact email found -> hr_contact_required
        # If HR contact email found -> ready
        initial_status = "ready" if effective_email else "hr_contact_required"

        # Check existing application for this user and job
        stmt_app = (
            select(Application)
            .where(Application.user_id == user_id, Application.job_id == job_id)
        )
        res_app = await db.execute(stmt_app)
        application = res_app.scalars().first()
        if application and application.status in ("scheduled", "sending"):
            raise HTTPException(status_code=409, detail="Cancel the schedule before editing")

        # Generate default subject if not provided
        if not email_subject:
            candidate_name = "Candidate"
            stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
            res_prof = await db.execute(stmt_prof)
            prof = res_prof.scalars().first()
            if prof and prof.name:
                candidate_name = prof.name
            email_subject = f"Application for {job.title} - {candidate_name}"

        if not application:
            application = Application(
                user_id=user_id,
                job_id=job_id,
                resume_id=resume_id,
                cover_letter_id=cover_letter_id,
                hr_contact_id=hr_contact_id,
                status=initial_status,
                email_subject=email_subject,
                notes=notes
            )
            db.add(application)
        else:
            if resume_id is not None:
                application.resume_id = resume_id
            if cover_letter_id is not None:
                application.cover_letter_id = cover_letter_id
            if hr_contact_id is not None:
                application.hr_contact_id = hr_contact_id
            if email_subject:
                application.email_subject = email_subject
            if notes is not None:
                application.notes = notes
            # If previously hr_contact_required and now has email, move to ready
            if application.status == "hr_contact_required" and effective_email:
                application.status = "ready"
            elif not effective_email and application.status != "sent":
                application.status = "hr_contact_required"

        await db.commit()
        await db.refresh(application)
        return application

    @staticmethod
    async def get_candidate_name(user_id: int, db: AsyncSession) -> str:
        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        res_prof = await db.execute(stmt_prof)
        profile = res_prof.scalar_one_or_none()
        if profile and profile.name and profile.name.strip():
            return profile.name.strip()

        stmt_user = select(User).where(User.id == user_id)
        res_user = await db.execute(stmt_user)
        user_obj = res_user.scalar_one_or_none()
        if user_obj and user_obj.email:
            prefix = user_obj.email.split("@")[0]
            return prefix.capitalize()
        return "Jobi"

    @staticmethod
    def get_formatted_attachment_name(candidate_name: str, job_title: str, file_path_or_ext: str = ".pdf") -> str:
        safe_candidate = re.sub(r'[\\/*?:"<>|]', '', candidate_name).strip() if candidate_name else "Jobi"
        safe_candidate = re.sub(r'\s+', ' ', safe_candidate)
        safe_title = re.sub(r'[\\/*?:"<>|]', '-', job_title).strip() if job_title else "Position"
        safe_title = re.sub(r'\s+', ' ', safe_title)

        ext = Path(file_path_or_ext).suffix if "." in file_path_or_ext else f".{file_path_or_ext}"
        if not ext:
            ext = ".pdf"

        return f"{safe_candidate}_({safe_title}){ext}"

    @staticmethod
    async def send_application(
        user_id: int,
        application_id: int,
        db: AsyncSession,
        scheduled_dispatch: bool = False,
    ) -> Application:
        stmt = (
            select(Application)
            .options(
                selectinload(Application.job),
                selectinload(Application.resume),
                selectinload(Application.cover_letter),
                selectinload(Application.hr_contact)
            )
            .where(Application.id == application_id, Application.user_id == user_id)
        )
        res = await db.execute(stmt)
        application = res.scalar_one_or_none()

        if not application:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

        if application.status in ("scheduled", "sending") and not scheduled_dispatch:
            raise HTTPException(status_code=409, detail="Cancel the schedule before sending immediately")

        # Safety Check 1: Must not be already sent
        if application.status == "sent":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application has already been sent.")

        # Safety Check 2: Mandatory HR Contact verification
        recipient_email = None
        if application.hr_contact and application.hr_contact.email:
            recipient_email = application.hr_contact.email
        elif application.job and application.job.contact_email:
            recipient_email = application.job.contact_email

        if not recipient_email:
            application.status = "hr_contact_required"
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send application: No HR contact email found. This job requires manual HR contact entry."
            )

        # Safety Check 3: Check Email Settings
        stmt_smtp = select(EmailSettings).where(EmailSettings.user_id == user_id)
        res_smtp = await db.execute(stmt_smtp)
        smtp_settings = res_smtp.scalar_one_or_none()

        if not smtp_settings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMTP settings not configured. Please configure your SMTP credentials before sending."
            )

        # Extract Cover Letter content
        cover_letter_text = application.cover_letter.content if application.cover_letter else "Dear Hiring Manager,\nPlease find attached my resume for your consideration.\n\nBest regards."
        
        # Determine candidate name and formatted attachment filename
        candidate_name = await ApplicationService.get_candidate_name(user_id, db)
        job_title = application.job.title if application.job and application.job.title else "Job"
        
        resume_path = application.resume.file_path if application.resume else None
        if scheduled_dispatch and application.resume and (not resume_path or not Path(resume_path).is_file()):
            raise HTTPException(status_code=400, detail="Scheduled resume attachment is unavailable")
        attachment_filename = None
        if resume_path:
            attachment_filename = ApplicationService.get_formatted_attachment_name(
                candidate_name=candidate_name,
                job_title=job_title,
                file_path_or_ext=resume_path
            )

        subject = application.email_subject or f"Application for {job_title} - {candidate_name}"

        # Send via EmailService
        success, msg = await EmailService.send_application_email(
            settings=smtp_settings,
            to_email=recipient_email,
            subject=subject,
            cover_letter_text=cover_letter_text,
            resume_path=resume_path,
            attachment_filename=attachment_filename
        )

        if success:
            application.status = "sent"
            application.sent_to = recipient_email
            application.sent_at = datetime.now(timezone.utc)
            application.notes = msg
        else:
            application.status = "failed"
            application.notes = msg

        await db.commit()
        await db.refresh(application)
        return application
