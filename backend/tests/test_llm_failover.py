import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy import select

from app.models.llm import LLMProvider, LLMUsageLog
from app.services.llm.base import RateLimitError
from app.services.llm.manager import LLMManager


@pytest.mark.asyncio
async def test_llm_failover_mechanism(db_session, user_a):
    user_id = user_a["user"].id

    # Configure Provider 1 (Priority 1)
    p1 = LLMProvider(
        user_id=user_id,
        provider="openrouter",
        api_key="sk-or-fake-key",
        model="llama-3",
        priority=1,
        active=True,
        enabled=True
    )
    # Configure Provider 2 (Priority 2)
    p2 = LLMProvider(
        user_id=user_id,
        provider="groq",
        api_key="gsk-fake-key",
        model="llama-3.3-70b",
        priority=2,
        active=True,
        enabled=True
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    # Mock OpenRouter raising RateLimitError, Groq succeeding
    async def mock_openrouter_generate(*args, **kwargs):
        raise RateLimitError("Rate limit exceeded 429")

    async def mock_groq_generate(*args, **kwargs):
        return '{"matched": true, "job_title": "Python Developer", "match_score": 90, "reason": "Great fit"}'

    with patch("app.services.llm.openrouter.OpenRouterClient.generate", side_effect=mock_openrouter_generate), \
         patch("app.services.llm.groq.GroqClient.generate", side_effect=mock_groq_generate):

        result = await LLMManager.generate_with_failover(
            user_id=user_id,
            prompt="Match job",
            db=db_session
        )

        assert "Python Developer" in result

    # Check LLM usage logs
    stmt = select(LLMUsageLog).where(LLMUsageLog.user_id == user_id).order_by(LLMUsageLog.id.asc())
    res = await db_session.execute(stmt)
    logs = list(res.scalars().all())

    assert len(logs) == 2
    # First log should be openrouter failure
    assert logs[0].provider == "openrouter"
    assert logs[0].success is False
    assert logs[0].error_type == "RateLimitError"

    # Second log should be groq success
    assert logs[1].provider == "groq"
    assert logs[1].success is True
