from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class LLMProviderCreate(BaseModel):
    provider: str  # "openrouter", "groq", "gemini", "xkiro"
    api_key: str
    model: str
    priority: int = 1
    active: bool = True
    enabled: bool = True


class LLMProviderUpdate(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    priority: Optional[int] = None
    active: Optional[bool] = None
    enabled: Optional[bool] = None


class LLMProviderOut(BaseModel):
    id: int
    user_id: int
    provider: str
    model: str
    priority: int
    active: bool
    enabled: bool
    api_key_configured: bool = True
    api_key_preview: str = ""
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LLMTestRequest(BaseModel):
    prompt: Optional[str] = "Hello! Please respond with 'LLM connection successful'."


class LLMTestResponse(BaseModel):
    success: bool
    provider: str
    model: str
    response: Optional[str] = None
    error: Optional[str] = None
