from typing import Literal
from pydantic import BaseModel, Field, HttpUrl, ConfigDict, field_validator, model_validator

LearningStatus = Literal["planned", "in_progress", "completed", "on_hold"]


class LearningCreate(BaseModel):
    skill: str = Field(min_length=1, max_length=150)
    job_ids: list[int] = Field(default_factory=list, max_length=100)

    @field_validator("skill", mode="before")
    @classmethod
    def trim_skill(cls, value):
        return " ".join(value.split()) if isinstance(value, str) else value


class LearningUpdate(BaseModel):
    status: LearningStatus


class EntryInput(BaseModel):
    kind: Literal["note", "resource"]
    content: str = Field(min_length=1, max_length=10000)
    url: HttpUrl | None = Field(default=None, max_length=2000)

    @field_validator("content", mode="before")
    @classmethod
    def trim_content(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def require_resource_url(self):
        if self.kind == "resource" and not self.url:
            raise ValueError("Resources require an http or https URL")
        if self.kind == "note":
            self.url = None
        return self


class GapRequest(BaseModel):
    resume_id: int


class GapSuggestion(BaseModel):
    skill: str = Field(min_length=1, max_length=150)
    reason: str = Field(min_length=1, max_length=1000)


class GapResponse(BaseModel):
    skills: list[GapSuggestion] = Field(max_length=50)


class EntryOut(BaseModel):
    id: int
    kind: str
    content: str
    url: str | None
    model_config = ConfigDict(from_attributes=True)


class LinkedJob(BaseModel):
    id: int
    title: str
    company: str
    model_config = ConfigDict(from_attributes=True)


class LearningOut(BaseModel):
    id: int
    skill: str
    status: LearningStatus
    jobs: list[LinkedJob]
    entries: list[EntryOut]
