from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy import update
from app.models.application import Application
from app.models.email_settings import EmailSettings
from app.services.scheduled_email import dispatch_due


@pytest.mark.asyncio
async def test_schedule_validation_cancel_and_delivery(client, db_session, user_a, user_b):
    from uuid import uuid4
    headers = user_a["headers"]
    job = (await client.post("/api/jobs/manual", headers=headers, json={
        "request_id": str(uuid4()), "role": "Engineer", "email": "hr@example.com",
        "description": "Build APIs",
    })).json()
    app = (await client.post("/api/applications", headers=headers, json={
        "job_id": job["id"], "email_subject": "Application", "cover_letter_content": "Hello recruiter",
    })).json()
    path = f"/api/applications/{app['id']}/schedule"
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    assert (await client.post(path, headers=headers, json={"scheduled_at": future})).status_code == 400
    db_session.add(EmailSettings(user_id=user_a["user"].id, smtp_host="smtp.example.com",
        smtp_port=587, smtp_username="me@example.com", smtp_password="test",
        from_email="me@example.com", use_tls=True))
    await db_session.commit()
    assert (await client.post(path, headers=user_b["headers"], json={"scheduled_at": future})).status_code == 404
    for value in ["2020-01-01T00:00:00Z", "2099-01-01T00:00:00"]:
        assert (await client.post(path, headers=headers, json={"scheduled_at": value})).status_code == 422
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock, return_value=(True, "Sent")) as send:
        response = await client.post(path, headers=headers, json={"scheduled_at": future})
        assert response.status_code == 200
        assert response.json()["status"] == "scheduled"
        assert response.json()["scheduled_at"]
        await dispatch_due(db_session)
        send.assert_not_called()
        assert (await client.post(path, headers=headers, json={"scheduled_at": future})).status_code == 409
        assert (await client.put(f"/api/applications/{app['id']}", headers=headers, json={"email_subject": "Changed"})).status_code == 409
        assert (await client.post(f"/api/applications/{app['id']}/send", headers=headers)).status_code == 409
        cancelled = await client.delete(path, headers=headers)
        assert cancelled.json()["status"] == "ready"
        assert cancelled.json()["scheduled_at"] is None
        await dispatch_due(db_session)
        send.assert_not_called()
        assert (await client.post(path, headers=headers, json={"scheduled_at": future})).status_code == 200
        await db_session.execute(update(Application).where(Application.id == app["id"]).values(
            scheduled_at=datetime.now(timezone.utc)-timedelta(seconds=1)))
        await db_session.commit()
        await dispatch_due(db_session)
        await dispatch_due(db_session)
        send.assert_awaited_once()
        assert send.call_args.kwargs["to_email"] == "hr@example.com"
        delivered = await client.get(f"/api/applications/{app['id']}", headers=headers)
        assert delivered.json()["status"] == "sent"
