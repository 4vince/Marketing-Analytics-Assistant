# Abstract base classes and Pydantic models for analysis results, chat context, and agents.
import json

from pydantic import BaseModel
from abc import ABC, abstractmethod
from typing import Any


class AnalysisResult(BaseModel):
    score: int
    findings: list[dict[str, Any]]
    suggestions: list[dict[str, Any]]


class ChatContext(BaseModel):
    conversation_id: str
    product_catalog: list[dict[str, Any]] = []
    customer_email: str | None = None
    role: str = "customer"


class ChatResponse(BaseModel):
    message: str
    actions: list[dict[str, Any]] = []


class BaseAgent(ABC):
    """Base class for analysis agents with centralized LLM init, retry logic, and JSON parsing.

    Subclasses override analyze() and call self._run_llm_analysis() instead of
    duplicating LLM calls, error handling, and JSON decoding.
    """

    max_retries: int = 2

    def __init__(self):
        try:
            from llm_client import LLMClient
            self.llm = LLMClient()
        except Exception:
            self.llm = None

    @abstractmethod
    def analyze(self, content: dict) -> AnalysisResult:
        ...

    def _run_llm_analysis(self, system_prompt: str, user_prompt: str) -> AnalysisResult:
        """Call the LLM with retry logic, parse JSON, and return an AnalysisResult.

        Handles all failure modes (missing LLM, bad JSON, invalid schema) and
        returns a consistent fallback result so subclasses don't need try/except.
        """
        if self.llm is None:
            return self._fallback_result(
                "LLM client could not be initialized. Check API keys and network connectivity."
            )

        last_error: str | None = None
        for _ in range(self.max_retries + 1):
            try:
                raw = self.llm.chat(system_prompt, user_prompt)
                data = json.loads(raw)

                # Validate required fields exist with correct types
                score = data.get("score")
                findings = data.get("findings")
                suggestions = data.get("suggestions")
                if not isinstance(score, int) or not isinstance(findings, list) or not isinstance(suggestions, list):
                    raise ValueError(f"Invalid response structure: score={type(score).__name__}, "
                                     f"findings={type(findings).__name__}, suggestions={type(suggestions).__name__}")

                return AnalysisResult(score=score, findings=findings, suggestions=suggestions)
            except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
                last_error = str(e)
                continue

        return self._fallback_result(
            f"Analysis failed after {self.max_retries + 1} attempts: {last_error}"
        )

    @staticmethod
    def _fallback_result(detail: str = "Analysis unavailable") -> AnalysisResult:
        """Return a uniform error result when analysis cannot be completed."""
        return AnalysisResult(
            score=0,
            findings=[{"issue": "Analysis unavailable", "severity": "high", "detail": detail}],
            suggestions=[],
        )


class ChatAgent(ABC):
    """Base class for chat agents with centralized LLM init, retry logic, and async support.

    Subclasses override respond() and call self._chat_with_llm() instead of
    duplicating LLM calls and error handling.

    Each ChatAgent has an AgentType that determines which skills are loaded
    and which database credentials are used. Skills are loaded at init time
    and stored in self.skills; they are never loaded lazily per-request.
    """

    max_retries: int = 2

    def __init__(self, agent_type: "AgentType | None" = None):
        """Initialize the agent with an optional AgentType for skill/credential scoping.

        Args:
            agent_type: Determines which skills directory to load and which
                        DB role to use. If None, no skills are loaded (safe default
                        for subclasses that don't need skills).
        """
        try:
            from llm_client import LLMClient
            self.llm = LLMClient()
        except Exception as e:
            print(f"[ChatAgent] LLM init failed: {type(e).__name__}: {e}")
            self.llm = None

        # Load skills scoped to agent type — zero code path to other types' skills
        self._agent_type = agent_type
        self.skills: list[dict[str, Any]] = []
        if agent_type is not None:
            try:
                from skills.loader import load_skills
                self.skills = load_skills(agent_type)
            except Exception as e:
                print(f"[ChatAgent] Skills load failed: {type(e).__name__}: {e}")

    @abstractmethod
    async def respond(self, message: str, context: ChatContext) -> ChatResponse:
        ...

    def get_skills_context(self) -> str:
        """Render loaded skills as a system-prompt context block.

        Returns an empty string if no skills are loaded. Skills are rendered
        with their name as a header and their content body below, separated
        by blank lines.
        """
        if not self.skills:
            return ""

        blocks: list[str] = []
        for skill in self.skills:
            name = skill.get("name", "Skill")
            content = skill.get("content", "")
            blocks.append(f"[Skill: {name}]\n{content}")

        return "\n\n".join(blocks)

    def _build_base_system_prompt(self, context: ChatContext) -> str:
        """Build a system prompt that includes base instructions + loaded skills.

        Subclasses should call this and then prepend/append their own
        role-specific instructions.
        """
        parts = [self._get_role_instructions()]
        skills_context = self.get_skills_context()
        if skills_context:
            parts.append(skills_context)
        return "\n\n".join(parts)

    @staticmethod
    def _get_role_instructions() -> str:
        """Return base role instructions shared by all chat agents.

        Override in subclasses to provide agent-specific role context.
        """
        return "You are a helpful assistant."

    async def _chat_with_llm(self, system_prompt: str, user_message: str) -> ChatResponse:
        """Call the LLM with retry logic and return a ChatResponse.

        Handles all failure modes (missing LLM, API errors) and returns a
        consistent fallback response so subclasses don't need try/except.
        """
        if self.llm is None:
            return self._fallback_response(
                "Chat service is currently unavailable. Please try again later."
            )

        for attempt in range(self.max_retries + 1):
            try:
                result = await self.llm.chat_async(system_prompt, user_message)
                return ChatResponse(message=result)
            except Exception as e:
                print(f"[ChatAgent] LLM attempt {attempt + 1}/{self.max_retries + 1} failed: {type(e).__name__}: {e}")
                continue

        return self._fallback_response(
            "Chat service is temporarily unavailable. Please try again later."
        )

    @staticmethod
    def _fallback_response(message: str = "Chat service is unavailable.") -> ChatResponse:
        """Return a uniform error response when chat cannot be completed."""
        return ChatResponse(message=message)
