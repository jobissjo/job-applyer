from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class ResumeJobTitle(Base, TimestampMixin):
    __tablename__ = "resume_job_titles"
    __table_args__ = (
        UniqueConstraint("resume_id", "job_title_id", name="uq_resume_job_title"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    resume_id: Mapped[int] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    job_title_id: Mapped[int] = mapped_column(
        ForeignKey("job_title_preferences.id", ondelete="CASCADE"), index=True, nullable=False
    )

    resume: Mapped["Resume"] = relationship("Resume", back_populates="job_titles")
    job_title: Mapped["JobTitlePreference"] = relationship("JobTitlePreference", back_populates="resumes")
