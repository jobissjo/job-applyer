from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.email_settings import EmailSettings
from app.schemas.email_settings import (
    EmailSettingsCreate,
    EmailSettingsUpdate,
    EmailSettingsOut,
    EmailTestRequest,
    EmailTestResponse
)
from app.services.email_service import EmailService
from app.utils.security import get_current_user

router = APIRouter(prefix="/email-settings", tags=["Email Settings"])


@router.get("", response_model=Optional[EmailSettingsOut])
async def get_email_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(EmailSettings).where(EmailSettings.user_id == current_user.id)
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        return None

    return EmailSettingsOut(
        id=s.id,
        user_id=s.user_id,
        smtp_host=s.smtp_host,
        smtp_port=s.smtp_port,
        smtp_username=s.smtp_username,
        from_email=s.from_email,
        use_tls=s.use_tls,
        password_configured=bool(s.smtp_password),
        created_at=s.created_at,
        updated_at=s.updated_at
    )


@router.put("", response_model=EmailSettingsOut)
async def update_email_settings(
    payload: EmailSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(EmailSettings).where(EmailSettings.user_id == current_user.id)
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()

    if not s:
        # Create new
        if not payload.smtp_host or not payload.smtp_username or not payload.from_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing required SMTP fields")
        s = EmailSettings(
            user_id=current_user.id,
            smtp_host=payload.smtp_host,
            smtp_port=payload.smtp_port or 587,
            smtp_username=payload.smtp_username,
            smtp_password=payload.smtp_password or "",
            from_email=payload.from_email,
            use_tls=payload.use_tls if payload.use_tls is not None else True
        )
        db.add(s)
    else:
        if payload.smtp_host is not None:
            s.smtp_host = payload.smtp_host
        if payload.smtp_port is not None:
            s.smtp_port = payload.smtp_port
        if payload.smtp_username is not None:
            s.smtp_username = payload.smtp_username
        if payload.smtp_password is not None and payload.smtp_password.strip():
            s.smtp_password = payload.smtp_password.strip()
        if payload.from_email is not None:
            s.from_email = payload.from_email
        if payload.use_tls is not None:
            s.use_tls = payload.use_tls

    await db.commit()
    await db.refresh(s)

    return EmailSettingsOut(
        id=s.id,
        user_id=s.user_id,
        smtp_host=s.smtp_host,
        smtp_port=s.smtp_port,
        smtp_username=s.smtp_username,
        from_email=s.from_email,
        use_tls=s.use_tls,
        password_configured=bool(s.smtp_password),
        created_at=s.created_at,
        updated_at=s.updated_at
    )


@router.post("/test", response_model=EmailTestResponse)
async def test_smtp(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(EmailSettings).where(EmailSettings.user_id == current_user.id)
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()

    if not s:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No SMTP settings configured yet."
        )

    success, msg = await EmailService.test_connection(s)
    return EmailTestResponse(
        success=success,
        message=msg if success else "Failed to connect to SMTP server",
        error=None if success else msg
    )
