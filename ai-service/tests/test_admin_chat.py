# Tests for AdminChatAgent — validates respond() with business context and system prompt building.
import sys
from unittest.mock import MagicMock, AsyncMock

sys.path.insert(0, ".")
import pytest
from agents.admin_chat import AdminChatAgent
from agents.base import ChatContext, ChatResponse


class TestAdminChatAgent:
    @pytest.fixture
    def agent(self):
        return AdminChatAgent()

    @pytest.mark.asyncio
    async def test_responds_with_context(self, agent):
        """Agent should respond when given full business context."""
        ctx = ChatContext(
            conversation_id="admin-test-1",
            product_catalog=[
                {"type": "product_summary", "total": 25, "active": 20, "categories": 5},
                {"type": "order_summary", "total": 100, "latest": "2026-06-30"},
                {"type": "revenue", "total": 45000.00, "order_count": 100},
            ],
        )
        resp = await agent.respond("How is my store doing?", ctx)
        assert len(resp.message) > 0

    @pytest.mark.asyncio
    async def test_responds_without_context(self, agent):
        """Agent should respond gracefully even without any business context."""
        ctx = ChatContext(conversation_id="admin-test-2")
        resp = await agent.respond("Hello", ctx)
        assert len(resp.message) > 0

    @pytest.mark.asyncio
    async def test_llm_failure_returns_fallback(self, agent):
        """When the LLM call fails, the agent returns a fallback message."""
        mock_llm = MagicMock()
        mock_llm.chat_async.side_effect = RuntimeError("API failure")
        agent.llm = mock_llm

        ctx = ChatContext(conversation_id="admin-test-3")
        resp = await agent.respond("Hello", ctx)

        assert len(resp.message) > 0
        assert mock_llm.chat_async.call_count == agent.max_retries + 1

    def test_build_system_prompt_product_summary(self, agent):
        """_build_system_prompt includes product summary data."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{"type": "product_summary", "total": 30, "active": 25, "categories": 4}],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "30 total" in prompt
        assert "25 active" in prompt
        assert "4 categories" in prompt

    def test_build_system_prompt_all_record_types(self, agent):
        """_build_system_prompt handles all known record types."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[
                {"type": "product_summary", "total": 10, "active": 8, "categories": 3},
                {"type": "order_summary", "total": 50, "latest": "2026-06-29"},
                {"type": "revenue", "total": 12345.50, "order_count": 50},
                {
                    "type": "recent_orders",
                    "orders": [
                        {"id": "ord_001", "customer": "Alice", "total": 99.99, "status": "paid"},
                        {"id": "ord_002", "customer": "Bob", "total": 149.99, "status": "pending"},
                    ],
                },
                {
                    "type": "analysis_summary",
                    "average_scores": {"SEO": 78, "Content": 82},
                },
                {
                    "type": "recent_reports",
                    "reports": [
                        {"period": "Q1 2026", "score": 85},
                    ],
                },
            ],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "10 total" in prompt
        assert "50 total" in prompt
        assert "$12,345.50" in prompt or "$12345.50" in prompt
        assert "Alice" in prompt
        assert "ord_001" in prompt
        assert "SEO" in prompt
        assert "82" in prompt
        assert "Q1 2026" in prompt

    def test_build_system_prompt_empty(self, agent):
        """_build_system_prompt returns the base instructions with no context."""
        ctx = ChatContext(conversation_id="t")
        prompt = agent._build_system_prompt(ctx)
        assert "business intelligence assistant" in prompt.lower()

    def test_build_system_prompt_unknown_record_type(self, agent):
        """_build_system_prompt ignores unknown record types gracefully."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{"type": "unknown_type", "foo": "bar"}],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "business intelligence assistant" in prompt.lower()

    # ── New analytics record type tests ─────────────────────────────────────────

    def test_build_system_prompt_product_performance(self, agent):
        """product_performance record is formatted correctly."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{
                "type": "product_performance",
                "total_products": 42,
                "active_products": 38,
                "categories": [
                    {"name": "electronics", "count": 15, "avgPrice": 5999},
                    {"name": "clothing", "count": 12, "avgPrice": 2499},
                ],
            }],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "42 total" in prompt
        assert "38 active" in prompt
        assert "electronics" in prompt
        assert "clothing" in prompt
        assert "59.99" in prompt or "5999" in prompt

    def test_build_system_prompt_order_funnel(self, agent):
        """order_funnel record is formatted correctly."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{
                "type": "order_funnel",
                "funnel": [
                    {"status": "paid", "count": 120, "revenue": 12000.00},
                    {"status": "pending", "count": 15, "revenue": 1500.00},
                    {"status": "refunded", "count": 5, "revenue": -500.00},
                    {"status": "failed", "count": 3, "revenue": 0.00},
                ],
            }],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "paid" in prompt
        assert "120 orders" in prompt
        assert "pending" in prompt
        assert "refunded" in prompt
        assert "failed" in prompt

    def test_build_system_prompt_revenue_trends(self, agent):
        """revenue_trends record is formatted correctly with daily data."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{
                "type": "revenue_trends",
                "total_revenue": 45000.00,
                "total_orders": 300,
                "revenue_last_7_days": 8500.00,
                "avg_order_value": "150.00",
                "daily_revenue": [
                    {"date": "2026-06-23", "revenue": 1200.00},
                    {"date": "2026-06-24", "revenue": 1350.00},
                ],
                "daily_orders": [
                    {"date": "2026-06-23", "orders": 8},
                    {"date": "2026-06-24", "orders": 9},
                ],
            }],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "$45,000.00" in prompt or "$45000.00" in prompt
        assert "300 orders" in prompt
        assert "$8,500.00" in prompt or "$8500.00" in prompt
        assert "$150.00" in prompt
        assert "1200" in prompt
        assert "06-23" in prompt
        assert "06-24" in prompt

    def test_build_system_prompt_traffic_sources(self, agent):
        """traffic_sources record is formatted correctly."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{
                "type": "traffic_sources",
                "sources": [
                    {"source": "organic_search", "visits": 12000, "orders": 450, "revenue": "45000.00"},
                    {"source": "social", "visits": 8000, "orders": 200, "revenue": "18000.00"},
                    {"source": "email", "visits": 3000, "orders": 180, "revenue": "22000.00"},
                ],
            }],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "organic_search" in prompt or "organic search" in prompt
        assert "12000 visits" in prompt
        assert "450 orders" in prompt
        assert "$45000.00" in prompt or "$45,000" in prompt

    def test_build_system_prompt_campaign_performance(self, agent):
        """campaign_performance record is formatted correctly."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{
                "type": "campaign_performance",
                "campaigns": [
                    {
                        "name": "Summer Sale",
                        "channel": "google_ads",
                        "spend": "5000.00",
                        "impressions": 50000,
                        "clicks": 1500,
                        "conversions": 120,
                        "revenue": "15000.00",
                        "roas": "3.00",
                    },
                ],
            }],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "Summer Sale" in prompt
        assert "google_ads" in prompt
        assert "$5,000.00" in prompt or "$5000.00" in prompt
        assert "50000 impressions" in prompt
        assert "120 conversions" in prompt
        assert "3.00" in prompt or "ROAS" in prompt

    def test_build_system_prompt_search_query_data(self, agent):
        """search_query_data record is formatted correctly."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{
                "type": "search_query_data",
                "queries": [
                    {"query": "wireless headphones", "impressions": 8500, "clicks": 680, "avg_position": 2.5},
                    {"query": "running shoes", "impressions": 6200, "clicks": 410, "avg_position": 3.1},
                ],
            }],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "wireless headphones" in prompt
        assert "8500 impressions" in prompt
        assert "680 clicks" in prompt
        assert "2.5" in prompt or "avg position" in prompt

    def test_build_system_prompt_seo_rankings(self, agent):
        """seo_rankings record is formatted correctly."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{
                "type": "seo_rankings",
                "keywords": [
                    {"keyword": "wireless headphones", "page": "/products/wireless-headphones", "position": 3, "search_volume": 2400},
                    {"keyword": "buy headphones online", "page": "/products/wireless-headphones", "position": 7, "search_volume": 1200},
                ],
            }],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "wireless headphones" in prompt
        assert "position 3" in prompt
        assert "/products/wireless-headphones" in prompt
        assert "2400" in prompt or "volume" in prompt

    def test_build_system_prompt_top_products(self, agent):
        """top_products record is formatted correctly."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[{
                "type": "top_products",
                "products": [
                    {"name": "Wireless Headphones", "revenue": 4500.00, "quantity": 60},
                    {"name": "Yoga Mat", "revenue": 2800.00, "quantity": 70},
                ],
            }],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "Wireless Headphones" in prompt
        assert "$4,500.00" in prompt or "$4500.00" in prompt
        assert "60 units" in prompt or "60)" in prompt

    def test_build_system_prompt_all_new_record_types(self, agent):
        """All new analytics record types produce a coherent combined prompt."""
        ctx = ChatContext(
            conversation_id="t",
            product_catalog=[
                {
                    "type": "product_performance",
                    "total_products": 50, "active_products": 45,
                    "categories": [{"name": "electronics", "count": 20, "avgPrice": 4000}],
                },
                {
                    "type": "order_funnel",
                    "funnel": [{"status": "paid", "count": 200, "revenue": 30000.00}],
                },
                {
                    "type": "revenue_trends",
                    "total_revenue": 50000.00, "total_orders": 350,
                    "revenue_last_7_days": 9000.00, "avg_order_value": "142.86",
                    "daily_revenue": [], "daily_orders": [],
                },
                {
                    "type": "traffic_sources",
                    "sources": [{"source": "direct", "visits": 5000, "orders": 150, "revenue": "15000.00"}],
                },
                {
                    "type": "campaign_performance",
                    "campaigns": [{"name": "Test", "channel": "email", "spend": "1000", "impressions": 10000, "clicks": 300, "conversions": 25, "revenue": "5000", "roas": "5.00"}],
                },
                {
                    "type": "search_query_data",
                    "queries": [{"query": "test query", "impressions": 1000, "clicks": 80, "avg_position": 4.0}],
                },
                {
                    "type": "seo_rankings",
                    "keywords": [{"keyword": "test kw", "page": "/test", "position": 5, "search_volume": 500}],
                },
                {
                    "type": "top_products",
                    "products": [{"name": "Test Product", "revenue": 1200.00, "quantity": 15}],
                },
            ],
        )
        prompt = agent._build_system_prompt(ctx)
        assert "50 total" in prompt
        assert "paid" in prompt
        assert "$50,000" in prompt or "$50000.00" in prompt
        assert "direct" in prompt
        assert "test query" in prompt or "Test" in prompt
        assert "test kw" in prompt
        assert "Test Product" in prompt
