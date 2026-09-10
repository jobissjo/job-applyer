from typing import Optional
import httpx
from app.services.llm.base import (
    BaseLLMClient,
    RateLimitError,
    QuotaExceededError,
    AuthenticationError,
    TemporaryProviderError,
    LLMError
)
from app.utils.logger import logger


class OpenRouterClient(BaseLLMClient):
    API_URL = "https://openrouter.ai/api/v1/chat/completions"

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False
    ) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Local Job Auto-Apply System",
        }

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model or "meta-llama/llama-3.3-70b-instruct:free",
            "messages": messages,
            "temperature": 0.3,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(self.API_URL, headers=headers, json=payload)
                
                if resp.status_code == 429:
                    raise RateLimitError(f"OpenRouter Rate Limit exceeded: {resp.text}")
                elif resp.status_code in [401, 403]:
                    raise AuthenticationError(f"OpenRouter Auth failed: {resp.text}")
                elif resp.status_code == 402:
                    raise QuotaExceededError(f"OpenRouter Quota / Credits exhausted: {resp.text}")
                elif resp.status_code >= 500:
                    raise TemporaryProviderError(f"OpenRouter Server Error {resp.status_code}: {resp.text}")
                elif resp.status_code != 200:
                    raise LLMError(f"OpenRouter Error {resp.status_code}: {resp.text}")

                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()

        except httpx.TimeoutException:
            raise TemporaryProviderError("OpenRouter request timed out")
        except (RateLimitError, AuthenticationError, QuotaExceededError, TemporaryProviderError, LLMError):
            raise
        except Exception as e:
            raise LLMError(f"Unexpected error communicating with OpenRouter: {e}")
