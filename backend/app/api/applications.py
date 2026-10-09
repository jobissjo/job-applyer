from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User
from app.models.job import Job
from app.models.resume import Resume
from app.models.cover_letter import CoverLetter
from app.models.hr_contact import HRContact
from app.models.application import Application
from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationOut,
    ApplicationPreviewResponse
)
from app.schemas.job import JobOut
from app.schemas.resume import ResumeOut
from app.schemas.cover_letter import CoverLetterOut
from app.schemas.hr_contact import HRContactOut
from app.services.application_service import ApplicationService
from app.utils.security import get_current_user

router = APIRouter(tags=["Applications"])


@router.get("/applications", response_model=List[ApplicationOut])
async def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Application)
        .options(
            selectinload(Application.job),
            selectinload(Application.resume),
            selectinload(Application.cover_letter),
            selectinload(Application.hr_contact)
        )
        .where(Application.user_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Application.status == status_filter.lower().strip())

    res = await db.execute(stmt)
    apps = list(res.scalars().all())

    out = []
    for app in apps:
        out.append(
            ApplicationOut(
                id=app.id,
                user_id=app.user_id,
                job_id=app.job_id,
                resume_id=app.resume_id,
                cover_letter_id=app.cover_letter_id,
                hr_contact_id=app.hr_contact_id,
                status=app.status,
                email_subject=app.email_subject,
                sent_to=app.sent_to,
                sent_at=app.sent_at,
                notes=app.notes,
                created_at=app.created_at,
                updated_at=app.updated_at,
                job=JobOut.model_validate(app.job) if app.job else None,
                resume=ResumeOut.model_validate(app.resume) if app.resume else None,
                cover_letter=CoverLetterOut.model_validate(app.cover_letter) if app.cover_letter else None,
                hr_contact=HRContactOut.model_validate(app.hr_contact) if app.hr_contact else None
            )
        )
    return out


@router.post("/applications", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_or_prepare_application(
    payload: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cover_letter_id = payload.cover_letter_id
    if payload.cover_letter_content is not None:
        letter = await ApplicationService.save_reviewed_cover_letter(
            current_user.id, payload.job_id, payload.cover_letter_content,
            payload.resume_id, db
        )
        cover_letter_id = letter.id
    app = await ApplicationService.prepare_or_update_application(
        user_id=current_user.id,
        job_id=payload.job_id,
        resume_id=payload.resume_id,
        cover_letter_id=cover_letter_id,
        hr_contact_id=payload.hr_contact_id,
        email_subject=payload.email_subject,
        notes=payload.notes,
        db=db
    )
    return await get_application_by_id(app.id, current_user, db)


@router.get("/applications/{application_id}", response_model=ApplicationOut)
async def get_application_by_id(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Application)
        .options(
            selectinload(Application.job),
            selectinload(Application.resume),
            selectinload(Application.cover_letter),
            selectinload(Application.hr_contact)
        )
        .where(Application.id == application_id, Application.user_id == current_user.id)
        .execution_options(populate_existing=True)
    )
    res = await db.execute(stmt)
    app = res.scalar_one_or_none()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    return ApplicationOut(
        id=app.id,
        user_id=app.user_id,
        job_id=app.job_id,
        resume_id=app.resume_id,
        cover_letter_id=app.cover_letter_id,
        hr_contact_id=app.hr_contact_id,
        status=app.status,
        email_subject=app.email_subject,
        sent_to=app.sent_to,
        sent_at=app.sent_at,
        notes=app.notes,
        created_at=app.created_at,
        updated_at=app.updated_at,
        job=JobOut.model_validate(app.job) if app.job else None,
        resume=ResumeOut.model_validate(app.resume) if app.resume else None,
        cover_letter=CoverLetterOut.model_validate(app.cover_letter) if app.cover_letter else None,
        hr_contact=HRContactOut.model_validate(app.hr_contact) if app.hr_contact else None
    )


@router.put("/applications/{application_id}", response_model=ApplicationOut)
async def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Application)
        .where(Application.id == application_id, Application.user_id == current_user.id)
        .execution_options(populate_existing=True)
    )
    res = await db.execute(stmt)
    app = res.scalar_one_or_none()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if "resume_id" in payload.model_fields_set:
        if payload.resume_id is not None:
            resume = await db.get(Resume, payload.resume_id)
            if not resume or resume.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Resume not found")
        app.resume_id = payload.resume_id
    if payload.cover_letter_id is not None:
        app.cover_letter_id = payload.cover_letter_id
    if payload.hr_contact_id is not None:
        app.hr_contact_id = payload.hr_contact_id
    if payload.email_subject is not None:
        app.email_subject = payload.email_subject
    if payload.status is not None:
        app.status = payload.status
    if payload.notes is not None:
        app.notes = payload.notes
    if payload.cover_letter_content is not None:
        letter = await ApplicationService.save_reviewed_cover_letter(
            current_user.id, app.job_id, payload.cover_letter_content,
            app.resume_id, db
        )
        app.cover_letter_id = letter.id

    await db.commit()
    return await get_application_by_id(application_id, current_user, db)


