from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.job_title import JobTitlePreference
from app.schemas.job_title import JobTitleCreate, JobTitleUpdate, JobTitleOut
from app.utils.security import get_current_user

router = APIRouter(prefix="/job-titles", tags=["Job Title Preferences"])


@router.get("", response_model=List[JobTitleOut])
async def list_job_titles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(JobTitlePreference)
        .where(JobTitlePreference.user_id == current_user.id)
        .order_by(JobTitlePreference.created_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("", response_model=JobTitleOut, status_code=status.HTTP_201_CREATED)
async def create_job_title(
    payload: JobTitleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    job_title = JobTitlePreference(
        user_id=current_user.id,
        title=payload.title.strip(),
        active=payload.active
    )
    db.add(job_title)
    await db.commit()
    await db.refresh(job_title)
    return job_title


@router.put("/{title_id}", response_model=JobTitleOut)
async def update_job_title(
    title_id: int,
    payload: JobTitleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(JobTitlePreference).where(
        JobTitlePreference.id == title_id,
        JobTitlePreference.user_id == current_user.id
    )
    res = await db.execute(stmt)
    job_title = res.scalar_one_or_none()

    if not job_title:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job title not found")

    if payload.title is not None:
        job_title.title = payload.title.strip()
    if payload.active is not None:
        job_title.active = payload.active

    await db.commit()
    await db.refresh(job_title)
    return job_title


@router.delete("/{title_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_title(
    title_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(JobTitlePreference).where(
        JobTitlePreference.id == title_id,
        JobTitlePreference.user_id == current_user.id
    )
    res = await db.execute(stmt)
    job_title = res.scalar_one_or_none()

    if not job_title:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job title not found")

    await db.delete(job_title)
    await db.commit()
    return None
