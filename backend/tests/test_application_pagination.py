from datetime import datetime

import pytest

from app.models.application import Application


@pytest.mark.asyncio
async def test_application_pages_are_bounded_filtered_and_private(client, db_session, user_a, user_b, sample_job):
    # Equal timestamps exercise the stable ID tie breaker across page boundaries.
    created = datetime(2026, 10, 1)
    apps = [Application(user_id=user_a["user"].id, job_id=sample_job.id,
                        status="sent" if i < 11 else "draft", created_at=created)
            for i in range(13)]
    other = Application(user_id=user_b["user"].id, job_id=sample_job.id, status="sent")
    db_session.add_all([*apps, other])
    await db_session.commit()
    headers = user_a["headers"]
    expected = sorted((app.id for app in apps), reverse=True)
    first = (await client.get("/api/applications?page=1&limit=10", headers=headers)).json()
    assert first["total"] == 13
    assert first["page"] == 1 and first["limit"] == 10 and first["has_next"] is True
    assert [app["id"] for app in first["items"]] == expected[:10]
    second = (await client.get("/api/applications?page=2&limit=10", headers=headers)).json()
    assert second["total"] == 13 and second["has_next"] is False
    assert [app["id"] for app in second["items"]] == expected[10:]
    filtered = (await client.get("/api/applications?page=2&limit=10&status=sent", headers=headers)).json()
    assert filtered["total"] == 11 and len(filtered["items"]) == 1
    assert filtered["items"][0]["status"] == "sent"
    empty = (await client.get("/api/applications?page=9&limit=10", headers=headers)).json()
    assert empty["items"] == [] and empty["total"] == 13 and empty["has_next"] is False
    no_matches = (await client.get("/api/applications?page=1&status=failed", headers=headers)).json()
    assert no_matches["items"] == [] and no_matches["total"] == 0
    # Existing mobile clients can continue using the original list response.
    legacy = (await client.get("/api/applications", headers=headers)).json()
    assert [app["id"] for app in legacy] == expected


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["page=0", "page=-1", "page=abc", "page=1&limit=0", "page=1&limit=101"])
async def test_application_page_validation(client, user_a, query):
    response = await client.get(f"/api/applications?{query}", headers=user_a["headers"])
    assert response.status_code == 422
