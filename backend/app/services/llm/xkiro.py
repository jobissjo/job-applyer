"""xKiro's OpenAI-compatible Chat Completions API.

Reference: https://docs.xkiro.com/api/chat-completions/
"""
import json
import re
from typing import Optional

import httpx

from app.services.llm.base import (
    AuthenticationError,
    BaseLLMClient,
    LLMError,
    QuotaExceededError,
    RateLimitError,
    TemporaryProviderError,
)


class XkiroClient(BaseLLMClient):
    API_URL = "https://api.xkiro.com/v1/chat/completions"

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False,
    ) -> str:
        model = self.model.strip()
        if not re.fullmatch(r"[^/\s]+/\S+", model):
            raise LLMError("xKiro requires a full model identifier in vendor/model format.")
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        if json_mode:
            # Some upstream models ignore response_format; instruct and validate as well.
            messages.append({"role": "system", "content": "Return only a valid JSON object."})
        messages.append({"role": "user", "content": prompt})
        payload = {"model": model, "messages": messages, "temperature": 0.3, "stream": False}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.API_URL, headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }, json=payload)
        except httpx.TimeoutException as exc:
            raise TemporaryProviderError("xKiro request timed out.") from exc
        except httpx.RequestError as exc:
            raise TemporaryProviderError("Could not connect to xKiro.") from exc

        # Avoid recording upstream bodies: they may echo credentials or prompt content.
        status = response.status_code
        if status == 429:
            raise RateLimitError("xKiro rate limit exceeded (429).")
        if status in (401, 403):
            raise AuthenticationError("xKiro rejected the API key or model permissions (401/403).")
        if status == 402:
            raise QuotaExceededError("xKiro credits or usage allowance exhausted (402).")
        if status == 408 or status >= 500:
            raise TemporaryProviderError(f"xKiro temporarily unavailable ({status}).")
        if status != 200:
            raise LLMError(f"xKiro rejected the request ({status}). Check the full model identifier and account access.")

        try:
            choice = response.json()["choices"][0]
            if choice.get("finish_reason") == "length":
                raise LLMError("xKiro returned a truncated response. Try a shorter prompt or another model.")
            content = choice["message"]["content"]
            if isinstance(content, list):
                content = "".join(part.get("text", "") for part in content if part.get("type") == "text")
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Missing response text")
            result = content.strip()
            if json_mode and not isinstance(json.loads(result), dict):
                raise ValueError("Expected a JSON object")
            return result
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
            raise LLMError("xKiro returned an invalid or empty response. Try another model.") from exc
