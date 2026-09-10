from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.profile import UserProfile
from app.models.job import Job
from app.models.job_title import JobTitlePreference
from app.models.resume import Resume
from app.models.email_settings import EmailSettings
from app.models.application import Application
from app.services.scraper.technopark import TechnoparkScraper
from app.services.scraper.infopark import InfoparkScraper
from app.services.resume_service import ResumeService
from app.services.application_service import ApplicationService
from app.services.email_service import EmailService
from scripts.scraper_utils import upsert_scraped_jobs
from app.utils.logger import logger


class AutoApplyService:
    @staticmethod
    async def run_pipeline(
        user_id: int,
        source: str = "technopark",
        query: str = "python",
        page: int = 1,
        limit: int = 5,
        db: Optional[AsyncSession] = None
    ) -> Dict[str, Any]:
        if not db:
            raise ValueError("Database session is required")

        logger.info(f"[AutoApplyPipeline] Starting for user_id={user_id}, source={source}, query='{query}', limit={limit}")

        # 1. Fetch User & Profile
        user = await db.get(User, user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        res_prof = await db.execute(stmt_prof)
        profile = res_prof.scalar_one_or_none()
        profile_data = {
            "name": profile.name if profile and profile.name else user.email.split("@")[0],
            "email": user.email,
            "phone": profile.phone if profile else None,
            "current_company": profile.current_company if profile else None,
            "years_of_experience": profile.years_of_experience if profile else 3.0,
            "location": profile.location if profile else "Kerala, India",
            "notice_period": profile.notice_period if profile else "Immediate",
            "linkedin_url": profile.linkedin_url if profile else None,
            "github_url": profile.github_url if profile else None,
            "portfolio_url": profile.portfolio_url if profile else None,
            "additional_details": profile.additional_details if profile else None,
        }

        # 2. Ensure User has at least one active job title preference matching the query
        stmt_titles = select(JobTitlePreference).where(
            JobTitlePreference.user_id == user_id,
            JobTitlePreference.active == True
        )
        res_titles = await db.execute(stmt_titles)
        user_titles = list(res_titles.scalars().all())

        if not user_titles:
            # Auto-create matching title preference for convenience
            default_title = f"{query.capitalize()} Developer"
            new_pref = JobTitlePreference(user_id=user_id, title=default_title, active=True)
            db.add(new_pref)
            await db.commit()
            user_titles = [new_pref]
            logger.info(f"[AutoApplyPipeline] Auto-configured job title preference: {default_title}")

        # 3. Choose Scraper and Fetch Live Jobs
        scraper = TechnoparkScraper() if source.lower() == "technopark" else InfoparkScraper()
        scraped_jobs = await scraper.search(query=query, page=page, limit=limit)
        logger.info(f"[AutoApplyPipeline] Scraped {len(scraped_jobs)} jobs from {source}")

        # 4. Upsert Scraped Jobs into DB
        await upsert_scraped_jobs(scraped_jobs)

        # 5. Process each job through the match -> resume -> cover letter -> apply pipeline
        results: List[Dict[str, Any]] = []
        applied_count = 0
        ready_count = 0
        hr_required_count = 0

        # Check if user has SMTP configured
        stmt_smtp = select(EmailSettings).where(EmailSettings.user_id == user_id)
        res_smtp = await db.execute(stmt_smtp)
        smtp_configured = bool(res_smtp.scalar_one_or_none())

        for sj in scraped_jobs:
            stmt_job = select(Job).where(Job.source == sj.source, Job.source_job_id == sj.source_job_id)
            res_job = await db.execute(stmt_job)
            db_job = res_job.scalar_one_or_none()
            if not db_job:
                continue

            job_log = {
                "job_id": db_job.id,
                "title": db_job.title,
                "company": db_job.company,
                "hr_email": db_job.contact_email,
                "matched_title": None,
                "resume_used": None,
                "status": "pending",
                "message": ""
            }

            try:
                # Step A: Match job against user job titles
                match_res = await ApplicationService.analyze_job(user_id=user_id, job_id=db_job.id, db=db)
                matched_title_str = match_res.job_title or user_titles[0].title
                job_log["matched_title"] = matched_title_str

                # Step B: Check or Synthesize Resume
                resume = None
                if match_res.recommended_resume_id:
                    resume = await db.get(Resume, match_res.recommended_resume_id)

                if not resume:
                    # Look up any active resume for user
                    stmt_res = select(Resume).where(Resume.user_id == user_id, Resume.active == True).order_by(Resume.created_at.desc())
                    r_res = await db.execute(stmt_res)
                    resume = r_res.scalar_one_or_none()

                if not resume:
                    # Synthesize resume document automatically
                    target_title_id = match_res.job_title_id or user_titles[0].id
                    resume = await ResumeService.create_synthesized_resume(
                        user_id=user_id,
                        job_title=matched_title_str,
                        profile_data=profile_data,
                        db=db,
                        job_title_id=target_title_id
                    )

                job_log["resume_used"] = resume.file_name if resume else "None"

                # Step C: Generate tailored cover letter
                cl = await ApplicationService.generate_cover_letter(
                    user_id=user_id,
                    job_id=db_job.id,
                    job_title_id=match_res.job_title_id or user_titles[0].id,
                    resume_id=resume.id if resume else None,
                    db=db
                )

                # Step D: Prepare Application
                email_subject = f"Application for {db_job.title} - {profile_data['name']}"
                app = await ApplicationService.prepare_or_update_application(
                    user_id=user_id,
                    job_id=db_job.id,
                    resume_id=resume.id if resume else None,
                    cover_letter_id=cl.id,
                    email_subject=email_subject,
                    db=db
                )

                # Step E: Apply / Send if HR contact exists
                if app.status == "ready" or db_job.contact_email:
                    if smtp_configured:
                        try:
                            sent_app = await ApplicationService.send_application(
                                user_id=user_id,
                                application_id=app.id,
                                db=db
                            )
                            job_log["status"] = sent_app.status
                            job_log["message"] = f"Application successfully sent to {sent_app.sent_to}"
                            applied_count += 1
                        except Exception as send_err:
                            job_log["status"] = "ready"
                            job_log["message"] = f"Application ready to send (SMTP dispatch attempted: {send_err})"
                            ready_count += 1
                    else:
                        job_log["status"] = "ready"
                        job_log["message"] = f"Application prepared & ready for {db_job.contact_email} (Configure SMTP in settings to dispatch emails)"
                        ready_count += 1
                else:
                    job_log["status"] = "hr_contact_required"
                    job_log["message"] = "Job listing missing recruiter email. Added to HR Contacts Required."
                    hr_required_count += 1

            except Exception as e:
                logger.error(f"[AutoApplyPipeline] Error processing job {db_job.id}: {e}")
                job_log["status"] = "error"
                job_log["message"] = str(e)

            results.append(job_log)

        return {
            "source": source,
            "query": query,
            "total_processed": len(results),
            "applied_count": applied_count,
            "ready_count": ready_count,
            "hr_required_count": hr_required_count,
            "jobs": results
        }
