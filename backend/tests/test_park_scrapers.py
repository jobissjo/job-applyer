from urllib.parse import parse_qs
from unittest.mock import patch

import httpx
import pytest
from sqlalchemy import select

from app.models.job import Job
from app.services.scraper.cyberpark import CyberparkScraper
from app.services.scraper.ulcyberpark import ULCyberparkScraper
from app.services.scraper.registry import get_scraper


# Compact fixtures follow the public pages' observed markup, with fictional content.
CYBER_ROWS = '''<li class="job_listing"><a href="https://cyberparks.in/job/test-python/">
<div class="position"><h3>Python Engineer</h3><div class="company"><strong>Example Co</strong></div></div>
<div class="location">Kozhikode</div><time datetime="2026-10-01"></time></a></li>'''
CYBER_DETAIL = '''<div class="single_job_listing"><h3 class="entry-title">Python Engineer</h3>
<div class="company"><strong>Example Co</strong></div><div class="location">Kozhikode</div>
<time datetime="2026-10-01"></time><div class="job_description">Build Python APIs.</div>
<div class="application_details"><a href="mailto:jobs%40example.com?subject=Engineer">Apply</a></div></div>
<footer>info@cyberparks.in</footer>'''


def ul_row(job_id, company="Example Co"):
    return f'''<tr><td><a>Engineer</a><span>closing date: 31-12-2026</span></td>
    <td><a href="http://info@example.com">{company}</a></td>
    <td><a href="/jobs/job_vacancy?job_id={job_id}">View Details</a></td></tr>'''


def ul_list(rows, next_page=False):
    pager = '<div class="pagination"><a rel="next" href="/jobs/index/10">Next</a></div>' if next_page else ''
    return '<div class="table-job"><table>' + rows + '</table></div>' + pager


def ul_detail(title="Engineer", description="Build Python services", skills="SQL", contact=True):
    email = '<h4 class="email_title">Email: <a href="mailto:talent@example.com">Apply</a></h4>' if contact else ''
    return f'''<main><div class="job_border"><h2 class="main_title_head">{title}</h2>{email}
    <div class="c2_left_padd"><h2 class="job_title">Job Description</h2><ul><li>{description}</li></ul>
    <h2 class="job_title">Job Skills</h2><ul><li>{skills}</li></ul></div></div></main>
    <footer>info@ulcyberpark.com</footer>'''


def mock_client(handler):
    real_client = httpx.AsyncClient
    return patch("httpx.AsyncClient", side_effect=lambda **kwargs: real_client(
        **kwargs, transport=httpx.MockTransport(handler),
    ))


@pytest.mark.asyncio
async def test_cyberpark_search_details_pagination_and_stable_ids():
    def handler(request):
        if request.method == "POST":
            fields = parse_qs(request.content.decode())
            assert fields["search_keywords"] == ["python"]
            assert fields["page"] == ["2"]
            assert fields["per_page"] == ["3"]
            return httpx.Response(200, json={"found_jobs": True, "html": CYBER_ROWS + CYBER_ROWS})
        return httpx.Response(200, text=CYBER_DETAIL)

    scraper = CyberparkScraper()
    with mock_client(handler):
        jobs = await scraper.search("python", page=2, limit=3)
        detail = await scraper.get_job_details(jobs[0].detail_url)
    assert len(jobs) == 1
    job = jobs[0]
    assert job.source == "cyberpark"
    assert job.company == "Example Co"
    assert job.description == "Build Python APIs."
    assert job.contact_email == "jobs@example.com"
    assert job.posted_date == "2026-10-01"
    assert job.source_job_id == detail.source_job_id


@pytest.mark.asyncio
async def test_cyberpark_no_matches_and_no_footer_contact():
    with mock_client(lambda r: httpx.Response(200, json={"found_jobs": False, "html": ""})):
        assert await CyberparkScraper().search("nonexistent") == []
    html = CYBER_DETAIL.replace('<a href="mailto:jobs%40example.com?subject=Engineer">Apply</a>', '')
    with mock_client(lambda r: httpx.Response(200, text=html)):
        job = await CyberparkScraper().get_job_details("https://cyberparks.in/job/test-python/")
    assert job.contact_email is None


