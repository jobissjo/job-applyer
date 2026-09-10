from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.job import Job
from app.models.hr_contact import HRContact
from app.models.application import Application
from app.schemas.hr_contact import HRContactCreate, HRContactUpdate, HRContactOut
from app.schemas.job import JobOut
from app.utils.security import get_current_user

router = APIRouter(prefix="/hr-contacts", tags=["HR Contacts"])


@router.get("", response_model=List[HRContactOut])
async def list_hr_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(HRContact)
        .where(HRContact.user_id == current_user.id)
        .order_by(HRContact.created_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/required-jobs", response_model=List[JobOut])
async def list_jobs_requiring_hr_contact(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns jobs that have no contact_email on the job record AND
    no user-provided HR contact has been linked yet, OR jobs with status 'hr_contact_required'.
    """
    # 1. User's existing HR contacts
    user_hr_stmt = select(HRContact.job_id).where(HRContact.user_id == current_user.id)
    user_hr_res = await db.execute(user_hr_stmt)
    handled_job_ids = set(user_hr_res.scalars().all())

    # 2. Query jobs where contact_email is null or empty, or where application has hr_contact_required
    app_req_stmt = select(Application.job_id).where(
        Application.user_id == current_user.id,
        Application.status == "hr_contact_required"
    )
    app_req_res = await db.execute(app_req_stmt)
    app_req_job_ids = set(app_req_res.scalars().all())

    stmt = select(Job).where(
        or_(
            and_(
                or_(Job.contact_email == None, Job.contact_email == ""),
                ~Job.id.in_(handled_job_ids) if handled_job_ids else True
            ),
            Job.id.in_(app_req_job_ids) if app_req_job_ids else False
        )
    ).order_by(Job.scraped_at.desc())

    res = await db.execute(stmt)
    jobs = list(res.scalars().all())

    return [
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
            contact_email=j.contact_email,
            contact_phone=j.contact_phone,
            posted_date=j.posted_date,
            scraped_at=j.scraped_at,
            created_at=j.created_at,
            updated_at=j.updated_at,
            raw_data=j.raw_data,
            has_hr_contact=False,
            is_applied=False,
            application_status="hr_contact_required"
        )
        for j in jobs
    ]


@router.post("", response_model=HRContactOut, status_code=status.HTTP_201_CREATED)
async def add_hr_contact(
    payload: HRContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    job = await db.get(Job, payload.job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    contact = HRContact(
        user_id=current_user.id,
        job_id=payload.job_id,
        company=payload.company or job.company,
        contact_name=payload.contact_name,
        email=payload.email,
        phone=payload.phone,
        source="manual",
        notes=payload.notes
    )
    db.add(contact)
    await db.flush()

    # If an application exists for this job in hr_contact_required status, update it to ready
    stmt_app = select(Application).where(
        Application.user_id == current_user.id,
        Application.job_id == payload.job_id
    )
    res_app = await db.execute(stmt_app)
    app = res_app.scalar_one_or_none()
    if app:
        app.hr_contact_id = contact.id
        if app.status == "hr_contact_required":
            app.status = "ready"

    await db.commit()
    await db.refresh(contact)
    return contact


@router.put("/{contact_id}", response_model=HRContactOut)
async def update_hr_contact(
    contact_id: int,
    payload: HRContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HRContact).where(
        HRContact.id == contact_id,
        HRContact.user_id == current_user.id
    )
    res = await db.execute(stmt)
    contact = res.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HR Contact not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(contact, field, val)

    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hr_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HRContact).where(
        HRContact.id == contact_id,
        HRContact.user_id == current_user.id
    )
    res = await db.execute(stmt)
    contact = res.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HR Contact not found")

    await db.delete(contact)
    await db.commit()
    return None
