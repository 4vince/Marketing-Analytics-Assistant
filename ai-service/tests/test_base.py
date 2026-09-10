# Tests for base models and interfaces — validates data models and abstract agent classes.
import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from agents.base import BaseAgent, ChatAgent, AnalysisResult, ChatContext, ChatResponse, BaseModel


class TestModels:
    def test_analysis_result(self):
        result = AnalysisResult(score=85, findings=[], suggestions=[])
        assert result.score == 85
        assert result.findings == []
        assert result.suggestions == []

    def test_chat_context(self):
        ctx = ChatContext(conversation_id="abc-123")
        assert ctx.conversation_id == "abc-123"
        assert ctx.product_catalog == []
        assert ctx.customer_email is None

    def test_chat_response(self):
        resp = ChatResponse(message="Hello")
        assert resp.message == "Hello"
        assert resp.actions == []


class TestAgentInterface:
    def test_agent_is_abstract(self):
        assert BaseAgent.__dict__["analyze"].__isabstractmethod__

    def test_chat_agent_is_abstract(self):
        assert ChatAgent.__dict__["respond"].__isabstractmethod__


# ─── Concrete test subclass for BaseAgent helpers ──────────────────────────────

class _TestAgent(BaseAgent):
    """Minimal concrete subclass used to test BaseAgent helper methods."""

    def analyze(self, content: dict) -> AnalysisResult:
        return self._run_llm_analysis("system", content.get("prompt", ""))


class TestBaseAgentHelpers:
    def test_fallback_result_structure(self):
        """_fallback_result returns a consistent error AnalysisResult."""
        result = BaseAgent._fallback_result("Something went wrong")
        assert result.score == 0
        assert len(result.findings) == 1
        assert result.findings[0]["issue"] == "Analysis unavailable"
        assert result.findings[0]["severity"] == "high"
        assert result.findings[0]["detail"] == "Something went wrong"
        assert result.suggestions == []

    def test_fallback_result_default_detail(self):
        """_fallback_result uses a sensible default message."""
        result = BaseAgent._fallback_result()
        assert result.findings[0]["detail"] == "Analysis unavailable"

    def test_run_llm_analysis_no_llm(self):
        """When self.llm is None, _run_llm_analysis returns a fallback."""
        agent = _TestAgent()
        # Force llm to None (simulate a failed LLM init)
        agent.llm = None
        result = agent.analyze({"prompt": "irrelevant"})
        assert result.score == 0
        assert "could not be initialized" in result.findings[0]["detail"]

    def test_run_llm_analysis_malformed_json(self, monkeypatch):
        """Retry logic kicks in on bad JSON from the LLM, then returns fallback."""
        agent = _TestAgent()
        mock_llm = MagicMock()
        mock_llm.chat.return_value = "this is not json"
        agent.llm = mock_llm

        result = agent.analyze({"prompt": "test"})

        assert result.score == 0
        assert "attempts" in result.findings[0]["detail"]
        # Should have exhausted retries
        assert mock_llm.chat.call_count == agent.max_retries + 1

    def test_run_llm_analysis_empty_response(self, monkeypatch):
        """Empty string from LLM triggers retry and then fallback."""
        agent = _TestAgent()
        mock_llm = MagicMock()
        mock_llm.chat.return_value = ""
        agent.llm = mock_llm

        result = agent.analyze({"prompt": "test"})

        assert result.score == 0
        assert mock_llm.chat.call_count == agent.max_retries + 1

    def test_run_llm_analysis_invalid_schema(self, monkeypatch):
        """Valid JSON but missing required fields triggers retry and fallback."""
        agent = _TestAgent()
        mock_llm = MagicMock()
        mock_llm.chat.return_value = json.dumps({"foo": "bar"})
        agent.llm = mock_llm

        result = agent.analyze({"prompt": "test"})

        assert result.score == 0
        assert mock_llm.chat.call_count == agent.max_retries + 1

    def test_run_llm_analysis_succeeds_first_try(self, monkeypatch):
        """Happy path: valid JSON with correct schema returns an AnalysisResult."""
        agent = _TestAgent()
        mock_llm = MagicMock()
        mock_llm.chat.return_value = json.dumps({
            "score": 92,
            "findings": [{"issue": "Weak title", "severity": "medium", "detail": "Title is too short."}],
            "suggestions": [{"area": "title", "suggestion": "Lengthen to 60 chars."}],
        })
        agent.llm = mock_llm

        result = agent.analyze({"prompt": "test"})

        assert result.score == 92
        assert len(result.findings) == 1
        assert result.findings[0]["issue"] == "Weak title"
        assert len(result.suggestions) == 1
        assert mock_llm.chat.call_count == 1

    def test_run_llm_analysis_succeeds_after_retry(self, monkeypatch):
        """Retry eventually succeeds after initial failures."""
        agent = _TestAgent()
        agent.max_retries = 1  # two attempts total: first fails, second succeeds
        mock_llm = MagicMock()
        # Fail once with bad JSON, then succeed
        valid_json = json.dumps({
            "score": 78,
            "findings": [{"issue": "Missing alt text", "severity": "low", "detail": "Images lack alt attributes."}],
            "suggestions": [{"area": "images", "suggestion": "Add descriptive alt text."}],
        })
        mock_llm.chat.side_effect = ["bad json", valid_json]
        agent.llm = mock_llm

        result = agent.analyze({"prompt": "test"})

        assert result.score == 78
        assert len(result.findings) == 1
        # Should have taken 2 calls (first fail, second success)
        assert mock_llm.chat.call_count == 2


# ─── Tests for ChatAgent helpers ──────────────────────────────────────────────

class _TestChatAgent(ChatAgent):
    """Minimal concrete subclass used to test ChatAgent helper methods."""

    async def respond(self, message: str, context: ChatContext) -> ChatResponse:
        return await self._chat_with_llm("system", message)


class TestChatAgentHelpers:
    def test_chatagent_init_creates_llm(self):
        """ChatAgent.__init__ should set self.llm (or None on failure)."""
        agent = _TestChatAgent()
        # Should either have an LLM or gracefully handle None
        assert hasattr(agent, "llm")

    @pytest.mark.asyncio
    async def test_chatagent_no_llm_fallback(self):
        """_chat_with_llm returns fallback when self.llm is None."""
        agent = _TestChatAgent()
        agent.llm = None
        resp = await agent.respond("hello", ChatContext(conversation_id="test"))
        assert "unavailable" in resp.message.lower()

    def test_fallback_response_structure(self):
        """_fallback_response returns a ChatResponse with the given message."""
        resp = ChatAgent._fallback_response("Custom error")
        assert isinstance(resp, ChatResponse)
        assert resp.message == "Custom error"
        assert resp.actions == []
