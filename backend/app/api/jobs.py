from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.job import Job
from app.models.manual_job import ManualJobOwnership
from app.models.application import Application
from app.models.hr_contact import HRContact
from app.schemas.job import JobOut, JobPaginationResponse, JobAnalyzeResponse, ManualJobCreate
from app.schemas.cover_letter import CoverLetterOut, CoverLetterGenerateRequest
from app.services.application_service import ApplicationService
from app.services.job_access import get_accessible_job, visible_jobs
from app.utils.security import get_current_user

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("", response_model=JobPaginationResponse)
async def list_jobs(
    query: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    base_filter = [visible_jobs(current_user.id)]
    if source:
        base_filter.append(Job.source == source.lower().strip())
    if query:
        search_pattern = f"%{query.strip()}%"
        base_filter.append(
            or_(
                Job.title.ilike(search_pattern),
                Job.company.ilike(search_pattern),
                Job.description.ilike(search_pattern),
                Job.requirements.ilike(search_pattern),
            )
        )

    # Count total
    count_stmt = select(func.count(Job.id))
    if base_filter:
        count_stmt = count_stmt.where(*base_filter)
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    # Query items with pagination
    offset = (page - 1) * limit
    stmt = (
        select(Job)
        .order_by(Job.scraped_at.desc(), Job.id.desc())
        .offset(offset)
        .limit(limit)
    )
    if base_filter:
        stmt = stmt.where(*base_filter)

    items_res = await db.execute(stmt)
    jobs = list(items_res.scalars().all())

    # Get application status for these jobs for current user
    job_ids = [j.id for j in jobs]
    user_apps = {}
    if job_ids:
        app_stmt = select(Application).where(
            Application.user_id == current_user.id,
            Application.job_id.in_(job_ids)
        )
        app_res = await db.execute(app_stmt)
        for app in app_res.scalars().all():
            user_apps[app.job_id] = app.status

    # Get user HR contacts for these jobs
    user_hrs = {}
    if job_ids:
        hr_stmt = select(HRContact).where(
            HRContact.user_id == current_user.id,
            HRContact.job_id.in_(job_ids)
        )
        hr_res = await db.execute(hr_stmt)
        for hr in hr_res.scalars().all():
            user_hrs[hr.job_id] = hr.email

    out_items = []
    for j in jobs:
        has_contact = bool(j.contact_email or user_hrs.get(j.id))
        app_status = user_apps.get(j.id)
        out_items.append(
            JobOut(
                id=j.id,
                source=j.source,
                source_job_id=j.source_job_id,
                title=j.title,
                company=j.company,
                location=j.location,
                job_url=j.job_url,
                detail_url=j.detail_url,
                description=j.description,
                requirements=j.requirements,
                contact_name=j.contact_name,
                contact_email=j.contact_email or user_hrs.get(j.id),
                contact_phone=j.contact_phone,
                posted_date=j.posted_date,
                scraped_at=j.scraped_at,
                created_at=j.created_at,
                updated_at=j.updated_at,
                raw_data=j.raw_data,
                has_hr_contact=has_contact,
                is_applied=(app_status == "sent"),
                application_status=app_status
            )
        )

    return JobPaginationResponse(
        items=out_items,
        page=page,
        limit=limit,
        total=total,
        has_next=(offset + limit) < total
    )


@router.post("/manual", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_manual_job(
    payload: ManualJobCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id
    source_id = f"{user_id}:{payload.request_id}"
    lookup = select(Job).where(Job.source == "manual", Job.source_job_id == source_id)
    existing = (await db.execute(lookup)).scalar_one_or_none()
    if existing:
        return await get_job(existing.id, current_user, db)

    job = Job(
        source="manual",
        source_job_id=source_id,
        title=payload.role,
        company=payload.company or "Company not specified",
        contact_email=str(payload.email),
        description=payload.description,
        job_url=str(payload.job_url) if payload.job_url else "",
    )
    db.add(job)
    try:
        await db.flush()
        db.add(ManualJobOwnership(job_id=job.id, user_id=user_id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = (await db.execute(lookup)).scalar_one_or_none()
        if not existing:
            raise
        # Restore the dependency object after rollback expires ORM instances.
        await db.refresh(current_user)
        return await get_job(existing.id, current_user, db)
    return await get_job(job.id, current_user, db)


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    job = await get_accessible_job(job_id, current_user.id, db)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    # Check user application status
    app_stmt = select(Application).where(
        Application.user_id == current_user.id,
        Application.job_id == job_id
    )
    app_res = await db.execute(app_stmt)
    app = app_res.scalar_one_or_none()

    # Check user HR contact
    hr_stmt = select(HRContact).where(
        HRContact.user_id == current_user.id,
        HRContact.job_id == job_id
    )
    hr_res = await db.execute(hr_stmt)
    hr = hr_res.scalar_one_or_none()

    effective_email = hr.email if hr else job.contact_email

    return JobOut(
        id=job.id,
        source=job.source,
        source_job_id=job.source_job_id,
        title=job.title,
        company=job.company,
        location=job.location,
        job_url=job.job_url,
        detail_url=job.detail_url,
        description=job.description,
        requirements=job.requirements,
        contact_name=job.contact_name,
        contact_email=effective_email,
        contact_phone=job.contact_phone,
        posted_date=job.posted_date,
        scraped_at=job.scraped_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
        raw_data=job.raw_data,
        has_hr_contact=bool(effective_email),
        is_applied=(app.status == "sent") if app else False,
        application_status=app.status if app else None
    )


@router.post("/{job_id}/analyze", response_model=JobAnalyzeResponse)
async def analyze_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await ApplicationService.analyze_job(
        user_id=current_user.id,
        job_id=job_id,
        db=db
    )


@router.post("/{job_id}/generate-cover-letter", response_model=CoverLetterOut)
async def generate_cover_letter(
    job_id: int,
    payload: Optional[CoverLetterGenerateRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cl = await ApplicationService.generate_cover_letter(
        user_id=current_user.id,
        job_id=job_id,
        job_title_id=payload.job_title_id if payload else None,
        resume_id=payload.resume_id if payload else None,
        custom_instructions=payload.custom_instructions if payload else None,
        db=db
    )
    return cl


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    job = await get_accessible_job(job_id, current_user.id, db)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    await db.delete(job)
    await db.commit()
    return None

