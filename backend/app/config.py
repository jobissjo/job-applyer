import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "Job Auto-Apply System"
    API_V1_STR: str = "/api"
    DEBUG: bool = True
    
    # Database - Async SQLite by default
    DATABASE_URL: str = "sqlite+aiosqlite:///./job_auto_apply.db"
    
    # JWT Auth
    JWT_SECRET_KEY: str = "super-secret-local-jwt-key-replace-in-production-1234567890"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Storage
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    RESUME_DIR: Path = BASE_DIR / "uploads" / "resumes"
    
    # Frontend CORS
    FRONTEND_URL: str = "http://localhost:5173"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

# Ensure directories exist
settings.RESUME_DIR.mkdir(parents=True, exist_ok=True)
