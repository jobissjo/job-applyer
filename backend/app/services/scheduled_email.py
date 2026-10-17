"""Database-backed schedules; atomic claims prevent duplicate worker delivery."""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.models.application import Application
from app.models.email_settings import EmailSettings
from app.services.application_service import ApplicationService


async def schedule(application_id, user_id, scheduled_at, db):
    app = (await db.execute(select(Application).where(
        Application.id == application_id, Application.user_id == user_id,
    ).options(selectinload(Application.job), selectinload(Application.hr_contact),
              selectinload(Application.cover_letter), selectinload(Application.resume)))).scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found")
    if app.status == "applied_externally":
        raise HTTPException(409, "This application was submitted elsewhere and cannot be scheduled")
    if app.status in ("sent", "sending", "scheduled"):
        raise HTTPException(409, "Application is already sent or scheduled")
    recipient = (app.hr_contact.email if app.hr_contact else None) or (app.job.contact_email if app.job else None)
    if not recipient:
        raise HTTPException(400, "Add a recruiter email before scheduling")
    if not app.email_subject or not app.cover_letter or not app.cover_letter.content.strip():
        raise HTTPException(400, "Add a subject and cover letter before scheduling")
    if not (await db.execute(select(EmailSettings).where(EmailSettings.user_id == user_id))).scalar_one_or_none():
        raise HTTPException(400, "Configure your SMTP settings before scheduling")
    if app.resume:
        from pathlib import Path
        if not app.resume.file_path or not Path(app.resume.file_path).is_file():
            raise HTTPException(400, "Attached resume file is unavailable")
    result = await db.execute(update(Application).where(
        Application.id == application_id, Application.status == app.status,
    ).values(status="scheduled", scheduled_at=scheduled_at))
    if not result.rowcount:
        await db.rollback()
        raise HTTPException(409, "Application changed; refresh and try again")
    await db.commit()


async def dispatch_due(db):
    now = datetime.now(timezone.utc)
    due = (await db.execute(select(Application.id, Application.user_id).where(
        Application.status == "scheduled", Application.scheduled_at <= now,
    ).order_by(Application.scheduled_at).limit(100))).all()
    for application_id, user_id in due:
        claim = await db.execute(update(Application).where(
            Application.id == application_id, Application.status == "scheduled",
            Application.scheduled_at <= now,
        ).values(status="sending"))
        await db.commit()
        if not claim.rowcount:
            continue
        # Refresh cached ORM objects after the claim.
        db.expire_all()
        try:
            await ApplicationService.send_application(user_id, application_id, db, scheduled_dispatch=True)
        except Exception:
            await db.rollback()
            await db.execute(update(Application).where(
                Application.id == application_id, Application.status == "sending",
            ).values(status="failed", notes="Scheduled delivery failed. Review email settings and retry manually."))
            await db.commit()
