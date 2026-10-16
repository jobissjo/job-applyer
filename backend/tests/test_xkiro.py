import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy import select

from app.models.llm import LLMProvider, LLMUsageLog
from app.services.llm.base import (
    AuthenticationError, LLMError, QuotaExceededError, RateLimitError, TemporaryProviderError,
)
from app.services.llm.manager import LLMManager
from app.services.llm.xkiro import XkiroClient


def mock_transport(handler):
    real_client = httpx.AsyncClient
    return patch("app.services.llm.xkiro.httpx.AsyncClient", side_effect=lambda **kwargs: real_client(
        **kwargs, transport=httpx.MockTransport(handler),
    ))


def reply(content, finish_reason="stop"):
    return {"choices": [{"message": {"content": content}, "finish_reason": finish_reason}]}


@pytest.mark.asyncio
async def test_xkiro_request_and_json_response():
    def handler(request):
        assert str(request.url) == "https://api.xkiro.com/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer sk-xt-test-key"
        body = json.loads(request.content)
        assert body["model"] == "vendor/test-model"
        assert body["messages"][0] == {"role": "system", "content": "Match jobs"}
        assert body["messages"][-1] == {"role": "user", "content": "Return a match as JSON"}
        assert body["response_format"] == {"type": "json_object"}
        assert body["stream"] is False
        return httpx.Response(200, json=reply(' {"matched": true} '))

    with mock_transport(handler):
        client = LLMManager.create_client(" Xkiro ", "sk-xt-test-key", "vendor/test-model")
        assert isinstance(client, XkiroClient)
        assert await client.generate("Return a match as JSON", "Match jobs", json_mode=True) == '{"matched": true}'


@pytest.mark.asyncio
async def test_plain_text_generation_does_not_request_json():
    def handler(request):
        body = json.loads(request.content)
        assert "response_format" not in body
        assert body["messages"] == [{"role": "user", "content": "Write a cover letter"}]
        return httpx.Response(200, json=reply(" Cover letter "))

    with mock_transport(handler):
        assert await XkiroClient("key", "vendor/model").generate("Write a cover letter") == "Cover letter"


@pytest.mark.asyncio
@pytest.mark.parametrize("status,exception", [
    (429, RateLimitError), (401, AuthenticationError), (403, AuthenticationError),
    (402, QuotaExceededError), (408, TemporaryProviderError), (500, TemporaryProviderError),
    (502, TemporaryProviderError), (503, TemporaryProviderError), (529, TemporaryProviderError),
    (400, LLMError), (404, LLMError),
])
async def test_provider_errors_allow_failover_without_exposing_response_body(status, exception):
    with mock_transport(lambda r: httpx.Response(status, text="Echoed sk-xt-secret-key and private prompt")):
        with pytest.raises(exception) as error:
            await XkiroClient("sk-xt-secret-key", "vendor/model").generate("Private prompt")
    assert "sk-xt-secret-key" not in str(error.value)
    assert "private prompt" not in str(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("exception", [httpx.ReadTimeout, httpx.ConnectError])
async def test_network_failures_are_temporary(exception):
    def handler(request):
        raise exception("connection failed", request=request)

    with mock_transport(handler):
        with pytest.raises(TemporaryProviderError):
            await XkiroClient("key", "vendor/model").generate("Hello")


@pytest.mark.asyncio
@pytest.mark.parametrize("body,json_mode", [
    ({}, False), (reply(None), False), (reply(""), False), (reply("partial", "length"), False),
    (reply("not JSON"), True), (reply("[]"), True),
])
async def test_invalid_empty_or_truncated_responses_fail(body, json_mode):
    with mock_transport(lambda r: httpx.Response(200, json=body)):
        with pytest.raises(LLMError):
            await XkiroClient("key", "vendor/model").generate("Hello", json_mode=json_mode)


@pytest.mark.asyncio
@pytest.mark.parametrize("model", ["", "bare-model", "/model", "vendor/", "vendor/model with spaces"])
async def test_full_model_identifier_required(model):
    with mock_transport(lambda r: pytest.fail("Invalid model must not make a request")):
        with pytest.raises(LLMError, match="vendor/model"):
            await XkiroClient("key", model).generate("Hello")


@pytest.mark.asyncio
async def test_create_test_list_and_isolate_provider(client, user_a, user_b):
    key = "sk-xt-private-test-credentials"
    response = await client.post("/api/llm-providers", headers=user_a["headers"], json={
        "provider": "xkiro", "api_key": key, "model": "vendor/model", "priority": 2,
    })
    assert response.status_code == 201
    data = response.json()
    assert data["provider"] == "xkiro"
    assert key not in response.text
    with patch.object(XkiroClient, "generate", new_callable=AsyncMock, return_value="Connected") as generate:
        tested = await client.post(f"/api/llm-providers/{data['id']}/test", json={}, headers=user_a["headers"])
        assert tested.json()["success"] is True
        generate.assert_awaited_once()
        assert (await client.post(f"/api/llm-providers/{data['id']}/test", json={}, headers=user_b["headers"])).status_code == 404
    listed = await client.get("/api/llm-providers", headers=user_a["headers"])
    assert key not in listed.text
    assert any(item["id"] == data["id"] for item in listed.json())
    other = await client.get("/api/llm-providers", headers=user_b["headers"])
    assert all(item["id"] != data["id"] for item in other.json())


@pytest.mark.asyncio
async def test_xkiro_rate_limit_fails_over_to_existing_provider(db_session, user_a):
    user_id = user_a["user"].id
    db_session.add_all([
        LLMProvider(user_id=user_id, provider="xkiro", api_key="sk-xt-test", model="vendor/model", priority=1),
        LLMProvider(user_id=user_id, provider="groq", api_key="gsk-test", model="test-model", priority=2),
    ])
    await db_session.commit()
    with (mock_transport(lambda r: httpx.Response(429)),
          patch("app.services.llm.groq.GroqClient.generate", new_callable=AsyncMock, return_value="Backup reply") as backup):
        result = await LLMManager.generate_with_failover(user_id=user_id, prompt="Hello", db=db_session)
    assert result == "Backup reply"
    backup.assert_awaited_once()
    logs = (await db_session.execute(select(LLMUsageLog).where(
        LLMUsageLog.user_id == user_id).order_by(LLMUsageLog.id))).scalars().all()
    assert [(log.provider, log.success) for log in logs] == [("xkiro", False), ("groq", True)]
    assert logs[0].error_type == "RateLimitError"
