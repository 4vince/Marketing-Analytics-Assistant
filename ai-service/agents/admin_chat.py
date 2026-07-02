# Admin chat agent — business intelligence assistant that answers questions using live store context.
#
# SECURITY: This agent passes AgentType.ADMIN, which loads skills ONLY
# from skills/admin/. Customer-originated text in the context is sanitized
# via sanitize_customer_text() before it enters any prompt assembly, and
# injection attempts are logged for monitoring.
import logging

from .base import ChatAgent, ChatContext, ChatResponse
from .types import AgentType
from .sanitizer import sanitize_customer_text, contains_injection_attempt

logger = logging.getLogger(__name__)


class AdminChatAgent(ChatAgent):
    """Business intelligence assistant for the admin panel.

    Answers questions about products, orders, revenue, traffic, campaigns,
    SEO, and analytics using business context passed in from the live database.
    Skills are loaded from skills/admin/ only. Customer-originated text is
    sanitized before prompt assembly.
    """

    def __init__(self):
        super().__init__(agent_type=AgentType.ADMIN)

    async def respond(self, message: str, context: ChatContext) -> ChatResponse:
        # If no business context was provided by the frontend, auto-fetch
        # from the database using the scoped admin_user role (read-only).
        if not context.product_catalog:
            fetched = await self._fetch_analytics_context()
            if fetched:
                context.product_catalog = fetched
                logger.info(
                    "[AdminChat] Auto-fetched %d context records via admin_user",
                    len(fetched),
                )

        system = self._build_system_prompt(context)
        return await self._chat_with_llm(system, message)

    async def _fetch_analytics_context(self) -> list[dict]:
        """Fetch admin analytics data from PostgreSQL using the scoped admin_user role.

        Connects via DatabasePool using AgentType.ADMIN credentials (read-only).
        Returns context records in the same format _build_system_prompt expects,
        or an empty list if the database is unavailable.

        Security: The admin_user role has SELECT-only permissions on all tables
        (INSERT/UPDATE/DELETE are revoked at the database level). Even if the
        LLM were to generate a malicious query, it cannot modify data through
        this connection.
        """
        from db import pool

        conn = await pool.get_connection(AgentType.ADMIN)
        if conn is None:
            logger.info("[AdminChat] No scoped DB connection available — skipping auto-fetch")
            return []

        try:
            context: list[dict] = []

            # ── Product summary ──────────────────────────────────────────────
            row = await conn.fetchrow("""
                SELECT COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                       COUNT(DISTINCT category)::int AS categories
                FROM products
            """)
            if row and row["total"] > 0:
                context.append({
                    "type": "product_summary",
                    "total": row["total"],
                    "active": row["active"],
                    "categories": row["categories"],
                })

            # ── Order summary ────────────────────────────────────────────────
            row = await conn.fetchrow("""
                SELECT COUNT(*)::int AS total,
                       MAX(created_at)::text AS latest
                FROM orders
            """)
            if row and row["total"] > 0:
                latest = row["latest"][:10] if row["latest"] else "N/A"
                context.append({
                    "type": "order_summary",
                    "total": row["total"],
                    "latest": latest,
                })

            # ── Revenue ──────────────────────────────────────────────────────
            row = await conn.fetchrow("""
                SELECT COALESCE(SUM(total), 0)::int AS total,
                       COUNT(*)::int AS order_count
                FROM orders
            """)
            if row and row["order_count"] > 0:
                context.append({
                    "type": "revenue",
                    "total": round(row["total"] / 100.0, 2),
                    "order_count": row["order_count"],
                })

            # ── Recent orders ────────────────────────────────────────────────
            rows = await conn.fetch("""
                SELECT id, customer_name, customer_email, total, status
                FROM orders
                ORDER BY created_at DESC
                LIMIT 5
            """)
            if rows:
                context.append({
                    "type": "recent_orders",
                    "orders": [
                        {
                            "id": r["id"],
                            "customer": r["customer_name"],
                            "total": round(r["total"] / 100.0, 2),
                            "status": r["status"],
                        }
                        for r in rows
                    ],
                })

            # ── Order funnel ─────────────────────────────────────────────────
            rows = await conn.fetch("""
                SELECT status,
                       COUNT(*)::int AS count,
                       COALESCE(SUM(total), 0)::int AS revenue
                FROM orders
                GROUP BY status
            """)
            if rows:
                context.append({
                    "type": "order_funnel",
                    "funnel": [
                        {
                            "status": r["status"],
                            "count": r["count"],
                            "revenue": round(r["revenue"] / 100.0, 2),
                        }
                        for r in rows
                    ],
                })

            # ── Traffic sources ──────────────────────────────────────────────
            rows = await conn.fetch("""
                SELECT source,
                       SUM(visits)::int AS visits,
                       SUM(orders)::int AS orders,
                       COALESCE(SUM(revenue), 0)::int AS revenue
                FROM traffic_sources
                GROUP BY source
                ORDER BY visits DESC
            """)
            if rows:
                context.append({
                    "type": "traffic_sources",
                    "sources": [
                        {
                            "source": r["source"],
                            "visits": r["visits"],
                            "orders": r["orders"],
                            "revenue": str(round(r["revenue"] / 100.0, 2)),
                        }
                        for r in rows
                    ],
                })

            # ── Campaign performance ─────────────────────────────────────────
            rows = await conn.fetch("""
                SELECT name, channel,
                       SUM(spend)::int AS spend,
                       SUM(impressions)::int AS impressions,
                       SUM(clicks)::int AS clicks,
                       SUM(conversions)::int AS conversions,
                       COALESCE(SUM(revenue), 0)::int AS revenue
                FROM campaigns
                GROUP BY name, channel
                ORDER BY revenue DESC
                LIMIT 10
            """)
            if rows:
                context.append({
                    "type": "campaign_performance",
                    "campaigns": [
                        {
                            "name": r["name"],
                            "channel": r["channel"],
                            "spend": str(round(r["spend"] / 100.0, 2)),
                            "impressions": r["impressions"],
                            "clicks": r["clicks"],
                            "conversions": r["conversions"],
                            "revenue": str(round(r["revenue"] / 100.0, 2)),
                            "roas": (
                                f"{r['revenue'] / r['spend']:.2f}"
                                if r["spend"] > 0 else "0"
                            ),
                        }
                        for r in rows
                    ],
                })

            # ── Search query data ────────────────────────────────────────────
            rows = await conn.fetch("""
                SELECT query,
                       SUM(impressions)::int AS impressions,
                       SUM(clicks)::int AS clicks,
                       AVG(avg_position)::float AS avg_position
                FROM search_query_data
                GROUP BY query
                ORDER BY impressions DESC
                LIMIT 10
            """)
            if rows:
                context.append({
                    "type": "search_query_data",
                    "queries": [
                        {
                            "query": r["query"],
                            "impressions": r["impressions"],
                            "clicks": r["clicks"],
                            "avg_position": r["avg_position"],
                        }
                        for r in rows
                    ],
                })

            # ── SEO rankings ─────────────────────────────────────────────────
            rows = await conn.fetch("""
                SELECT keyword, page, position, search_volume
                FROM seo_rankings
                ORDER BY position ASC
                LIMIT 10
            """)
            if rows:
                context.append({
                    "type": "seo_rankings",
                    "keywords": [
                        {
                            "keyword": r["keyword"],
                            "page": r["page"],
                            "position": r["position"],
                            "search_volume": r["search_volume"] or 0,
                        }
                        for r in rows
                    ],
                })

            return context

        except Exception as e:
            logger.warning(
                "[AdminChat] Failed to auto-fetch analytics context: %s",
                e,
            )
            return []
        finally:
            if conn:
                await conn.close()

    @staticmethod
    def _get_role_instructions() -> str:
        """Role instructions for the admin BI assistant."""
        return """You are a business intelligence assistant for an e-commerce store admin panel.
You help store admins understand their products, orders, revenue, and analytics.
Answer concisely and base your answers on the data provided below.
If you don't know something or the data isn't available, say so."""

    def _build_system_prompt(self, context: ChatContext) -> str:
        """Build a system prompt from the business context records.

        Customer-originated text fields are sanitized before inclusion.
        """
        # Start with base instructions + admin skills
        base = self._build_base_system_prompt(context)

        # Build the context data block from the product catalog (sanitized)
        context_data = context.product_catalog or []
        sanitized_data = self._sanitize_catalog(context_data)
        context_block = self._format_context_block(sanitized_data)

        if context_block:
            return f"{base}\n\n{context_block}"
        return base

    @staticmethod
    def _sanitize_catalog(records: list[dict]) -> list[dict]:
        """Sanitize customer-originated text fields in context records.

        Scans all string values in the catalog records (including nested
        dicts and lists) for prompt injection patterns and sanitizes them.
        Logs a warning when an attempt is detected.
        """
        def _sanitize(value, path=""):
            if isinstance(value, str):
                if contains_injection_attempt(value):
                    logger.warning(
                        "Injection attempt detected in admin context "
                        "at '%s': %.80s", path, value
                    )
                return sanitize_customer_text(value)
            elif isinstance(value, dict):
                return {
                    k: _sanitize(v, f"{path}.{k}" if path else k)
                    for k, v in value.items()
                }
            elif isinstance(value, list):
                return [
                    _sanitize(item, f"{path}[{i}]" if path else f"[{i}]")
                    for i, item in enumerate(value)
                ]
            return value

        return [_sanitize(record) for record in records]

    @staticmethod
    def _format_context_block(context_data: list[dict]) -> str:
        """Format business context records into a readable string block."""
        parts: list[str] = []

        for record in context_data:
            record_type = record.get("type", "")
            if record_type == "product_performance":
                cats = record.get("categories", [])
                cat_lines = ", ".join(
                    f"{c.get('name', '?')}: {c.get('count', 0)} (${c.get('avgPrice', 0)} avg)"
                    for c in cats
                )
                parts.append(
                    f"\nProducts: {record.get('total_products', 0)} total "
                    f"({record.get('active_products', 0)} active). "
                    f"Categories: {cat_lines}."
                )
            elif record_type == "order_funnel":
                funnel = record.get("funnel", [])
                lines = [f"\nOrder funnel (count + revenue by status):"]
                for f in funnel:
                    lines.append(
                        f"  - {f.get('status', '?')}: {f.get('count', 0)} orders, "
                        f"${f.get('revenue', 0):.2f}"
                    )
                parts.append("".join(lines))
            elif record_type == "revenue_trends":
                row = record
                parts.append(
                    f"\nRevenue: ${row.get('total_revenue', 0):.2f} total "
                    f"across {row.get('total_orders', 0)} orders. "
                    f"Last 7 days: ${row.get('revenue_last_7_days', 0):.2f}. "
                    f"AOV: ${row.get('avg_order_value', '0')}."
                )
                daily = row.get("daily_revenue", [])
                if daily:
                    sample = daily[-7:] if len(daily) > 7 else daily
                    trend = ", ".join(
                        f"{d.get('date', '')[-5:]}=${d.get('revenue', 0):.0f}"
                        for d in sample
                    )
                    parts.append(f"  Daily revenue (recent): {trend}")
                orders_daily = row.get("daily_orders", [])
                if orders_daily:
                    sample = orders_daily[-7:] if len(orders_daily) > 7 else orders_daily
                    trend = ", ".join(
                        f"{d.get('date', '')[-5:]}={d.get('orders', 0)}"
                        for d in sample
                    )
                    parts.append(f"  Daily orders (recent): {trend}")
            elif record_type == "traffic_sources":
                sources = record.get("sources", [])
                lines = [f"\nTraffic sources (last 30 days):"]
                for s in sources:
                    lines.append(
                        f"  - {s.get('source', '?')}: {s.get('visits', 0)} visits, "
                        f"{s.get('orders', 0)} orders, ${s.get('revenue', '0')} revenue"
                    )
                parts.append("".join(lines))
            elif record_type == "campaign_performance":
                campaigns = record.get("campaigns", [])
                lines = [f"\nCampaigns (last 30 days):"]
                for c in campaigns:
                    lines.append(
                        f"  - {c.get('name', '?')} ({c.get('channel', '?')}): "
                        f"spent ${c.get('spend', '0')}, "
                        f"{c.get('impressions', 0)} impressions, "
                        f"{c.get('clicks', 0)} clicks, "
                        f"{c.get('conversions', 0)} conversions, "
                        f"${c.get('revenue', '0')} revenue, "
                        f"ROAS {c.get('roas', '0')}x"
                    )
                parts.append("".join(lines))
            elif record_type == "search_query_data":
                queries = record.get("queries", [])
                lines = [f"\nTop search queries (last 30 days):"]
                for q in queries:
                    pos = q.get("avg_position")
                    pos_str = f", avg position {pos}" if pos else ""
                    lines.append(
                        f"  - \"{q.get('query', '?')}\": "
                        f"{q.get('impressions', 0)} impressions, "
                        f"{q.get('clicks', 0)} clicks{pos_str}"
                    )
                parts.append("".join(lines))
            elif record_type == "seo_rankings":
                keywords = record.get("keywords", [])
                lines = [f"\nSEO rankings (latest positions):"]
                for k in keywords:
                    lines.append(
                        f"  - \"{k.get('keyword', '?')}\": "
                        f"position {k.get('position', '?')}, "
                        f"page \"{k.get('page', '?')}\", "
                        f"volume {k.get('search_volume', 0)}"
                    )
                parts.append("".join(lines))
            elif record_type == "top_products":
                products = record.get("products", [])
                lines = [f"\nTop products by revenue (last 30 days):"]
                for p in products:
                    lines.append(
                        f"  - {p.get('name', '?')}: "
                        f"${p.get('revenue', 0):.2f} ({p.get('quantity', 0)} units)"
                    )
                parts.append("".join(lines))

            # ── Legacy record types ────────────────────────────────────────────
            elif record_type == "product_summary":
                parts.append(
                    f"\nProducts: {record.get('total', 'N/A')} total "
                    f"({record.get('active', 'N/A')} active) "
                    f"across {record.get('categories', 'N/A')} categories."
                )
            elif record_type == "order_summary":
                parts.append(
                    f"\nOrders: {record.get('total', 'N/A')} total. "
                    f"Latest: {record.get('latest', 'N/A')}."
                )
            elif record_type == "revenue":
                parts.append(
                    f"\nRevenue: ${record.get('total', 0):.2f} total "
                    f"across {record.get('order_count', 0)} orders."
                )
            elif record_type == "recent_orders":
                orders = record.get("orders", [])
                if orders:
                    lines = [f"\nRecent orders:"]
                    for o in orders:
                        lines.append(
                            f"  - {o.get('id', '')[:8]}: {o.get('customer', '')} "
                            f"${o.get('total', 0):.2f} ({o.get('status', '')})"
                        )
                    parts.append("".join(lines))
            elif record_type == "analysis_summary":
                scores = record.get("average_scores", {})
                if scores:
                    lines = [f"\nAnalysis scores (average by agent):"]
                    for agent, score in scores.items():
                        lines.append(f"  - {agent}: {score}/100")
                    parts.append("".join(lines))
            elif record_type == "recent_reports":
                reports = record.get("reports", [])
                if reports:
                    lines = [f"\nLatest quarterly reports:"]
                    for r in reports[:3]:
                        lines.append(
                            f"  - {r.get('period', '')}: "
                            f"score {r.get('score', 'N/A')}/100"
                        )
                    parts.append("".join(lines))

        return "\n".join(parts)
