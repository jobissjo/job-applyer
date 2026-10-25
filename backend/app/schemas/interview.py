from datetime import datetime, timezone
from typing import Literal
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator
from app.schemas.application import ApplicationOut

HiringProgress = Literal["awaiting_response", "callback_received", "interviewing", "selected", "not_selected", "withdrawn"]


class ProgressUpdate(BaseModel):
    progress: HiringProgress


class RoundInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    scheduled_at: AwareDatetime | None = None
    mode: Literal["online", "phone", "in_person", "other"] = "online"
    location: str = Field(default="", max_length=2000)
    contact: str = Field(default="", max_length=500)
    status: Literal["to_schedule", "scheduled", "completed", "missed", "cancelled"] = "to_schedule"
    result: Literal["awaiting_result", "passed", "not_passed"] = "awaiting_result"
    preparation_notes: str = Field(default="", max_length=50000)
    reflection: str = Field(default="", max_length=50000)
    went_wrong: str = Field(default="", max_length=50000)
    feedback: str = Field(default="", max_length=50000)
    improvements: str = Field(default="", max_length=50000)

    @field_validator("name", "location", "contact", "preparation_notes", "reflection", "went_wrong", "feedback", "improvements", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("scheduled_at")
    @classmethod
    def utc(cls, value):
        return value.astimezone(timezone.utc) if value else None

    @model_validator(mode="after")
    def validate_state(self):
        if self.status == "scheduled" and self.scheduled_at is None:
            raise ValueError("Scheduled interviews need a date and time")
        if self.result != "awaiting_result" and self.status != "completed":
            raise ValueError("Record a result only for a completed interview")
        return self


class RoundOut(RoundInput):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @field_validator("scheduled_at", mode="before")
    @classmethod
    def sqlite_utc(cls, value):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class ChangeOut(BaseModel):
    id: int
    round_id: int | None
    description: str
    before: dict
    after: dict
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class InterviewTrackingOut(BaseModel):
    application: ApplicationOut
    rounds: list[RoundOut]
    history: list[ChangeOut]