@pytest.mark.asyncio
async def test_ul_searches_later_pages_and_paginates_matches():
    visited = []

    def handler(request):
        visited.append(request.url.path)
        if request.url.path == "/jobs":
            return httpx.Response(200, text=ul_list(ul_row(1) + ul_row(2), next_page=True))
        if request.url.path == "/jobs/index/10":
            return httpx.Response(200, text=ul_list(ul_row(3, "Later Company") + ul_row(3)))
        job_id = request.url.params["job_id"]
        if job_id == "1":
            return httpx.Response(200, text=ul_detail(description="Design websites", skills="CSS"))
        return httpx.Response(200, text=ul_detail(skills="Python SQL", contact=job_id != "3"))

    with mock_client(handler):
        jobs = await ULCyberparkScraper().search("PYTHON sql", page=2, limit=1)
    assert len(jobs) == 1
    assert jobs[0].source == "ulcyberpark"
    assert jobs[0].source_job_id == "3"
    assert jobs[0].company == "Later Company"
    assert jobs[0].requirements == "Python SQL"
    assert jobs[0].contact_email is None  # Neither park footer nor company URL is a recruiter contact.
    assert "/jobs/index/10" in visited


@pytest.mark.asyncio
async def test_ul_company_keyword_and_unmatched_search():
    def handler(request):
        html = ul_list(ul_row(7, "Searchable Company")) if request.url.path == "/jobs" else ul_detail()
        return httpx.Response(200, text=html)

    with mock_client(handler):
        jobs = await ULCyberparkScraper().search("searchable")
        assert await ULCyberparkScraper().search("nonexistent") == []
    assert len(jobs) == 1
    assert jobs[0].contact_email == "talent@example.com"
    assert jobs[0].job_url.endswith("job_id=7")


@pytest.mark.asyncio
@pytest.mark.parametrize("scraper", [CyberparkScraper, ULCyberparkScraper])
async def test_fetch_errors_never_generate_jobs(scraper):
    with mock_client(lambda r: httpx.Response(503)):
        with pytest.raises(httpx.HTTPStatusError):
            await scraper().search("python")
    assert await scraper().get_job_details("https://unrelated.example/job/1") is None
    with pytest.raises(ValueError):
        await scraper().search(page=0)


@pytest.mark.asyncio
@pytest.mark.parametrize("scraper,body", [
    (CyberparkScraper, '{"found_jobs": true, "html": "<div>changed layout</div>"}'),
    (ULCyberparkScraper, '<html>Maintenance</html>'),
])
async def test_unrecognized_markup_is_reported(scraper, body):
    with mock_client(lambda r: httpx.Response(200, text=body)):
        with pytest.raises(ValueError):
            await scraper().search()


@pytest.mark.asyncio
@pytest.mark.parametrize("source", ["cyberpark", "ulcyberpark", "smartcity"])
async def test_new_sources_upsert_and_filter(client, db_session, user_a, source):
    from app.services.scraper.base import ScrapedJob
    from scripts.scraper_utils import upsert_scraped_jobs
    from tests.conftest import TestSessionLocal

    job = ScrapedJob(source=source, source_job_id="repeatable-id", title="Python Engineer",
                     company="Example Co", description="Build APIs", job_url="https://example.com/job")
    with (patch("scripts.scraper_utils.init_db", return_value=None),
          patch("scripts.scraper_utils.AsyncSessionLocal", TestSessionLocal)):
        assert await upsert_scraped_jobs([job]) == (1, 0)
        job.title = "Senior Python Engineer"
        assert await upsert_scraped_jobs([job]) == (0, 1)
    response = await client.get("/api/jobs", params={"source": source, "query": "Python"}, headers=user_a["headers"])
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["title"] == "Senior Python Engineer"
    stored = (await db_session.execute(select(Job).where(Job.source == source))).scalars().all()
    assert len(stored) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"source": "unknown"}, {"page": 0}, {"limit": 0}, {"limit": 21}])
async def test_invalid_auto_search_rejected_before_pipeline(client, user_a, payload):
    with patch("app.services.auto_apply_service.AutoApplyService.run_pipeline") as pipeline:
        response = await client.post("/api/auto-apply", json=payload, headers=user_a["headers"])
    assert response.status_code == 422
    pipeline.assert_not_called()


def test_registry_resolves_new_sources():
    assert isinstance(get_scraper(" Cyberpark "), CyberparkScraper)
    assert isinstance(get_scraper("ulcyberpark"), ULCyberparkScraper)
    with pytest.raises(ValueError):
        get_scraper("unknown")
