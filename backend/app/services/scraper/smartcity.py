"""Company vacancies published on SmartCity Kochi's job-openings page."""
import asyncio
import hashlib
import re
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup

from app.services.scraper.base import BaseScraper, ScrapedJob
from app.services.scraper.park_utils import job_email, matches, positive_paging, text


class SmartCityScraper(BaseScraper):
    SOURCE_NAME = "smartcity"
    BASE_URL = "https://smartcity-kochi.in"
    SEARCH_URL = f"{BASE_URL}/media-hub/job-openings/"

    @classmethod
    def _job_url(cls, url: str) -> str | None:
        parsed = urlsplit(url)
        if (parsed.scheme != "https" or parsed.netloc != "smartcity-kochi.in"
                or not re.fullmatch(r"/\d{4}/\d{2}/[^/]+/?", parsed.path)):
            return None
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path.rstrip("/") + "/", "", ""))

    @staticmethod
    def _role_and_company(heading: str) -> tuple[str, str]:
        parts = [part.strip() for part in heading.split("|")]
        if len(parts) >= 3:
            if "smartcity" in parts[1].casefold().replace(" ", ""):
                return " | ".join(parts[2:]), parts[0]
            return parts[0], parts[1]
        # Older posts use "Role @ Company, SmartCity Kochi" or "Role at Company".
        parts = re.split(r"\s+(?:@|at)\s+", heading, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2:
            company = re.split(r",\s*smart\s*city", parts[1], flags=re.IGNORECASE)[0]
            return parts[0].strip(), company.strip()
        return heading, "Company not listed"

    async def search(self, query: str = "", page: int = 1, limit: int = 20) -> list[ScrapedJob]:
        """Read published posts, filter their content, then paginate matching jobs."""
        positive_paging(page, limit)
        jobs = []
        seen_jobs = set()
        seen_pages = set()
        next_url = self.SEARCH_URL
        target = page * limit
        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
            semaphore = asyncio.Semaphore(4)

            async def details(url):
                async with semaphore:
                    return await self._details(client, url)

            while next_url and next_url not in seen_pages:
                seen_pages.add(next_url)
                response = await client.get(next_url)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, "html.parser")
                listings = soup.select_one("main .vcex-recent-news-wrap")
                if listings is None:
                    raise ValueError("SmartCity Kochi job listing structure was not recognized")
                urls = []
                for row in listings.select("article.category-job_openings"):
                    anchor = row.select_one(".entry-title a[href]")
                    if not anchor:
                        continue
                    url = self._job_url(urljoin(self.BASE_URL, anchor["href"]))
                    if url and url not in seen_jobs:
                        seen_jobs.add(url)
                        urls.append(url)
                for job in await asyncio.gather(*(details(url) for url in urls)):
                    if matches(job, query):
                        jobs.append(job)
                if len(jobs) >= target:
                    break
                next_link = soup.select_one("main a.next.page-numbers, main .vcex-recent-news-wrap a.next")
                next_url = urljoin(self.BASE_URL, next_link["href"]) if next_link else None
                if next_url:
                    parsed = urlsplit(next_url)
                    if (parsed.scheme != "https" or parsed.netloc != "smartcity-kochi.in"
                            or not parsed.path.startswith("/media-hub/job-openings/")):
                        raise ValueError("SmartCity Kochi returned an unexpected pagination URL")
        return jobs[(page - 1) * limit:target]

    async def get_job_details(self, detail_url: str) -> ScrapedJob | None:
        url = self._job_url(detail_url)
        if not url:
            return None
        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
            return await self._details(client, url)

    async def _details(self, client: httpx.AsyncClient, url: str) -> ScrapedJob:
        response = await client.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        content = soup.select_one("main article.single-blog-article .single-content")
        heading = text(content.select_one("h1")) if content else ""
        blocks = content.select(".wpb_text_column") if content else []
        description = "\n".join(filter(None, (text(block) for block in blocks)))
        if not heading or not description:
            raise ValueError("SmartCity Kochi job detail structure was not recognized")
        title, company = self._role_and_company(heading)
        # Restrict all contact extraction to the post's text blocks, excluding park contacts.
        job_content = BeautifulSoup("".join(str(block) for block in blocks), "html.parser")
        contact_name = None
        for paragraph in job_content.select("p"):
            match = re.search(r"Contact Person\s*:\s*(.+?)(?=\s+Email\s*:|$)", text(paragraph), re.IGNORECASE)
            if match:
                contact_name = match.group(1).strip()
                break
        posted = soup.select_one('meta[property="article:published_time"]')
        return ScrapedJob(
            source=self.SOURCE_NAME,
            source_job_id=hashlib.sha256(url.encode()).hexdigest()[:24],
            title=title, company=company, location="Kochi (SmartCity)",
            job_url=url, detail_url=url, description=description,
            contact_email=job_email(job_content), contact_name=contact_name,
            posted_date=posted.get("content") if posted else None,
        )
