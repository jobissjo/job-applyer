from datetime import date, datetime
from typing import Optional
from sqlalchemy import String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Application(Base, TimestampMixin):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    resume_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True
    )
    cover_letter_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cover_letters.id", ondelete="SET NULL"), nullable=True
    )
    hr_contact_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("hr_contacts.id", ondelete="SET NULL"), nullable=True
    )
    # applied_externally records are tracking-only and cannot be dispatched.
    status: Mapped[str] = mapped_column(String(50), default="draft", index=True, nullable=False)
    email_subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    sent_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    applied_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    application_method: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="applications")
    job: Mapped["Job"] = relationship("Job", back_populates="applications")
    resume: Mapped[Optional["Resume"]] = relationship("Resume", back_populates="applications")
    cover_letter: Mapped[Optional["CoverLetter"]] = relationship("CoverLetter", back_populates="applications")
    hr_contact: Mapped[Optional["HRContact"]] = relationship("HRContact", back_populates="applications")
    interview_preparation: Mapped[Optional["InterviewPreparation"]] = relationship(
        "InterviewPreparation", cascade="all, delete-orphan", uselist=False,
    )
