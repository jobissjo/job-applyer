from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm import LLMProvider, LLMUsageLog
from app.services.llm.base import (
    BaseLLMClient,
    LLMError,
    RateLimitError,
    QuotaExceededError,
    AuthenticationError,
    TemporaryProviderError
)
from app.services.llm.openrouter import OpenRouterClient
from app.services.llm.groq import GroqClient
from app.services.llm.gemini import GeminiClient
from app.services.llm.xkiro import XkiroClient
from app.utils.logger import logger


class LLMManager:
    @staticmethod
    def create_client(provider_name: str, api_key: str, model: str) -> BaseLLMClient:
        provider_clean = provider_name.lower().strip()
        if provider_clean == "openrouter":
            return OpenRouterClient(api_key=api_key, model=model)
        elif provider_clean == "groq":
            return GroqClient(api_key=api_key, model=model)
        elif provider_clean == "gemini":
            return GeminiClient(api_key=api_key, model=model)
        elif provider_clean == "xkiro":
            return XkiroClient(api_key=api_key, model=model)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider_name}")

    @staticmethod
    async def get_user_providers(user_id: int, db: AsyncSession) -> List[LLMProvider]:
        stmt = (
            select(LLMProvider)
            .where(
                LLMProvider.user_id == user_id,
                LLMProvider.active == True,
                LLMProvider.enabled == True
            )
            .order_by(LLMProvider.priority.asc(), LLMProvider.id.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def generate_with_failover(
        user_id: int,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False,
        db: Optional[AsyncSession] = None
    ) -> str:
        if not db:
            raise ValueError("Database session is required for LLM failover management")

        providers = await LLMManager.get_user_providers(user_id, db)
        if not providers:
            raise LLMError("No active LLM providers configured. Please configure OpenRouter, Groq, Gemini, or xKiro in LLM Settings.")

        errors: List[str] = []

        for p in providers:
            client = LLMManager.create_client(p.provider, p.api_key, p.model)
            logger.info(f"[LLMManager] Attempting generation with provider '{p.provider}' (model: {p.model}, priority: {p.priority})")

            try:
                result = await client.generate(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    json_mode=json_mode
                )

                # Record success log
                log_entry = LLMUsageLog(
                    user_id=user_id,
                    provider=p.provider,
                    model=p.model,
                    request_time=datetime.now(timezone.utc),
                    success=True,
                )
                db.add(log_entry)
                await db.commit()

                logger.info(f"[LLMManager] Provider '{p.provider}' succeeded.")
                return result

            except (RateLimitError, QuotaExceededError, TemporaryProviderError, AuthenticationError, LLMError) as err:
                error_type = err.__class__.__name__
                error_msg = str(err)
                logger.warning(
                    f"[LLMManager] Provider '{p.provider}' failed ({error_type}): {error_msg}. Failing over to next provider..."
                )
                errors.append(f"{p.provider} ({p.model}): [{error_type}] {error_msg}")

                # Log failure
                log_entry = LLMUsageLog(
                    user_id=user_id,
                    provider=p.provider,
                    model=p.model,
                    request_time=datetime.now(timezone.utc),
                    success=False,
                    error_type=error_type,
                    error_message=error_msg[:1000]
                )
                db.add(log_entry)
                await db.commit()

            except Exception as unk_err:
                error_type = "UnknownError"
                error_msg = str(unk_err)
                logger.error(f"[LLMManager] Unexpected error with provider '{p.provider}': {error_msg}")
                errors.append(f"{p.provider}: {error_msg}")

                log_entry = LLMUsageLog(
                    user_id=user_id,
                    provider=p.provider,
                    model=p.model,
                    request_time=datetime.now(timezone.utc),
                    success=False,
                    error_type=error_type,
                    error_message=error_msg[:1000]
                )
                db.add(log_entry)
                await db.commit()

        # All providers failed
        summary_error = "All configured LLM providers failed:\n" + "\n".join(f"- {e}" for e in errors)
        logger.error(summary_error)
        raise LLMError(summary_error)
