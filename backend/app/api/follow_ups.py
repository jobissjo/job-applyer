from datetime import datetime, timezone
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.application import Application
from app.models.email_settings import EmailSettings
from app.models.follow_up import ApplicationFollowUp
from app.models.user import User
from app.schemas.follow_up import FollowUpCreate, FollowUpOut
from app.services.application_service import ApplicationService
from app.services.email_service import EmailService
from app.utils.security import get_current_user

router = APIRouter(tags=["Application follow-ups"])


async def owned_application(application_id: int, user_id: int, db: AsyncSession) -> Application:
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.resume), selectinload(Application.job))
        .where(Application.id == application_id, Application.user_id == user_id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.get("/applications/{application_id}/follow-ups", response_model=List[FollowUpOut])
async def list_follow_ups(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await owned_application(application_id, current_user.id, db)
    result = await db.execute(
        select(ApplicationFollowUp)
        .where(ApplicationFollowUp.application_id == application_id, ApplicationFollowUp.user_id == current_user.id)
        .order_by(ApplicationFollowUp.created_at.desc(), ApplicationFollowUp.id.desc())
    )
    return list(result.scalars().all())


@router.post("/applications/{application_id}/follow-ups", response_model=FollowUpOut)
async def send_follow_up(
    application_id: int,
    payload: FollowUpCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id
    application = await owned_application(application_id, user_id, db)
    request_id = str(payload.request_id)

    async def previous_attempt():
        result = await db.execute(select(ApplicationFollowUp).where(ApplicationFollowUp.request_id == request_id))
        existing = result.scalar_one_or_none()
        if existing and (existing.user_id != user_id or existing.application_id != application_id):
            raise HTTPException(status_code=409, detail="This request belongs to another application")
        return existing

    existing = await previous_attempt()
    if existing:
        return existing
    if application.status != "sent" or not application.sent_to:
        raise HTTPException(status_code=400, detail="Follow-ups are available after the original application has been sent")

    result = await db.execute(select(EmailSettings).where(EmailSettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if not settings or not settings.smtp_host or not settings.smtp_password:
        raise HTTPException(status_code=400, detail="Configure your email connection before sending a follow-up")

    resume_path = None
    attachment_filename = None
    if payload.attach_resume:
        resume = application.resume
        if not resume or resume.user_id != user_id or not Path(resume.file_path).is_file():
            raise HTTPException(status_code=400, detail="The original resume file is unavailable. Send without an attachment or restore the file.")
        resume_path = resume.file_path
        name = await ApplicationService.get_candidate_name(user_id, db)
        attachment_filename = ApplicationService.get_formatted_attachment_name(
            name, application.job.title if application.job else "Position", resume_path
        )

    follow_up = ApplicationFollowUp(
        application_id=application.id,
        user_id=user_id,
        request_id=request_id,
        recipient=application.sent_to,
        subject=payload.subject,
        body=payload.body,
        attach_resume=payload.attach_resume,
        status="scheduled" if payload.scheduled_at else "sending",
        scheduled_at=payload.scheduled_at,
    )
    db.add(follow_up)
    try:
        # Persist the request before SMTP dispatch so retries cannot send it twice.
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await previous_attempt()
        if existing:
            return existing
        raise

    if payload.scheduled_at:
        await db.refresh(follow_up)
        return follow_up

    try:
        success, message = await EmailService.send_application_email(
            settings=settings,
            to_email=follow_up.recipient,
            subject=follow_up.subject,
            cover_letter_text=follow_up.body,
            resume_path=resume_path,
            attachment_filename=attachment_filename,
        )
    except Exception:
        success, message = False, "The email connection interrupted the send. Check your mailbox before trying again."
    follow_up.status = "sent" if success else "failed"
    follow_up.sent_at = datetime.now(timezone.utc) if success else None
    follow_up.error_message = None if success else message
    await db.commit()
    await db.refresh(follow_up)
    return follow_up


@router.post("/applications/{application_id}/follow-ups/{follow_up_id}/cancel", response_model=FollowUpOut)
async def cancel_follow_up(application_id: int, follow_up_id: int,
                           current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_application(application_id, current_user.id, db)
    claim = await db.execute(update(ApplicationFollowUp).where(
        ApplicationFollowUp.id == follow_up_id, ApplicationFollowUp.application_id == application_id,
        ApplicationFollowUp.user_id == current_user.id, ApplicationFollowUp.status == "scheduled",
    ).values(status="cancelled"))
    if not claim.rowcount:
        await db.rollback()
        raise HTTPException(409, "Follow-up is no longer scheduled; refresh the history")
    await db.commit()
    return (await db.execute(select(ApplicationFollowUp).where(ApplicationFollowUp.id == follow_up_id))).scalar_one()
