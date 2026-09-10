import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, List
from fastapi import UploadFile
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pypdf import PdfReader
from docx import Document

from app.config import settings
from app.models.resume import Resume
from app.models.resume_job_title import ResumeJobTitle
from app.models.job_title import JobTitlePreference
from app.utils.logger import logger


class ResumeService:
    @staticmethod
    def extract_text_from_file(file_path: Path, ext: str) -> str:
        text = ""
        try:
            if ext == "pdf":
                reader = PdfReader(str(file_path))
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
            elif ext in ["docx", "doc"]:
                doc = Document(str(file_path))
                for para in doc.paragraphs:
                    if para.text:
                        text += para.text + "\n"
        except Exception as e:
            logger.warning(f"Error extracting text from {file_path}: {e}")
        return text.strip()

    @staticmethod
    async def save_and_extract_resume(
        user_id: int,
        title: str,
        upload_file: UploadFile,
        db: AsyncSession,
        job_title_ids: Optional[List[int]] = None
    ) -> Resume:
        filename = upload_file.filename or "resume.pdf"
        ext = filename.split(".")[-1].lower() if "." in filename else "pdf"
        if ext not in ["pdf", "docx", "doc"]:
            ext = "pdf"

        # Unique safe filename on disk
        unique_filename = f"user_{user_id}_{uuid.uuid4().hex[:10]}.{ext}"
        target_path = settings.RESUME_DIR / unique_filename

        # Write uploaded file
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)

        # Extract text
        extracted_text = ResumeService.extract_text_from_file(target_path, ext)

        resume = Resume(
            user_id=user_id,
            title=title or filename,
            file_name=filename,
            file_path=str(target_path),
            resume_type=ext,
            extracted_text=extracted_text,
            active=True
        )
        db.add(resume)
        await db.flush()

        if job_title_ids:
            for jid in job_title_ids:
                link = ResumeJobTitle(resume_id=resume.id, job_title_id=jid)
                db.add(link)

        await db.commit()
        await db.refresh(resume)
        return resume

    @staticmethod
    async def update_mappings(
        resume_id: int,
        job_title_ids: List[int],
        db: AsyncSession
    ):
        # Remove existing links
        await db.execute(
            delete(ResumeJobTitle).where(ResumeJobTitle.resume_id == resume_id)
        )
        for jid in job_title_ids:
            link = ResumeJobTitle(resume_id=resume_id, job_title_id=jid)
            db.add(link)
        await db.commit()

    @staticmethod
    async def get_mapped_resume_for_title(
        user_id: int,
        job_title_id: int,
        db: AsyncSession
    ) -> Optional[Resume]:
        stmt = (
            select(Resume)
            .join(ResumeJobTitle, Resume.id == ResumeJobTitle.resume_id)
            .where(
                Resume.user_id == user_id,
                Resume.active == True,
                ResumeJobTitle.job_title_id == job_title_id
            )
            .order_by(Resume.created_at.desc())
        )
        result = await db.execute(stmt)
        matched_resume = result.scalar_one_or_none()

        if not matched_resume:
            # Fallback to the user's latest active resume
            stmt_latest = (
                select(Resume)
                .where(Resume.user_id == user_id, Resume.active == True)
                .order_by(Resume.created_at.desc())
            )
            res_latest = await db.execute(stmt_latest)
            matched_resume = res_latest.scalar_one_or_none()

        return matched_resume

    @staticmethod
    async def create_synthesized_resume(
        user_id: int,
        job_title: str,
        profile_data: dict,
        db: AsyncSession,
        job_title_id: Optional[int] = None
    ) -> Resume:
        """
        Synthesizes a tailored DOCX resume from candidate profile and matched job title
        when no pre-existing resume was found.
        """
        doc = Document()
        name = profile_data.get("name") or "Candidate"
        doc.add_heading(name, level=0)

        # Contact Info
        contact_parts = []
        if profile_data.get("email"):
            contact_parts.append(profile_data["email"])
        if profile_data.get("phone"):
            contact_parts.append(profile_data["phone"])
        if profile_data.get("location"):
            contact_parts.append(profile_data["location"])
        if contact_parts:
            doc.add_paragraph(" | ".join(contact_parts))

        # Online Profiles
        links = []
        if profile_data.get("linkedin_url"):
            links.append(f"LinkedIn: {profile_data['linkedin_url']}")
        if profile_data.get("github_url"):
            links.append(f"GitHub: {profile_data['github_url']}")
        if profile_data.get("portfolio_url"):
            links.append(f"Portfolio: {profile_data['portfolio_url']}")
        if links:
            doc.add_paragraph(" • ".join(links))

        doc.add_heading("Target Role & Professional Summary", level=1)
        summary_text = (
            f"Passionate {job_title} with proven expertise in building modern, scalable software solutions. "
        )
        if profile_data.get("years_of_experience"):
            summary_text += f"Bringing {profile_data['years_of_experience']} years of industry experience. "
        if profile_data.get("current_company"):
            summary_text += f"Currently contributing at {profile_data['current_company']}. "
        if profile_data.get("additional_details"):
            summary_text += f"{profile_data['additional_details']} "

        doc.add_paragraph(summary_text)

        doc.add_heading("Core Technical Competencies", level=1)
        skills_p = doc.add_paragraph()
        skills_p.add_run(f"Specialization: {job_title}\n")
        skills_p.add_run("Backend & Web Technologies: Python, FastAPI, Django, REST APIs, Asynchronous Programming\n")
        skills_p.add_run("Database & Infrastructure: PostgreSQL, SQLite, SQLAlchemy ORM, Git, CI/CD")

        doc.add_heading("Experience & Projects", level=1)
        exp_p = doc.add_paragraph()
        company_name = profile_data.get("current_company") or "Software Engineering"
        exp_p.add_run(f"{job_title} | {company_name}\n").bold = True
        doc.add_paragraph("• Architected, developed, and maintained robust backend services and REST APIs.")
        doc.add_paragraph("• Collaborated with cross-functional engineering teams to implement high-impact features.")
        doc.add_paragraph("• Adhered to clean code principles, automated testing, and agile release practices.")

        # Save DOCX
        filename = f"{name.replace(' ', '_')}_{job_title.replace(' ', '_')}_Resume.docx"
        unique_name = f"user_{user_id}_{uuid.uuid4().hex[:10]}.docx"
        target_path = settings.RESUME_DIR / unique_name
        doc.save(str(target_path))

        extracted_text = ResumeService.extract_text_from_file(target_path, "docx")

        resume = Resume(
            user_id=user_id,
            title=f"Synthesized {job_title} Resume",
            file_name=filename,
            file_path=str(target_path),
            resume_type="docx",
            extracted_text=extracted_text,
            active=True
        )
        db.add(resume)
        await db.flush()

        if job_title_id:
            link = ResumeJobTitle(resume_id=resume.id, job_title_id=job_title_id)
            db.add(link)

        await db.commit()
        await db.refresh(resume)
        logger.info(f"[ResumeService] Synthesized resume created: {filename} (id={resume.id})")
        return resume

