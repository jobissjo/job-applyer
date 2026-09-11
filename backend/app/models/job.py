from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("source", "source_job_id", name="uq_source_job_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # "infopark", "technopark"
    source_job_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    company: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    job_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    detail_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    posted_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    raw_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    applications: Mapped[List["Application"]] = relationship(
        "Application", back_populates="job", cascade="all, delete-orphan"
    )
    hr_contacts: Mapped[List["HRContact"]] = relationship(
        "HRContact", back_populates="job", cascade="all, delete-orphan"
    )
