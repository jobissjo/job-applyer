import pytest


@pytest.mark.asyncio
async def test_job_title_isolation(client, user_a, user_b):
    # User A creates a job title
    create_resp = await client.post(
        "/api/job-titles",
        json={"title": "Python Specialist", "active": True},
        headers=user_a["headers"]
    )
    assert create_resp.status_code == 201
    title_id = create_resp.json()["id"]

    # User B lists job titles -> should NOT see User A's title
    b_list = await client.get("/api/job-titles", headers=user_b["headers"])
    assert b_list.status_code == 200
    b_ids = [t["id"] for t in b_list.json()]
    assert title_id not in b_ids

    # User B attempts to edit User A's job title -> 404
    b_edit = await client.put(
        f"/api/job-titles/{title_id}",
        json={"title": "Hacked Title"},
        headers=user_b["headers"]
    )
    assert b_edit.status_code == 404

    # User B attempts to delete User A's job title -> 404
    b_del = await client.delete(
        f"/api/job-titles/{title_id}",
        headers=user_b["headers"]
    )
    assert b_del.status_code == 404


@pytest.mark.asyncio
async def test_llm_provider_isolation(client, user_a, user_b):
    # User A creates an LLM provider
    create_resp = await client.post(
        "/api/llm-providers",
        json={
            "provider": "openrouter",
            "api_key": "sk-or-secret-key-user-a",
            "model": "meta-llama/llama-3.3-70b-instruct",
            "priority": 1
        },
        headers=user_a["headers"]
    )
    assert create_resp.status_code == 201
    provider_id = create_resp.json()["id"]

    # User B lists LLM providers -> should NOT see User A's provider
    b_list = await client.get("/api/llm-providers", headers=user_b["headers"])
    assert b_list.status_code == 200
    b_ids = [p["id"] for p in b_list.json()]
    assert provider_id not in b_ids

    # User B attempts to edit User A's provider -> 404
    b_edit = await client.put(
        f"/api/llm-providers/{provider_id}",
        json={"model": "injected-model"},
        headers=user_b["headers"]
    )
    assert b_edit.status_code == 404


@pytest.mark.asyncio
async def test_application_and_hr_isolation(client, user_a, user_b, sample_job):
    # User A creates an application
    app_resp = await client.post(
        "/api/applications",
        json={"job_id": sample_job.id, "email_subject": "User A Application"},
        headers=user_a["headers"]
    )
    assert app_resp.status_code == 201
    app_id = app_resp.json()["id"]

    # User B lists applications -> User A's application not in list
    b_apps = await client.get("/api/applications", headers=user_b["headers"])
    assert b_apps.status_code == 200
    b_app_ids = [a["id"] for a in b_apps.json()]
    assert app_id not in b_app_ids

    # User B attempts to view or send User A's application -> 404
    b_get = await client.get(f"/api/applications/{app_id}", headers=user_b["headers"])
    assert b_get.status_code == 404

    b_send = await client.post(f"/api/applications/{app_id}/send", headers=user_b["headers"])
    assert b_send.status_code == 404
