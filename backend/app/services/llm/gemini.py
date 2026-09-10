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


class GeminiClient(BaseLLMClient):
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False
    ) -> str:
        model_name = self.model or "gemini-1.5-flash"
        if not model_name.startswith("models/"):
            model_endpoint = f"{self.BASE_URL}/{model_name}:generateContent"
        else:
            model_endpoint = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent"

        params = {"key": self.api_key}

        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]}
            ],
            "generationConfig": {
                "temperature": 0.3
            }
        }

        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(model_endpoint, params=params, json=payload)

                if resp.status_code == 429:
                    raise RateLimitError(f"Gemini Rate Limit / Quota exceeded: {resp.text}")
                elif resp.status_code in [400, 401, 403]:
                    err_msg = resp.text.lower()
                    if "api_key_invalid" in err_msg or "key not valid" in err_msg or "forbidden" in err_msg:
                        raise AuthenticationError(f"Gemini Auth failed: {resp.text}")
                    elif "quota" in err_msg or "resource_exhausted" in err_msg:
                        raise QuotaExceededError(f"Gemini Quota exhausted: {resp.text}")
                    else:
                        raise LLMError(f"Gemini Error {resp.status_code}: {resp.text}")
                elif resp.status_code >= 500:
                    raise TemporaryProviderError(f"Gemini Server Error {resp.status_code}: {resp.text}")
                elif resp.status_code != 200:
                    raise LLMError(f"Gemini Error {resp.status_code}: {resp.text}")

                data = resp.json()
                try:
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()
                    raise LLMError("Gemini response missing content parts")
                except Exception as parse_err:
                    raise LLMError(f"Failed to parse Gemini response: {parse_err}")

        except httpx.TimeoutException:
            raise TemporaryProviderError("Gemini request timed out")
        except (RateLimitError, AuthenticationError, QuotaExceededError, TemporaryProviderError, LLMError):
            raise
        except Exception as e:
            raise LLMError(f"Unexpected error communicating with Gemini: {e}")
