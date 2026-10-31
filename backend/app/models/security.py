"""Additive security records; existing accounts and access tokens remain valid."""
from sqlalchemy import ForeignKey, String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class HiddenJob(Base):
    __tablename__ = "hidden_jobs"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    scope_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False)
