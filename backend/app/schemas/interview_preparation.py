from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

StudyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1500)]


class InterviewQuestion(BaseModel):
    question: StudyText
    answer_guide: StudyText


class StudySection(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    priority: Literal["high", "medium", "low"]
    reason: StudyText
    estimated_minutes: int = Field(ge=5, le=600)
    topics: list[StudyText] = Field(min_length=1, max_length=10)
    practice_tasks: list[StudyText] = Field(min_length=1, max_length=6)
    questions: list[InterviewQuestion] = Field(min_length=1, max_length=6)
    model_config = ConfigDict(from_attributes=True)


class GeneratedPreparation(BaseModel):
    summary: StudyText
    sections: list[StudySection] = Field(min_length=1, max_length=10)


class PreparationRequest(BaseModel):
    resume_id: int | None = None
    context: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] = ""
    replace_generation: UUID | None = None


class StudySectionOut(StudySection):
    id: int
    completed: bool


class PreparationOut(BaseModel):
    id: int
    application_id: int
    generation_id: str
    resume_id: int | None
    resume_title: str | None
    context: str | None
    summary: str
    created_at: datetime
    updated_at: datetime
    sections: list[StudySectionOut]
    model_config = ConfigDict(from_attributes=True)


class StudyProgressUpdate(BaseModel):
    generation_id: UUID
    completed: bool
