from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_code_hash: Mapped[Optional[str]] = mapped_column(String(64))
    verification_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    verification_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    verification_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships with cascade delete
    profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    job_titles: Mapped[List["JobTitlePreference"]] = relationship(
        "JobTitlePreference", back_populates="user", cascade="all, delete-orphan"
    )
    resumes: Mapped[List["Resume"]] = relationship(
        "Resume", back_populates="user", cascade="all, delete-orphan"
    )
    llm_providers: Mapped[List["LLMProvider"]] = relationship(
        "LLMProvider", back_populates="user", cascade="all, delete-orphan"
    )
    applications: Mapped[List["Application"]] = relationship(
        "Application", back_populates="user", cascade="all, delete-orphan"
    )
    hr_contacts: Mapped[List["HRContact"]] = relationship(
        "HRContact", back_populates="user", cascade="all, delete-orphan"
    )
    email_settings: Mapped[Optional["EmailSettings"]] = relationship(
        "EmailSettings", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    cover_letters: Mapped[List["CoverLetter"]] = relationship(
        "CoverLetter", back_populates="user", cascade="all, delete-orphan"
    )
