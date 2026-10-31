"""Bound repeated guesses per client and email across API workers."""
import hashlib
import time
from fastapi import HTTPException
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.statements import insert_do_nothing
from app.models.security import LoginAttempt

WINDOW_SECONDS = 300
MAX_ATTEMPTS = 15


async def reserve_attempt(db: AsyncSession, client_host: str, email: str) -> str:
    now = int(time.time())
    window = now - now % WINDOW_SECONDS
    # Never trust user-supplied forwarded headers as a rate-limit identity.
    scope = hashlib.sha256(f"{client_host}\0{email.casefold()}".encode()).hexdigest()
    await db.execute(delete(LoginAttempt).where(LoginAttempt.window_start < window))
    await db.execute(insert_do_nothing(db, LoginAttempt,
        values={"scope_hash": scope, "window_start": window, "attempts": 0},
        index_elements=["scope_hash"]))
    result = await db.execute(update(LoginAttempt).where(
        LoginAttempt.scope_hash == scope, LoginAttempt.attempts < MAX_ATTEMPTS
    ).values(attempts=LoginAttempt.attempts + 1).returning(LoginAttempt.attempts))
    allowed = result.scalar_one_or_none()
    await db.commit()
    if allowed is None:
        raise HTTPException(429, "Too many sign-in attempts. Please try again shortly.",
                            headers={"Retry-After": str(window + WINDOW_SECONDS - now)})
    return scope


async def clear_attempts(db: AsyncSession, scope: str):
    await db.execute(delete(LoginAttempt).where(LoginAttempt.scope_hash == scope))
    await db.commit()
