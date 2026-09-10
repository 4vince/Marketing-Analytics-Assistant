# LLM client abstraction — supports OpenCode, OpenAI, Anthropic, and OpenRouter providers.
# Includes retry logic for transient failures (rate limits, empty responses, timeouts).
import asyncio
import os
import time
import logging

from openai import OpenAI, APIError, APIConnectionError, RateLimitError
from anthropic import Anthropic, APIError as AnthropicAPIError

logger = logging.getLogger(__name__)

# Maximum times to retry on transient failures (empty choices, rate limits, etc.)
MAX_RETRIES = 3
RETRY_BACKOFF = [1, 3, 8]  # seconds between retries


class LLMClient:
    def __init__(self):
        provider = os.getenv("LLM_PROVIDER", "opencode").strip().lower()
        model = os.getenv("LLM_MODEL", "big-pickle")
        logger.info("[LLMClient] provider=%s, model=%s", provider, model)

        if provider == "openrouter":
            openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
            openrouter_base_url = os.getenv(
                "OPENROUTER_BASE_URL",
                "https://openrouter.ai/api/v1",
            )
            if not openrouter_api_key:
                raise ValueError("OPENROUTER_API_KEY is missing")

            # Normalize base URL if user accidentally included /chat/completions
            if openrouter_base_url.lower().endswith("/chat/completions"):
                logger.warning(
                    "[LLMClient] OPENROUTER_BASE_URL contained /chat/completions; "
                    "using the root API base URL instead."
                )
                openrouter_base_url = openrouter_base_url[: -len("/chat/completions")]

            self.client = OpenAI(
                api_key=openrouter_api_key,
                base_url=openrouter_base_url,
            )
            self.model = model
            self.provider = "openrouter"

        elif provider == "opencode":
            self.client = OpenAI(
                api_key=os.getenv("OPENCODE_API_KEY"),
                base_url=os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1"),
            )
            self.model = model
            self.provider = "opencode"

        elif provider == "openai":
            self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            self.model = model
            self.provider = "openai"

        elif provider == "anthropic":
            self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            self.model = model
            self.provider = "anthropic"

        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

    def chat(self, system: str, user: str, model: str | None = None) -> str:
        """Send a chat completion request with retry logic for transient failures.

        Retries on: empty choices, None content, rate limits, connection errors.
        Raises on: persistent failures after all retries exhausted.
        """
        effective_model = model or self.model
        last_error = None

        for attempt in range(MAX_RETRIES):
            try:
                result = self._call_llm(system, user, effective_model)
                if result is not None:
                    return result
                # result is None — empty response, retry
                last_error = "LLM returned empty response (None content)"
                logger.warning(
                    "[LLMClient] Attempt %d/%d: empty response from %s/%s, retrying...",
                    attempt + 1, MAX_RETRIES, self.provider, effective_model,
                )
            except RateLimitError as e:
                last_error = f"Rate limited: {e}"
                logger.warning(
                    "[LLMClient] Attempt %d/%d: rate limited by %s, retrying...",
                    attempt + 1, MAX_RETRIES, self.provider,
                )
            except APIConnectionError as e:
                last_error = f"Connection error: {e}"
                logger.warning(
                    "[LLMClient] Attempt %d/%d: connection error with %s, retrying...",
                    attempt + 1, MAX_RETRIES, self.provider,
                )
            except APIError as e:
                last_error = f"API error: {e}"
                logger.warning(
                    "[LLMClient] Attempt %d/%d: API error from %s: %s",
                    attempt + 1, MAX_RETRIES, self.provider, e,
                )
            except AnthropicAPIError as e:
                last_error = f"Anthropic API error: {e}"
                logger.warning(
                    "[LLMClient] Attempt %d/%d: Anthropic API error: %s",
                    attempt + 1, MAX_RETRIES, e,
                )
            except Exception as e:
                last_error = f"Unexpected error: {type(e).__name__}: {e}"
                logger.warning(
                    "[LLMClient] Attempt %d/%d: unexpected error: %s",
                    attempt + 1, MAX_RETRIES, last_error,
                )

            # Backoff before retry (skip on last attempt)
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)]
                logger.info("[LLMClient] Waiting %ds before retry...", wait)
                time.sleep(wait)

        raise RuntimeError(
            f"LLM call failed after {MAX_RETRIES} attempts. "
            f"Provider: {self.provider}, Model: {effective_model}. "
            f"Last error: {last_error}"
        )

    def _call_llm(self, system: str, user: str, model: str) -> str | None:
        """Make a single LLM API call. Returns response content or None if empty."""
        if self.provider in ("opencode", "openai", "openrouter"):
            resp = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.3,
                timeout=120,
            )

            # Validate response structure
            if resp is None:
                logger.error("[LLMClient] Received None response from API")
                return None

            if not hasattr(resp, "choices") or resp.choices is None:
                logger.error("[LLMClient] Response has no choices attribute: %s", type(resp))
                return None

            if len(resp.choices) == 0:
                logger.error(
                    "[LLMClient] Empty choices array. Response finish_reason=%s, "
                    "model=%s, id=%s",
                    getattr(resp, "finish_reason", "N/A"),
                    getattr(resp, "model", "N/A"),
                    getattr(resp, "id", "N/A"),
                )
                return None

            choice = resp.choices[0]

            if choice.message is None:
                logger.error("[LLMClient] choice.message is None")
                return None

            content = choice.message.content
            if content is None or (isinstance(content, str) and content.strip() == ""):
                logger.error(
                    "[LLMClient] Empty content in response. finish_reason=%s, "
                    "role=%s",
                    getattr(choice, "finish_reason", "N/A"),
                    getattr(choice.message, "role", "N/A"),
                )
                return None

            return content.strip()

        else:  # anthropic
            resp = self.client.messages.create(
                model=model,
                system=system,
                messages=[{"role": "user", "content": user}],
                temperature=0.3,
                timeout=120,
            )

            if resp is None or not resp.content:
                logger.error("[LLMClient] Anthropic returned empty response")
                return None

            text = resp.content[0].text if resp.content else None
            if text is None or text.strip() == "":
                logger.error("[LLMClient] Anthropic returned empty text content")
                return None

            return text.strip()

    async def chat_async(self, system: str, user: str, model: str | None = None) -> str:
        """Async version of chat() — runs the synchronous call in a thread pool."""
        return await asyncio.to_thread(self.chat, system, user, model)
