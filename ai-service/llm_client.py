# LLM client abstraction — supports OpenCode, OpenAI, and Anthropic providers via environment config.
import asyncio
import os
from openai import OpenAI
from anthropic import Anthropic


class LLMClient:
    def __init__(self):
        provider = os.getenv("LLM_PROVIDER", "opencode").strip().lower()
        model = os.getenv("LLM_MODEL", "big-pickle")
        print(f"[LLMClient] provider={provider}, model={model}")

        if provider == "openrouter":
            openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
            openrouter_base_url = os.getenv(
                "OPENROUTER_BASE_URL",
                "https://openrouter.ai/api/v1",
            )
            if not openrouter_api_key:
                raise ValueError("OPENROUTER_API_KEY is missing")

            # OpenAI-compatible SDKs expect the base API root, not the full chat
            # completions path. Normalize if the user provided a full endpoint.
            if openrouter_base_url.lower().endswith("/chat/completions"):
                print(
                    "[LLMClient] WARNING: OPENROUTER_BASE_URL contained /chat/completions; "
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

    def chat(self, system: str, user: str) -> str:
        if self.provider in ("opencode", "openai", "openrouter"):
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.3,
                timeout=60,
            )
            return resp.choices[0].message.content or ""
        else:  # anthropic
            resp = self.client.messages.create(
                model=self.model,
                system=system,
                messages=[{"role": "user", "content": user}],
                temperature=0.3,
                timeout=60,
            )
            return resp.content[0].text if resp.content else ""

    async def chat_async(self, system: str, user: str) -> str:
        """Async version of chat() — runs the synchronous call in a thread pool."""
        return await asyncio.to_thread(self.chat, system, user)
