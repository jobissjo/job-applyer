from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import update

from app.models.application import Application
from app.models.email_settings import EmailSettings
from app.models.job import Job
from app.models.resume import Resume
from app.services.scheduled_email import dispatch_due


@pytest.mark.asyncio
@pytest.mark.parametrize("scheduled", [False, True])
@pytest.mark.parametrize("source", ["technopark", "infopark", "cyberpark", "ulcyberpark", "smartcity"])
async def test_auto_apply_requires_selection_and_approval(
    client, db_session, user_a, user_b, sample_job, sample_job_no_hr, tmp_path, scheduled, source,
):
    resume_file = tmp_path / "resume.pdf"
    resume_file.write_bytes(b"test resume")
    resume = Resume(user_id=user_a["user"].id, title="Engineer resume",
                    file_name="resume.pdf", file_path=str(resume_file), active=True)
    other_job = Job(source="infopark", source_job_id=uuid4().hex,
                    title="Other engineer", company="Other company", job_url="",
                    description="Build APIs", contact_email="other@example.com")
    db_session.add_all([resume, other_job, EmailSettings(
        user_id=user_a["user"].id, smtp_host="smtp.example.com", smtp_port=587,
        smtp_username="me@example.com", smtp_password="test",
        from_email="me@example.com", use_tls=True,
    )])
    await db_session.commit()
    scraped = [SimpleNamespace(source=job.source, source_job_id=job.source_job_id)
               for job in [sample_job, other_job, sample_job_no_hr]]
    analysis = SimpleNamespace(job_title="Engineer", job_title_id=None,
                               recommended_resume_id=resume.id)
    headers = user_a["headers"]
    with (
        patch.dict("app.services.scraper.registry.SCRAPERS", {
            source: type("TestScraper", (), {"SOURCE_NAME": source, "search": AsyncMock(return_value=scraped)}),
        }),
        patch("app.services.auto_apply_service.upsert_scraped_jobs", new_callable=AsyncMock),
        patch("app.services.application_service.ApplicationService.analyze_job", new_callable=AsyncMock, return_value=analysis),
        patch("app.services.application_service.LLMManager.generate_with_failover", new_callable=AsyncMock, return_value="My introduction"),
        patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock, return_value=(True, "Sent")) as send,
    ):
        response = await client.post("/api/auto-apply", headers=headers,
                                     json={"source": source, "search_query": "engineer"})
        assert response.status_code == 200
        report = response.json()
        assert report["applied_count"] == 0
        assert report["ready_count"] == 2
        assert report["hr_required_count"] == 1
        send.assert_not_called()
        selected, unselected, missing_contact = report["jobs"]
        assert selected["email_subject"]
        assert selected["cover_letter_text"] == "My introduction"
        assert missing_contact["status"] == "hr_contact_required"
        selected_id = selected["application_id"]
        path = f"/api/applications/{selected_id}/" + ("schedule" if scheduled else "send")
        future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        payload = {"scheduled_at": future} if scheduled else None
        assert (await client.post(path, headers=user_b["headers"], json=payload)).status_code == 404
        approved = await client.post(path, headers=headers, json=payload)
        assert approved.status_code == 200
        assert approved.json()["status"] == ("scheduled" if scheduled else "sent")
        untouched = await client.get(f"/api/applications/{unselected['application_id']}", headers=headers)
        assert untouched.json()["status"] == "ready"

        # A later search must preserve the approved application and its content.
        repeat = await client.post("/api/auto-apply", headers=headers,
                                   json={"source": source, "search_query": "engineer"})
        assert repeat.json()["jobs"][0]["status"] == ("scheduled" if scheduled else "sent")
        assert repeat.json()["jobs"][0]["application_id"] == selected_id
        if scheduled:
            await dispatch_due(db_session)
            send.assert_not_called()
            await db_session.execute(update(Application).where(Application.id == selected_id).values(
                scheduled_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
            await db_session.commit()
            await dispatch_due(db_session)
            await dispatch_due(db_session)
        send.assert_awaited_once()
        assert send.call_args.kwargs["to_email"] == sample_job.contact_email
        assert (await client.post(path, headers=headers, json=payload)).status_code == (409 if scheduled else 400)
