from typing import List, Optional
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
