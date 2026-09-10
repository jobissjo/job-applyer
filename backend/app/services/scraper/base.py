import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from app.utils.logger import logger


@dataclass
class ScrapedJob:
    source: str
    source_job_id: str
    title: str
    company: str
    location: Optional[str] = None
    job_url: str = ""
    detail_url: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    posted_date: Optional[str] = None
    scraped_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    raw_data: Optional[str] = None


EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")


class BaseScraper(ABC):
    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

    @abstractmethod
    async def search(
        self, query: str = "", page: int = 1, limit: int = 20
    ) -> List[ScrapedJob]:
        """Search and extract job listings."""
        pass

    @abstractmethod
    async def get_job_details(self, detail_url: str) -> Optional[ScrapedJob]:
        """Fetch full job details from detail page."""
        pass

    def extract_email(self, text: str) -> Optional[str]:
        if not text:
            return None
        matches = EMAIL_REGEX.findall(text)
        # Filter out common invalid domains or assets
        valid_matches = [
            m for m in matches
            if not m.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"))
        ]
        return valid_matches[0] if valid_matches else None

    def extract_phone(self, text: str) -> Optional[str]:
        if not text:
            return None
        matches = PHONE_REGEX.findall(text)
        return matches[0] if matches else None
