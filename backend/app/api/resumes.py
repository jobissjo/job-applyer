import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.resume_job_title import ResumeJobTitle
from app.models.job_title import JobTitlePreference
from app.schemas.resume import ResumeOut, ResumeUpdate
from app.schemas.job_title import JobTitleOut
from app.services.resume_service import ResumeService
from app.utils.security import get_current_user
from app.utils.logger import logger

router = APIRouter(prefix="/resumes", tags=["Resumes"])


@router.get("", response_model=List[ResumeOut])
async def list_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Resume)
        .options(
            selectinload(Resume.job_titles).selectinload(ResumeJobTitle.job_title)
        )
        .where(Resume.user_id == current_user.id)
        .order_by(Resume.created_at.desc())
    )
    res = await db.execute(stmt)
    resumes = list(res.scalars().all())

    out = []
    for r in resumes:
        mapped_titles = [
            JobTitleOut.model_validate(link.job_title)
            for link in r.job_titles
            if link.job_title and link.job_title.user_id == current_user.id
        ]
        r_out = ResumeOut(
            id=r.id,
            user_id=r.user_id,
            title=r.title,
            file_name=r.file_name,
            file_path=r.file_path,
            resume_type=r.resume_type,
            extracted_text=r.extracted_text,
            active=r.active,
            created_at=r.created_at,
            updated_at=r.updated_at,
            mapped_job_titles=mapped_titles
        )
        out.append(r_out)
    return out


@router.post("", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    title: str = Form(...),
    job_title_ids: Optional[str] = Form(None),  # e.g. "1,2,3"
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    parsed_title_ids = []
    if job_title_ids:
        for part in job_title_ids.split(","):
            if part.strip().isdigit():
                parsed_title_ids.append(int(part.strip()))

    resume = await ResumeService.save_and_extract_resume(
        user_id=current_user.id,
        title=title.strip(),
        upload_file=file,
        db=db,
        job_title_ids=parsed_title_ids
    )

    # Reload with associations
    return await get_resume_by_id(resume.id, current_user, db)


@router.get("/{resume_id}", response_model=ResumeOut)
async def get_resume_by_id(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Resume)
        .options(
            selectinload(Resume.job_titles).selectinload(ResumeJobTitle.job_title)
        )
        .where(Resume.id == resume_id, Resume.user_id == current_user.id)
        .execution_options(populate_existing=True)
    )
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()

    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    mapped_titles = [
        JobTitleOut.model_validate(link.job_title)
        for link in resume.job_titles
        if link.job_title and link.job_title.user_id == current_user.id
    ]
    return ResumeOut(
        id=resume.id,
        user_id=resume.user_id,
        title=resume.title,
        file_name=resume.file_name,
        file_path=resume.file_path,
        resume_type=resume.resume_type,
        extracted_text=resume.extracted_text,
        active=resume.active,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
        mapped_job_titles=mapped_titles
    )


@router.put("/{resume_id}", response_model=ResumeOut)
async def update_resume(
    resume_id: int,
    payload: ResumeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()

    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    # Reject invalid mappings before mutating any fields.
    if payload.job_title_ids is not None:
        await ResumeService.validate_mappings(current_user.id, payload.job_title_ids, db)

    if payload.title is not None:
        resume.title = payload.title.strip()
    if payload.active is not None:
        resume.active = payload.active

    if payload.job_title_ids is not None:
        await ResumeService.update_mappings(resume_id, payload.job_title_ids, db)

    await db.commit()
    return await get_resume_by_id(resume_id, current_user, db)


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()

    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    # Remove physical file if exists
    if os.path.exists(resume.file_path):
        try:
            os.remove(resume.file_path)
        except Exception as e:
            logger.warning(f"Could not delete file {resume.file_path}: {e}")

    await db.delete(resume)
    await db.commit()
    return None


@router.get("/{resume_id}/download")
async def download_resume(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()

    if not resume or not os.path.exists(resume.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume file not found")

    return FileResponse(
        path=resume.file_path,
        filename=resume.file_name,
        media_type="application/octet-stream"
    )
