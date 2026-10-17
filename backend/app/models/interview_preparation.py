from uuid import uuid4

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class InterviewPreparation(Base, TimestampMixin):
    __tablename__ = "interview_preparations"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), unique=True)
    generation_id: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid4()))
    resume_id: Mapped[int | None] = mapped_column(ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    resume_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str] = mapped_column(Text)
    sections: Mapped[list["InterviewSection"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="InterviewSection.position",
    )


class InterviewSection(Base):
    __tablename__ = "interview_sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    preparation_id: Mapped[int] = mapped_column(ForeignKey("interview_preparations.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(150))
    priority: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(Text)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    topics: Mapped[list[str]] = mapped_column(JSON)
    practice_tasks: Mapped[list[str]] = mapped_column(JSON)
    questions: Mapped[list[dict]] = mapped_column(JSON)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
