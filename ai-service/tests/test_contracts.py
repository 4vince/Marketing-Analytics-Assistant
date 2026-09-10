# Phase 3 hardening tests — contract/fallback shapes shared by the audit
# dashboard and report generators, _build_result JSON parsing, and the
# own-products fetch (cross-event-loop safety). These are deterministic:
# every agent is forced through its no-LLM fallback path, never the network.
import json

import pytest

from agents.base import AnalysisResult, BaseAgent
from agents.seo import SEOAgent
from agents.content_quality import ContentQualityAgent
from agents.content_optimization import ContentOptimizationAgent
from agents.product_page import ProductPageAgent
from agents.competitor_analysis import CompetitorAnalysisAgent
from agents.quarterly_report import QuarterlyReportAgent
from agents.business_auditor import BusinessAuditorAgent
from orchestrator import Orchestrator


class TestBuildResult:
    """AnalysisResult construction from arbitrary LLM JSON output."""

    def test_coerces_integer_valued_float_score(self):
        result = BaseAgent._build_result({"score": 92.0, "findings": [], "suggestions": []})
        assert isinstance(result.score, int)
        assert result.score == 92

    def test_rejects_fractional_score(self):
        """A fractional float is ambiguous for an int field — must fall back, not silently truncate."""
        with pytest.raises(ValueError):
            BaseAgent._build_result({"score": 92.5, "findings": [], "suggestions": []})

    def test_rejects_string_score(self):
        with pytest.raises(ValueError):
            BaseAgent._build_result({"score": "92", "findings": [], "suggestions": []})

    def test_tolerates_extra_top_level_keys(self):
        result = BaseAgent._build_result({
            "score": 50,
            "findings": [{"issue": "x", "severity": "low", "detail": "d"}],
            "suggestions": [],
            "summary": "markdown here",       # competitor payloads include these
            "markdown_report": "# report",
        })
        assert result.score == 50
        assert len(result.findings) == 1

    def test_non_dict_input_raises(self):
        with pytest.raises(ValueError):
            BaseAgent._build_result("[1, 2, 3]")  # already a list, not an object

    def test_missing_required_fields_raises(self):
        with pytest.raises(ValueError):
            BaseAgent._build_result({"score": 10, "findings": []})

    def test_non_list_collections_raise(self):
        with pytest.raises(ValueError):
            BaseAgent._build_result({"score": 10, "findings": {}, "suggestions": []})

    def test_model_ignores_extra_fields(self):
        """AnalysisResult drops unknown keys instead of raising (Dashboard-safe)."""
        result = AnalysisResult(score=10, findings=[], suggestions=[], unknown_extra="ignored")
        assert result.score == 10
        assert not hasattr(result, "unknown_extra")


class TestFallbackContract:
    """Every analysis agent's fallback is explicit, serializable, and audit-safe.

    The audit dashboard performs arithmetic on finding fields
    (estimated_annual_loss_cents) and guarantees no NaN/NULL rendering — the
    fallback must supply those fields with concrete, numeric values.
    """

    AUDIT_SAFE_FINDING_KEYS = ("issue", "severity", "detail", "category", "estimated_annual_loss_cents")

    @staticmethod
    def _assert_audit_safe(result):
        assert isinstance(result, AnalysisResult)
        assert isinstance(result.score, int)
        assert isinstance(result.suggestions, list)
        assert isinstance(result.findings, list) and len(result.findings) >= 1
        finding = result.findings[0]
        for key in TestFallbackContract.AUDIT_SAFE_FINDING_KEYS:
            assert key in finding, f"fallback finding missing '{key}' in {type(result).__name__}"
            assert finding[key] is not None, f"fallback finding has null '{key}'"
        assert isinstance(finding["estimated_annual_loss_cents"], int)
        assert isinstance(finding["category"], str)
        # JSON-serializable (report generators / status route re-encode results)
        json.dumps(result.model_dump())

    @pytest.mark.parametrize("agent_cls", [
        SEOAgent,
        ContentQualityAgent,
        ContentOptimizationAgent,
        ProductPageAgent,
        QuarterlyReportAgent,
        BusinessAuditorAgent,
        CompetitorAnalysisAgent,
    ])
    def test_all_analysis_agents_fallback_is_audit_safe(self, agent_cls):
        agent = agent_cls()
        agent.llm = None
        sample_product = {
            "name": "Test Widget",
            "description": "A test product.",
            "category": "gadgets",
            "slug": "test-widget",
            "price": 2999,
            "images": [],
            "meta_title": "Buy Test Widget",
            "meta_description": "Test widget details.",
            "status": "active",
        }
        result = agent.analyze(sample_product)
        self._assert_audit_safe(result)

    def test_competitor_fallback_has_report_attribute_defaults(self):
        """Report endpoint reads summary/markdown_report via getattr — must default to empty string."""
        agent = CompetitorAnalysisAgent()
        agent.llm = None
        result = agent.analyze({"competitor": {"name": "Rival"}, "scraped_data": {}, "own_products": []})
        self._assert_audit_safe(result)
        assert getattr(result, "summary", "") == ""
        assert getattr(result, "markdown_report", "") == ""

    def test_business_auditor_fallback_after_aggregation(self):
        """BusinessAuditor runs pure sub-analyzers on empty data without crashing, then falls back."""
        agent = BusinessAuditorAgent()
        agent.llm = None
        result = agent.analyze({})
        self._assert_audit_safe(result)
        assert result.score == 0

    def test_orchestrator_business_audit_returns_fallback(self):
        """Orchestrator.run_business_audit returns a fallback instead of raising on empty data."""
        orchestrator = Orchestrator()
        orchestrator.business_auditor.llm = None
        result = orchestrator.run_business_audit({})
        self._assert_audit_safe(result)


class TestOwnProductsFetch:
    """Own-products fetch degrades gracefully when no scoped DB connection exists."""

    def test_async_fetch_returns_empty_list_without_db(self):
        from main import _fetch_own_products
        import asyncio
        products = asyncio.run(_fetch_own_products())
        assert products == []

    def test_sync_fetch_returns_empty_list_without_db(self):
        from main import _fetch_own_products_sync
        assert _fetch_own_products_sync() == []