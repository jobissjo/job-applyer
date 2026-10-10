from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ManualJobOwnership(Base):
    __tablename__ = "manual_job_ownership"

    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
