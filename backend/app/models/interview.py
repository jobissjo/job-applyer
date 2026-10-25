from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class InterviewRound(Base, TimestampMixin):
    __tablename__ = "interview_rounds"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    mode: Mapped[str] = mapped_column(String(30), default="online")
    location: Mapped[str] = mapped_column(String(2000), default="")
    contact: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(30), default="to_schedule")
    result: Mapped[str] = mapped_column(String(30), default="awaiting_result")
    preparation_notes: Mapped[str] = mapped_column(Text, default="")
    reflection: Mapped[str] = mapped_column(Text, default="")
    went_wrong: Mapped[str] = mapped_column(Text, default="")
    feedback: Mapped[str] = mapped_column(Text, default="")
    improvements: Mapped[str] = mapped_column(Text, default="")


class InterviewChange(Base, TimestampMixin):
    __tablename__ = "interview_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    round_id: Mapped[Optional[int]] = mapped_column(ForeignKey("interview_rounds.id", ondelete="SET NULL"))
    description: Mapped[str] = mapped_column(String(500))
    before: Mapped[dict] = mapped_column(JSON)
    after: Mapped[dict] = mapped_column(JSON)
