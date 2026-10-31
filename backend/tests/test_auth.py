import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from sqlalchemy import select
from app.config import settings
from app.models.user import User
from app.services.auth_email import code_hash
from app.utils.security import create_access_token


@pytest.fixture
def smtp(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "AUTH_SMTP_FROM_EMAIL", "noreply@example.com")
    sender = AsyncMock(return_value=({}, "Accepted"))
    monkeypatch.setattr("app.services.auth_email.aiosmtplib.send", sender)
    return sender


def sent_code(smtp):
    return smtp.call_args.args[0].get_content().split("code is: ")[1].split()[0]


@pytest.mark.asyncio
async def test_register_and_login(client, smtp):
    # Register new user
    reg_resp = await client.post(
        "/api/auth/register",
        json={"email": "newuser@example.com", "password": "SuperSecretPassword123!"}
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data
    assert data["is_email_verified"] is False
    assert "verification_code_hash" not in data
    assert smtp.call_args.args[0]["To"] == "newuser@example.com"
    blocked = await client.post("/api/auth/login", json={"email": data["email"], "password": "SuperSecretPassword123!"})
    assert blocked.status_code == 403
    forged_session = create_access_token({"sub": str(data["id"])})
    blocked_me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged_session}"})
    assert blocked_me.status_code == 403
    code = sent_code(smtp)
    verified = await client.post("/api/auth/verify-email", json={"email": data["email"], "code": code})
    assert verified.status_code == 200
    replay = await client.post("/api/auth/verify-email", json={"email": data["email"], "code": code})
    assert replay.status_code == 400

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
async def test_verification_attempts_expiry_and_resend(client, db_session, smtp):
    email = "verification@example.com"
    await client.post("/api/auth/register", json={"email": email, "password": "Password123!"})
    code = sent_code(smtp)
    user = (await db_session.execute(select(User).where(User.email == email))).scalar_one()
    assert user.verification_code_hash == code_hash(email, code)
    assert code not in user.verification_code_hash
    for _ in range(5):
        bad = await client.post("/api/auth/verify-email", json={"email": email, "code": "wrong"})
        assert bad.status_code == 400
    locked = await client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert locked.status_code == 400
    await client.post("/api/auth/resend-verification", json={"email": email})
    assert smtp.await_count == 1
    user.verification_sent_at = datetime.now(timezone.utc) - timedelta(seconds=61)
    await db_session.commit()
    await client.post("/api/auth/resend-verification", json={"email": email})
    assert smtp.await_count == 2
    await db_session.refresh(user)
    assert user.verification_attempts == 0
    user.verification_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()
    expired = await client.post("/api/auth/verify-email", json={"email": email, "code": sent_code(smtp)})
    assert expired.status_code == 400
    unknown = await client.post("/api/auth/resend-verification", json={"email": "unknown@example.com"})
    assert unknown.status_code == 200
    assert smtp.await_count == 2


@pytest.mark.asyncio
async def test_smtp_failure_rolls_back_registration(client, db_session, smtp):
    smtp.side_effect = RuntimeError("secret provider credentials")
    response = await client.post("/api/auth/register", json={"email": "failure@example.com", "password": "Password123!"})
    assert response.status_code == 503
    assert "secret" not in response.text
    assert (await db_session.execute(select(User).where(User.email == "failure@example.com"))).scalar_one_or_none() is None
    smtp.side_effect = None
    retry = await client.post("/api/auth/register", json={"email": "failure@example.com", "password": "Password123!"})
    assert retry.status_code == 201


@pytest.mark.asyncio
async def test_missing_smtp_configuration(client, smtp, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_SMTP_HOST", "")
    response = await client.post("/api/auth/register", json={"email": "unconfigured@example.com", "password": "Password123!"})
    assert response.status_code == 503
    smtp.assert_not_awaited()


@pytest.mark.asyncio
async def test_resend_failure_preserves_previous_code(client, db_session, smtp):
    email = "resend-failure@example.com"
    await client.post("/api/auth/register", json={"email": email, "password": "Password123!"})
    code = sent_code(smtp)
    user = (await db_session.execute(select(User).where(User.email == email))).scalar_one()
    user.verification_sent_at = datetime.now(timezone.utc) - timedelta(seconds=61)
    await db_session.commit()
    smtp.side_effect = RuntimeError("SMTP unavailable")
    failed = await client.post("/api/auth/resend-verification", json={"email": email})
    assert failed.status_code == 503
    verified = await client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert verified.status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("port,implicit,start_tls", [(587, False, True), (465, True, False)])
async def test_smtp_transport_and_new_code(client, db_session, smtp, monkeypatch, port, implicit, start_tls):
    monkeypatch.setattr(settings, "AUTH_SMTP_PORT", port)
    codes = iter([123456, 654321])
    monkeypatch.setattr("app.services.auth_email.secrets.randbelow", lambda _: next(codes))
    email = f"transport-{port}@example.com"
    await client.post("/api/auth/register", json={"email": email, "password": "Password123!"})
    assert smtp.call_args.kwargs["use_tls"] is implicit
    assert smtp.call_args.kwargs["start_tls"] is start_tls
    user = (await db_session.execute(select(User).where(User.email == email))).scalar_one()
    user.verification_sent_at = datetime.now(timezone.utc) - timedelta(seconds=61)
    await db_session.commit()
    await client.post("/api/auth/resend-verification", json={"email": email})
    old = await client.post("/api/auth/verify-email", json={"email": email, "code": "123456"})
    assert old.status_code == 400
    new = await client.post("/api/auth/verify-email", json={"email": email, "code": "654321"})
    assert new.status_code == 200


@pytest.mark.asyncio
async def test_dashboard_stats_endpoint(client, user_a):
    stats_resp = await client.get("/api/dashboard-stats", headers=user_a["headers"])
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "total_jobs" in stats
    assert "applications_ready" in stats
    assert "applications_sent" in stats
    assert "hr_contacts_required" in stats

