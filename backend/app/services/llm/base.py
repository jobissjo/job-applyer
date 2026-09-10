from abc import ABC, abstractmethod
from typing import Optional, Dict, Any


class LLMError(Exception):
    """Base exception for LLM errors."""
    pass


class RateLimitError(LLMError):
    """Raised when provider returns HTTP 429 or rate limit message."""
    pass


class QuotaExceededError(LLMError):
    """Raised when quota/credits are exhausted."""
    pass


class AuthenticationError(LLMError):
    """Raised on invalid API key or 401/403."""
    pass


class TemporaryProviderError(LLMError):
    """Raised on 500/502/503/504 or network timeout."""
    pass


class BaseLLMClient(ABC):
    def __init__(self, api_key: str, model: str, timeout: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False
    ) -> str:
        """Generate response text from LLM."""
        pass
