from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class JobTitleCreate(BaseModel):
    title: str
    active: bool = True


class JobTitleUpdate(BaseModel):
    title: Optional[str] = None
    active: Optional[bool] = None


class JobTitleOut(BaseModel):
    id: int
    user_id: int
    title: str
    active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
