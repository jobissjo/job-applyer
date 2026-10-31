"""App-owned registration emails, independent of users' application SMTP settings."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import aiosmtplib
from fastapi import HTTPException

from app.config import settings
from app.models.user import User


def code_hash(email: str, code: str) -> str:
    return hmac.new(
        settings.JWT_SECRET_KEY.encode(), f"verify:{email}:{code}".encode(), hashlib.sha256
    ).hexdigest()


async def send_verification(user: User) -> None:
    if not settings.AUTH_SMTP_HOST or not settings.AUTH_SMTP_FROM_EMAIL:
        raise HTTPException(503, "Registration email is not configured. Please contact the administrator.")
    now = datetime.now(timezone.utc)
    code = f"{secrets.randbelow(1_000_000):06d}"
    message = EmailMessage()
    message["From"] = settings.AUTH_SMTP_FROM_EMAIL
    message["To"] = user.email
    message["Subject"] = "Verify your ApplyPilot email"
    message.set_content(
        f"Your ApplyPilot verification code is: {code}\n\n"
        "This code expires in 10 minutes. Only the latest code works.\n"
        "If you did not create an account, you can ignore this email."
    )
    try:
        use_tls = settings.AUTH_SMTP_USE_TLS or settings.AUTH_SMTP_PORT == 465
        refused, _ = await aiosmtplib.send(
            message,
            hostname=settings.AUTH_SMTP_HOST,
            port=settings.AUTH_SMTP_PORT,
            username=settings.AUTH_SMTP_USERNAME or None,
            password=settings.AUTH_SMTP_PASSWORD or None,
            use_tls=use_tls,
            start_tls=False if use_tls else settings.AUTH_SMTP_START_TLS,
            timeout=15,
        )
        if refused:
            raise RuntimeError("Recipient refused")
    except Exception:
        # Never expose SMTP credentials, provider responses, or verification codes.
        raise HTTPException(503, "Could not send the verification email. Please try again later.") from None
    user.verification_code_hash = code_hash(user.email, code)
    user.verification_expires_at = now + timedelta(minutes=10)
    user.verification_sent_at = now
    user.verification_attempts = 0