@router.get("/applications/{application_id}/preview", response_model=ApplicationPreviewResponse)
async def preview_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Application)
        .options(
            selectinload(Application.job),
            selectinload(Application.resume),
            selectinload(Application.cover_letter),
            selectinload(Application.hr_contact)
        )
        .where(Application.id == application_id, Application.user_id == current_user.id)
        .execution_options(populate_existing=True)
    )
    res = await db.execute(stmt)
    app = res.scalar_one_or_none()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    recipient_email = None
    if app.hr_contact and app.hr_contact.email:
        recipient_email = app.hr_contact.email
    elif app.job and app.job.contact_email:
        recipient_email = app.job.contact_email

    has_hr = bool(recipient_email)
    can_send = has_hr and (app.status != "sent")
    reason = None
    if not has_hr:
        reason = "No HR contact email available. Please add an HR contact before sending."
    elif app.status == "sent":
        reason = "This application has already been dispatched."

    candidate_name = await ApplicationService.get_candidate_name(current_user.id, db)
    job_title = app.job.title if app.job else "Target Job"
    formatted_resume_name = None
    if app.resume:
        formatted_resume_name = ApplicationService.get_formatted_attachment_name(
            candidate_name=candidate_name,
            job_title=job_title,
            file_path_or_ext=app.resume.file_path or app.resume.file_name or ".pdf"
        )

    return ApplicationPreviewResponse(
        application_id=app.id,
        job_id=app.job_id,
        job_title=job_title,
        company=app.job.company if app.job else "Target Company",
        recipient_email=recipient_email,
        has_hr_contact=has_hr,
        email_subject=app.email_subject or (f"Application for {job_title} - {candidate_name}" if app.job else ""),
        cover_letter_text=app.cover_letter.content if app.cover_letter else "",
        resume_title=app.resume.title if app.resume else None,
        resume_file_name=formatted_resume_name or (app.resume.file_name if app.resume else None),
        can_send=can_send,
        reason_cannot_send=reason
    )


@router.post("/applications/{application_id}/send", response_model=ApplicationOut)
async def send_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Explicit manual send action. Strictly verifies HR contact and SMTP configuration.
    """
    app = await ApplicationService.send_application(
        user_id=current_user.id,
        application_id=application_id,
        db=db
    )
    return await get_application_by_id(app.id, current_user, db)


@router.get("/dashboard-stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Total Jobs
    res_jobs = await db.execute(select(func.count(Job.id)))
    total_jobs = res_jobs.scalar() or 0

    # User Applications by status
    stmt_apps = (
        select(Application.status, func.count(Application.id))
        .where(Application.user_id == current_user.id)
        .group_by(Application.status)
    )
    res_apps = await db.execute(stmt_apps)
    app_counts = dict(res_apps.all())

    # User HR contacts
    res_hrs = await db.execute(
        select(func.count(HRContact.id)).where(HRContact.user_id == current_user.id)
    )
    total_hr_contacts = res_hrs.scalar() or 0

    # Jobs missing HR email
    stmt_missing_hr = select(func.count(Job.id)).where(
        or_(Job.contact_email == None, Job.contact_email == "")
    )
    res_missing_hr = await db.execute(stmt_missing_hr)
    missing_hr_jobs = res_missing_hr.scalar() or 0

    return {
        "total_jobs": total_jobs,
        "applications_ready": app_counts.get("ready", 0),
        "applications_sent": app_counts.get("sent", 0),
        "hr_contacts_required": app_counts.get("hr_contact_required", 0) + missing_hr_jobs,
        "applications_failed": app_counts.get("failed", 0),
        "total_hr_contacts_added": total_hr_contacts,
        "total_applications": sum(app_counts.values())
    }
