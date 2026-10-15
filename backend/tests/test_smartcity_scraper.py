from unittest.mock import patch

import httpx
import pytest

from app.services.scraper.cyberpark import CyberparkScraper
from app.services.scraper.infopark import InfoparkScraper
from app.services.scraper.smartcity import SmartCityScraper
from app.services.scraper.technopark import TechnoparkScraper
from app.services.scraper.ulcyberpark import ULCyberparkScraper
from app.services.scraper.registry import get_scraper


def listing(slugs, next_page=False):
    rows = ''.join(f'''<article class="category-job_openings"><h2 class="entry-title">
        <a href="/2026/07/{slug}/">Job heading</a></h2></article>''' for slug in slugs)
    pager = '<a class="next page-numbers" href="/media-hub/job-openings/page/2/">Next</a>' if next_page else ''
    return f'<main><div class="vcex-recent-news-wrap">{rows}</div>{pager}</main>'


def detail(heading="Example Co | SmartCity Kochi | Backend Engineer", body="Build Python APIs", contact=True):
    recruiter = '<p>Contact Person: Example Recruiter<br>Email: <a href="mailto:jobs@example.com">Apply</a></p>' if contact else ''
    return f'''<head><meta property="article:published_time" content="2026-07-03T09:48:53+00:00"></head>
    <header>info@smartcity-kochi.in</header><main><article class="single-blog-article">
    <div class="single-content"><h1>{heading}</h1><div class="wpb_text_column"><div class="wpb_wrapper">
    <p>{body}</p>{recruiter}</div></div></div></article>
    <aside>sidebar@example.com</aside></main><footer>info@smartcity-kochi.in</footer>'''


def mock_client(handler):
    real = httpx.AsyncClient
    return patch("httpx.AsyncClient", side_effect=lambda **kwargs: real(
        **kwargs, transport=httpx.MockTransport(handler),
    ))


@pytest.mark.asyncio
async def test_keywords_in_descriptions_later_pages_and_stable_ids():
    def handler(request):
        path = request.url.path
        if path == "/media-hub/job-openings/":
            return httpx.Response(200, text=listing(["designer"], next_page=True))
        if path == "/media-hub/job-openings/page/2/":
            return httpx.Response(200, text=listing(["backend", "backend"]))
        return httpx.Response(200, text=detail(body="Design in Figma" if "designer" in path else "Build Python SQL APIs"))

    scraper = SmartCityScraper()
    with mock_client(handler):
        jobs = await scraper.search("python SQL", limit=1)
        repeated = await scraper.search("python SQL", limit=1)
        job_detail = await scraper.get_job_details(jobs[0].job_url + "?utm_source=test")
        assert await scraper.search("nonexistent") == []
    assert len(jobs) == 1
    job = jobs[0]
    assert job.source == "smartcity"
    assert job.title == "Backend Engineer"
    assert job.company == "Example Co"
    assert job.posted_date == "2026-07-03T09:48:53+00:00"
    assert job.contact_email == "jobs@example.com"
    assert job.contact_name == "Example Recruiter"
    assert job.source_job_id == repeated[0].source_job_id == job_detail.source_job_id


@pytest.mark.asyncio
async def test_filter_before_result_pagination_and_company_search():
    def handler(request):
        if request.url.path == "/media-hub/job-openings/":
            return httpx.Response(200, text=listing(["one", "two", "three"]))
        return httpx.Response(200, text=detail(heading="Developer | Searchable Company | Smartcity Kochi"))

    with mock_client(handler):
        jobs = await SmartCityScraper().search("searchable", page=2, limit=1)
        assert await SmartCityScraper().search("searchable", page=4, limit=1) == []
    assert len(jobs) == 1
    assert jobs[0].detail_url.endswith("/two/")
    assert jobs[0].title == "Developer"
    assert jobs[0].company == "Searchable Company"


@pytest.mark.asyncio
async def test_missing_recruiter_does_not_use_park_or_sidebar_email():
    with mock_client(lambda r: httpx.Response(200, text=detail(contact=False))):
        job = await SmartCityScraper().get_job_details("https://smartcity-kochi.in/2026/07/backend/")
    assert job.contact_email is None
    assert "sidebar@example.com" not in job.description
    assert "info@smartcity-kochi.in" not in job.description


@pytest.mark.parametrize("heading,role,company", [
    ("Cyncly | SmartCity Kochi | Engineer", "Engineer", "Cyncly"),
    ("Java Developer | Example Co | Smartcity Kochi", "Java Developer", "Example Co"),
    ("CRM Developer @ Example Co, SmartCity Kochi", "CRM Developer", "Example Co"),
    ("DB Developer at Example Co, SmartCity Kochi", "DB Developer", "Example Co"),
])
def test_company_and_role_in_current_and_older_headings(heading, role, company):
    assert SmartCityScraper._role_and_company(heading) == (role, company)


@pytest.mark.asyncio
async def test_empty_results_and_fetch_or_layout_errors_are_distinct():
    scraper = SmartCityScraper()
    with mock_client(lambda r: httpx.Response(200, text=listing([]))):
        assert await scraper.search() == []
    with mock_client(lambda r: httpx.Response(503)):
        with pytest.raises(httpx.HTTPStatusError):
            await scraper.search()
    with mock_client(lambda r: httpx.Response(200, text="<main>Maintenance</main>")):
        with pytest.raises(ValueError):
            await scraper.search()
        with pytest.raises(ValueError):
            await scraper.get_job_details("https://smartcity-kochi.in/2026/07/backend/")
    with pytest.raises(ValueError):
        await scraper.search(page=0)


@pytest.mark.asyncio
async def test_unrelated_links_are_never_fetched():
    rows = listing(["backend"]).replace("/2026/07/backend/", "https://unrelated.example/2026/07/backend/")
    with mock_client(lambda r: httpx.Response(200, text=rows)) as client:
        assert await SmartCityScraper().search() == []
        assert await SmartCityScraper().get_job_details("https://unrelated.example/2026/07/backend/") is None
        assert await SmartCityScraper().get_job_details("https://smartcity-kochi.in/contact-us/") is None
    assert client.call_count == 1


def test_existing_source_classes_and_new_source_are_registered():
    for source, cls in {
        "technopark": TechnoparkScraper, "infopark": InfoparkScraper,
        "cyberpark": CyberparkScraper, "ulcyberpark": ULCyberparkScraper,
        "smartcity": SmartCityScraper,
    }.items():
        assert type(get_scraper(source)) is cls
