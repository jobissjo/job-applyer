from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class EmailSettingsCreate(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str
    smtp_password: str
    from_email: EmailStr
    use_tls: bool = True


class EmailSettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[EmailStr] = None
    use_tls: Optional[bool] = None


class EmailSettingsOut(BaseModel):
    id: int
    user_id: int
    smtp_host: str
    smtp_port: int
    smtp_username: str
    from_email: str
    use_tls: bool
    password_configured: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmailTestRequest(BaseModel):
    recipient_email: EmailStr


class EmailTestResponse(BaseModel):
    success: bool
    message: str
    error: Optional[str] = None
