import pytest


@pytest.mark.asyncio
async def test_register_and_login(client):
    # Register new user
    reg_resp = await client.post(
        "/api/auth/register",
        json={"email": "newuser@example.com", "password": "SuperSecretPassword123!"}
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data

    # Attempt duplicate registration
    dup_resp = await client.post(
        "/api/auth/register",
        json={"email": "newuser@example.com", "password": "AnotherPassword!"}
    )
    assert dup_resp.status_code == 400

    # Login with valid credentials
    login_resp = await client.post(
        "/api/auth/login",
        json={"email": "newuser@example.com", "password": "SuperSecretPassword123!"}
    )
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # Access /api/auth/me
    me_resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "newuser@example.com"

    # Login with invalid password
    bad_login = await client.post(
        "/api/auth/login",
        json={"email": "newuser@example.com", "password": "WrongPassword"}
    )
    assert bad_login.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_stats_endpoint(client, user_a):
    stats_resp = await client.get("/api/dashboard-stats", headers=user_a["headers"])
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "total_jobs" in stats
    assert "applications_ready" in stats
    assert "applications_sent" in stats
    assert "hr_contacts_required" in stats

