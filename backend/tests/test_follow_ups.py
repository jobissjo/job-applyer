from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, patch

import pytest

from app.models.application import Application
from app.models.email_settings import EmailSettings
from app.models.resume import Resume


@pytest.fixture
def payload():
    return {"request_id": str(uuid4()), "subject": "A quick follow-up", "body": "Hello, is there an update on my application?", "attach_resume": False}


async def original(db, user, job, sent=True):
    application = Application(
        user_id=user["user"].id,
        job_id=job.id,
        status="sent" if sent else "ready",
        email_subject="Original application",
        sent_to="original.recruiter@example.com" if sent else None,
        sent_at=datetime.now(timezone.utc) if sent else None,
        notes="Original notes",
    )
    db.add(application)
    db.add(EmailSettings(
        user_id=user["user"].id,
        smtp_host="smtp.example.com", smtp_port=587,
        smtp_username="candidate@example.com", smtp_password="test-password",
        from_email="candidate@example.com", use_tls=True,
    ))
    await db.commit()
    return application


@pytest.mark.asyncio
async def test_follow_up_send_history_and_idempotency(client, db_session, user_a, sample_job, payload):
    application = await original(db_session, user_a, sample_job)
    initial_time = application.sent_at
    path = f"/api/applications/{application.id}/follow-ups"
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock, return_value=(True, "Sent")) as send:
        result = await client.post(path, json=payload, headers=user_a["headers"])
        assert result.status_code == 200
        data = result.json()
        assert data["status"] == "sent"
        assert data["recipient"] == "original.recruiter@example.com"
        assert data["sent_at"].endswith("Z")
        assert send.call_args.kwargs["cover_letter_text"] == payload["body"]
        assert send.call_args.kwargs["subject"] == payload["subject"]
        assert send.call_args.kwargs["to_email"] == "original.recruiter@example.com"
        assert send.call_args.kwargs["resume_path"] is None
        repeat = await client.post(path, json=payload, headers=user_a["headers"])
        assert repeat.status_code == 200
        assert repeat.json()["id"] == data["id"]
        assert send.await_count == 1
        # A new intentional follow-up uses a new request ID.
        next_payload = {**payload, "request_id": str(uuid4()), "body": "Another check-in"}
        second = await client.post(path, json=next_payload, headers=user_a["headers"])
        assert second.status_code == 200
        assert second.json()["id"] != data["id"]
        assert send.await_count == 2
    history = await client.get(path, headers=user_a["headers"])
    assert history.status_code == 200
    assert len(history.json()) == 2
    assert history.json()[0]["body"] == "Another check-in"
    await db_session.refresh(application)
    assert application.status == "sent"
    assert application.sent_at.replace(tzinfo=timezone.utc) == initial_time.replace(tzinfo=timezone.utc)
    assert application.email_subject == "Original application"
    assert application.notes == "Original notes"


@pytest.mark.asyncio
async def test_follow_up_failure_is_recorded(client, db_session, user_a, sample_job, payload):
    application = await original(db_session, user_a, sample_job)
    path = f"/api/applications/{application.id}/follow-ups"
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock, return_value=(False, "SMTP unavailable")):
        response = await client.post(path, json=payload, headers=user_a["headers"])
    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["sent_at"] is None
    assert response.json()["error_message"] == "SMTP unavailable"
    history = await client.get(path, headers=user_a["headers"])
    assert history.json()[0]["status"] == "failed"
    await db_session.refresh(application)
    assert application.status == "sent"


@pytest.mark.asyncio
async def test_follow_up_rejects_unsent_application(client, db_session, user_a, sample_job, payload):
    application = await original(db_session, user_a, sample_job, sent=False)
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock) as send:
        response = await client.post(f"/api/applications/{application.id}/follow-ups", json=payload, headers=user_a["headers"])
    assert response.status_code == 400
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_follow_up_user_isolation(client, db_session, user_a, user_b, sample_job, payload):
    application = await original(db_session, user_a, sample_job)
    path = f"/api/applications/{application.id}/follow-ups"
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock) as send:
        response = await client.post(path, json=payload, headers=user_b["headers"])
    assert response.status_code == 404
    assert (await client.get(path, headers=user_b["headers"])).status_code == 404
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_follow_up_requires_email_connection(client, user_a, sample_job, db_session, payload):
    application = Application(user_id=user_a["user"].id, job_id=sample_job.id, status="sent", sent_to="hr@example.com")
    db_session.add(application)
    await db_session.commit()
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock) as send:
        response = await client.post(f"/api/applications/{application.id}/follow-ups", json=payload, headers=user_a["headers"])
    assert response.status_code == 400
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_follow_up_attachment_must_exist(client, db_session, user_a, sample_job, payload):
    application = await original(db_session, user_a, sample_job)
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock) as send:
        response = await client.post(f"/api/applications/{application.id}/follow-ups", json={**payload, "attach_resume": True}, headers=user_a["headers"])
    assert response.status_code == 400
    send.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [{"subject": "  "}, {"body": "\n "}, {"subject": "Hello\nBcc: injected@example.com"}])
async def test_follow_up_validates_message(client, user_a, sample_job, db_session, payload, changes):
    application = await original(db_session, user_a, sample_job)
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock) as send:
        response = await client.post(f"/api/applications/{application.id}/follow-ups", json={**payload, **changes}, headers=user_a["headers"])
    assert response.status_code == 422
    send.assert_not_awaited()

@pytest.mark.asyncio
async def test_follow_up_can_attach_original_resume(client, db_session, user_a, sample_job, payload, tmp_path):
    application = await original(db_session, user_a, sample_job)
    resume_file = tmp_path / "candidate.pdf"
    resume_file.write_bytes(b"%PDF-test")
    resume = Resume(
        user_id=user_a["user"].id, title="My resume",
        file_name="candidate.pdf", file_path=str(resume_file),
        resume_type="pdf", active=True,
    )
    db_session.add(resume)
    await db_session.flush()
    application.resume_id = resume.id
    await db_session.commit()
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock, return_value=(True, "Sent")) as send:
        response = await client.post(
            f"/api/applications/{application.id}/follow-ups",
            json={**payload, "attach_resume": True}, headers=user_a["headers"],
        )
    assert response.status_code == 200
    assert response.json()["attach_resume"] is True
    assert send.call_args.kwargs["resume_path"] == str(resume_file)
    assert send.call_args.kwargs["attachment_filename"] == "User A_(Python Engineer).pdf"
