import hmac
import hashlib
import time
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.security import RevokedToken
from app.config import settings
from app.db.statements import insert_do_nothing
from app.services.login_throttle import reserve_attempt, clear_attempts
from app.models.profile import UserProfile
from app.schemas.auth import UserRegister, UserLogin, Token, UserOut, VerificationRequest, VerifyEmail
from app.services.auth_email import send_verification, code_hash
from app.utils.security import hash_password, verify_password, create_access_token, get_current_user, oauth2_scheme

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    stmt = select(User).where(User.email == payload.email)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    user = User(
        email=payload.email,
        hashed_password=await run_in_threadpool(hash_password, payload.password)
    )
    db.add(user)
    await db.flush()

    # Create empty user profile
    profile = UserProfile(user_id=user.id, name=payload.email.split("@")[0])
    db.add(profile)

    try:
        await send_verification(user)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(user)
    return user


@router.post("/resend-verification")
async def resend_verification(payload: VerificationRequest, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    # Claim a cooldown atomically, including across concurrent requests/workers.
    result = await db.execute(
        update(User).where(
            User.email == payload.email,
            User.is_email_verified.is_(False),
            User.is_active.is_(True),
            (User.verification_sent_at.is_(None)) |
            (User.verification_sent_at <= now - timedelta(seconds=60)),
        ).values(verification_sent_at=now).returning(User)
        .execution_options(synchronize_session="fetch", populate_existing=True)
    )
    user = result.scalar_one_or_none()
    if user:
        try:
            await send_verification(user)
            await db.commit()
        except Exception:
            await db.rollback()
            raise
    else:
        await db.rollback()
    return {"message": "If this account needs verification, a code has been sent. Wait 60 seconds before requesting another."}


@router.post("/verify-email")
async def verify_email(payload: VerifyEmail, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    # Persist failed attempts and cap guesses even when requests run concurrently.
    result = await db.execute(
        update(User).where(
            User.email == payload.email,
            User.is_email_verified.is_(False),
            User.is_active.is_(True),
            User.verification_expires_at > now,
            User.verification_attempts < 5,
        ).values(verification_attempts=User.verification_attempts + 1).returning(User)
        .execution_options(synchronize_session="fetch", populate_existing=True)
    )
    user = result.scalar_one_or_none()
    if not user or not user.verification_code_hash or not hmac.compare_digest(
        user.verification_code_hash, code_hash(payload.email, payload.code)
    ):
        await db.commit()
        raise HTTPException(400, "Invalid or expired verification code. Request a new code if needed.")
    user.is_email_verified = True
    user.verification_code_hash = None
    user.verification_expires_at = None
    user.verification_attempts = 0
    await db.commit()
    return {"message": "Email verified. You can now sign in."}


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    scope = await reserve_attempt(db, request.client.host if request.client else "unknown", str(payload.email))
    stmt = select(User).where(User.email == payload.email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not await run_in_threadpool(verify_password, payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )

    if not user.is_email_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before signing in.")

    token = create_access_token(data={"sub": str(user.id)})
    await clear_attempts(db, scope)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout", status_code=204)
async def logout(
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    # Old tokens issued by this application already include exp; require no jti.
    expires_at = payload.get("exp")
    if not isinstance(expires_at, (int, float)):
        raise HTTPException(400, "Session has no expiration")
    await db.execute(delete(RevokedToken).where(RevokedToken.expires_at < int(time.time())))
    await db.execute(insert_do_nothing(db, RevokedToken,
        values={"token_hash": hashlib.sha256(token.encode()).hexdigest(), "expires_at": int(expires_at)},
        index_elements=["token_hash"]))
    await db.commit()


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
