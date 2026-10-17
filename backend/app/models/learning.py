from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class LearningItem(Base, TimestampMixin):
    __tablename__ = "learning_items"
    __table_args__ = (UniqueConstraint("user_id", "skill_key", name="uq_learning_user_skill"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    skill: Mapped[str] = mapped_column(String(150))
    skill_key: Mapped[str] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(30), default="planned")
    jobs: Mapped[list["LearningJob"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    entries: Mapped[list["LearningEntry"]] = relationship(cascade="all, delete-orphan", lazy="selectin", order_by="LearningEntry.id")


class LearningJob(Base):
    __tablename__ = "learning_jobs"
    item_id: Mapped[int] = mapped_column(ForeignKey("learning_items.id", ondelete="CASCADE"), primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True)
    job: Mapped["Job"] = relationship(lazy="joined")


class LearningEntry(Base, TimestampMixin):
    __tablename__ = "learning_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("learning_items.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
