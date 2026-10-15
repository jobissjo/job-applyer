import asyncio
from urllib.parse import parse_qs, urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from app.services.scraper.base import BaseScraper, ScrapedJob
from app.services.scraper.park_utils import job_email, matches, positive_paging, text, valid_url


class ULCyberparkScraper(BaseScraper):
    SOURCE_NAME = "ulcyberpark"
    BASE_URL = "https://www.ulcyberpark.com"
    SEARCH_URL = f"{BASE_URL}/jobs"

    async def search(self, query: str = "", page: int = 1, limit: int = 20) -> list[ScrapedJob]:
        """UL has no keyword endpoint: filter all published pages, then paginate matches."""
        positive_paging(page, limit)
        jobs = []
        seen_jobs = set()
        seen_pages = set()
        next_url = self.SEARCH_URL
        target = page * limit
        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
            semaphore = asyncio.Semaphore(4)

            async def enrich(row, url):
                async with semaphore:
                    job = await self._details(client, url)
                cells = row.select("td")
                job.company = text(cells[1]) or job.company
                return job

            while next_url and next_url not in seen_pages:
                seen_pages.add(next_url)
                response = await client.get(next_url)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, "html.parser")
                table = soup.select_one(".table-job table")
                if table is None:
                    raise ValueError("UL CyberPark job listing structure was not recognized")
                tasks = []
                for row in table.select("tr"):
                    anchor = row.select_one('a[href*="job_vacancy?job_id="]')
                    if not anchor or len(row.select("td")) < 2:
                        continue
                    url = urljoin(self.BASE_URL, anchor["href"])
                    if not valid_url(url, "www.ulcyberpark.com", "/jobs/job_vacancy") or url in seen_jobs:
                        continue
                    seen_jobs.add(url)
                    tasks.append(enrich(row, url))
                for job in await asyncio.gather(*tasks):
                    if matches(job, query):
                        jobs.append(job)
                if len(jobs) >= target:
                    break
                next_link = soup.select_one('.pagination a[rel="next"]')
                next_url = urljoin(self.BASE_URL, next_link["href"]) if next_link else None
                if next_url and not valid_url(next_url, "www.ulcyberpark.com", "/jobs/index/"):
                    raise ValueError("UL CyberPark returned an unexpected pagination URL")
        return jobs[(page - 1) * limit:target]

    async def get_job_details(self, detail_url: str) -> ScrapedJob | None:
        if not valid_url(detail_url, "www.ulcyberpark.com", "/jobs/job_vacancy"):
            return None
        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
            return await self._details(client, detail_url)

    async def _details(self, client: httpx.AsyncClient, url: str) -> ScrapedJob:
        response = await client.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        content = soup.select_one(".job_border")
        title = text(content.select_one(".main_title_head")) if content else ""
        source_id = parse_qs(urlsplit(url).query).get("job_id", [""])[0]
        if not content or not title or not source_id:
            raise ValueError("UL CyberPark job detail structure was not recognized")
        sections = {}
        for heading in content.select("h2.job_title"):
            sections[text(heading).casefold()] = text(heading.find_next_sibling("ul"))
        return ScrapedJob(
            source=self.SOURCE_NAME, source_job_id=source_id, title=title,
            company="Company not listed", location="Kozhikode (UL CyberPark)",
            job_url=url, detail_url=url, description=sections.get("job description"),
            requirements=sections.get("job skills"),
            contact_email=job_email(content.select_one(".email_title")) or job_email(content.select_one(".c2_left_padd")),
        )
