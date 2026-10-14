"""Claim due follow-ups before SMTP delivery; never automatically retry ambiguous sends."""
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.models.follow_up import ApplicationFollowUp
from app.models.application import Application
from app.models.email_settings import EmailSettings
from app.services.application_service import ApplicationService
from app.services.email_service import EmailService


async def dispatch_due(db):
    now = datetime.now(timezone.utc)
    due = (await db.execute(select(ApplicationFollowUp.id).where(
        ApplicationFollowUp.status == "scheduled", ApplicationFollowUp.scheduled_at <= now,
    ).order_by(ApplicationFollowUp.scheduled_at).limit(100))).scalars().all()
    for follow_up_id in due:
        claim = await db.execute(update(ApplicationFollowUp).where(
            ApplicationFollowUp.id == follow_up_id, ApplicationFollowUp.status == "scheduled",
            ApplicationFollowUp.scheduled_at <= now,
        ).values(status="sending"))
        await db.commit()
        if not claim.rowcount:
            continue
        db.expire_all()
        try:
            item = (await db.execute(select(ApplicationFollowUp).where(ApplicationFollowUp.id == follow_up_id))).scalar_one()
            application = (await db.execute(select(Application).where(
                Application.id == item.application_id, Application.user_id == item.user_id,
            ).options(selectinload(Application.resume), selectinload(Application.job)))).scalar_one()
            settings = (await db.execute(select(EmailSettings).where(EmailSettings.user_id == item.user_id))).scalar_one_or_none()
            if not settings or not settings.smtp_host or not settings.smtp_password:
                raise ValueError("Email connection unavailable")
            resume_path = filename = None
            if item.attach_resume:
                resume = application.resume
                if not resume or resume.user_id != item.user_id or not Path(resume.file_path).is_file():
                    raise ValueError("Original resume unavailable")
                resume_path = resume.file_path
                name = await ApplicationService.get_candidate_name(item.user_id, db)
                filename = ApplicationService.get_formatted_attachment_name(name, application.job.title if application.job else "Position", resume_path)
            success, message = await EmailService.send_application_email(
                settings=settings, to_email=item.recipient, subject=item.subject, cover_letter_text=item.body,
                resume_path=resume_path, attachment_filename=filename,
            )
            item.status = "sent" if success else "failed"
            item.sent_at = datetime.now(timezone.utc) if success else None
            item.error_message = None if success else message
            await db.commit()
        except Exception:
            await db.rollback()
            await db.execute(update(ApplicationFollowUp).where(
                ApplicationFollowUp.id == follow_up_id, ApplicationFollowUp.status == "sending",
            ).values(status="failed", error_message="Scheduled follow-up failed. Check your mailbox and email settings before trying again."))
            await db.commit()
