import hashlib
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.services.scraper.base import BaseScraper, ScrapedJob
from app.services.scraper.park_utils import job_email, positive_paging, text, valid_url


class CyberparkScraper(BaseScraper):
    SOURCE_NAME = "cyberpark"
    BASE_URL = "https://cyberparks.in"
    SEARCH_URL = f"{BASE_URL}/careers/"
    API_URL = f"{BASE_URL}/jm-ajax/get_listings/"

    async def search(self, query: str = "", page: int = 1, limit: int = 20) -> list[ScrapedJob]:
        positive_paging(page, limit)
        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
            response = await client.post(self.API_URL, data={
                "search_keywords": query.strip(), "page": page, "per_page": limit,
                "orderby": "date", "order": "DESC",
            })
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict) or not isinstance(payload.get("html"), str):
                raise ValueError("Cyberpark returned an invalid job search response")
            soup = BeautifulSoup(payload["html"], "html.parser")
            if payload.get("found_jobs") and not soup.select("li.job_listing"):
                raise ValueError("Cyberpark job listing structure was not recognized")
            jobs = []
            seen = set()
            for row in soup.select("li.job_listing"):
                anchor = row.select_one("a[href]")
                title = text(row.select_one(".position h3"))
                if not anchor or not title:
                    continue
                url = urljoin(self.BASE_URL, anchor["href"])
                if not valid_url(url, "cyberparks.in", "/job/") or url in seen:
                    continue
                seen.add(url)
                job = await self._details(client, url)
                job.title = title
                job.company = text(row.select_one(".company strong")) or job.company
                job.location = text(row.select_one(".location")) or job.location
                date = row.select_one("time[datetime]")
                if date:
                    job.posted_date = date["datetime"]
                jobs.append(job)
                if len(jobs) >= limit:
                    break
            return jobs

    async def get_job_details(self, detail_url: str) -> ScrapedJob | None:
        if not valid_url(detail_url, "cyberparks.in", "/job/"):
            return None
        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
            return await self._details(client, detail_url)

    async def _details(self, client: httpx.AsyncClient, url: str) -> ScrapedJob:
        response = await client.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        content = soup.select_one(".single_job_listing")
        title = text(content.select_one(".entry-title")) if content else ""
        if not content or not title:
            raise ValueError("Cyberpark job detail structure was not recognized")
        # Use the canonical URL for an ID that is identical in search/detail calls.
        source_id = hashlib.sha256(url.rstrip("/").encode()).hexdigest()[:24]
        date = content.select_one("time[datetime]")
        description = content.select_one(".job_description")
        return ScrapedJob(
            source=self.SOURCE_NAME, source_job_id=source_id, title=title,
            company=text(content.select_one(".company strong")) or "Company not listed",
            location=text(content.select_one(".location")) or "Kozhikode (Cyberpark)",
            job_url=url, detail_url=url, description=text(description),
            contact_email=job_email(content.select_one(".application_details")) or job_email(description),
            posted_date=date["datetime"] if date else None,
        )
