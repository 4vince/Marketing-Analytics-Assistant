# Business Auditor agent — identifies hidden profit leaks across sales, inventory,
# refunds, and supplier operations using four specialized sub-analyzers.
#
# Each sub-analyzer produces structured findings with estimated dollar impact,
# so the admin can prioritize fixes by expected ROI.
#
# Scoring: 0-100 overall health score (higher = fewer leaks).
#   - ≥80  — Healthy. Minor optimization opportunities.
#   - ≥50  — Moderate leaks detected. Actionable improvements available.
#   - <50  — Significant profit leakage. Immediate attention recommended.

import json
from typing import Any

from .base import BaseAgent, AnalysisResult


# ── Sub-analyzers ──────────────────────────────────────────────────────────

def analyze_sales(data: dict) -> dict[str, Any]:
    """Identify revenue leakage from sales patterns, discounts, abandoned carts,
    and underperforming order lines.

    Returns a structured summary for the LLM.
    """
    orders = data.get("orders", [])
    campaigns = data.get("campaigns", [])

    total_revenue = sum(o.get("total", 0) for o in orders)
    total_orders = len(orders)
    pending_orders = sum(1 for o in orders if o.get("status") == "pending")
    completed_orders = sum(1 for o in orders if o.get("status") == "completed")
    cancelled_orders = sum(1 for o in orders if o.get("status") == "cancelled")

    # Campaign / marketing ROI
    total_ad_spend = sum(c.get("spend", 0) for c in campaigns)
    total_ad_revenue = sum(c.get("revenue", 0) for c in campaigns)
    total_clicks = sum(c.get("clicks", 0) for c in campaigns)
    total_conversions = sum(c.get("conversions", 0) for c in campaigns)

    return {
        "total_orders": total_orders,
        "total_revenue_cents": total_revenue,
        "avg_order_value_cents": total_revenue / total_orders if total_orders else 0,
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "cancellation_rate_pct": round(cancelled_orders / total_orders * 100, 1) if total_orders else 0,
        "total_ad_spend_cents": total_ad_spend,
        "total_ad_revenue_cents": total_ad_revenue,
        "ad_roi": round(total_ad_revenue / total_ad_spend, 2) if total_ad_spend else 0,
        "total_conversions": total_conversions,
        "total_clicks": total_clicks,
        "conversion_rate_pct": round(total_conversions / total_clicks * 100, 1) if total_clicks else 0,
    }


def analyze_inventory(data: dict) -> dict[str, Any]:
    """Identify capital tied up in dead stock, slow movers, and pricing gaps.

    Returns a structured summary for the LLM.
    """
    products = data.get("products", [])

    total_products = len(products)
    active_products = sum(1 for p in products if p.get("status") == "active")
    inactive_products = sum(1 for p in products if p.get("status") != "active")

    # Identify dead stock (products with status inactive / archived)
    # and potential overpricing (compareAtPrice > price suggests a discount was planned)
    discounted_products = sum(1 for p in products if p.get("compareAtPrice") and p.get("compareAtPrice", 0) > 0)
    total_inventory_value = sum(p.get("price", 0) for p in products)
    total_discount = sum(
        max(0, (p.get("compareAtPrice", 0) or 0) - p.get("price", 0))
        for p in products
    )

    # Category distribution
    categories: dict[str, int] = {}
    for p in products:
        cat = p.get("category", "uncategorized")
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "total_products": total_products,
        "active_products": active_products,
        "inactive_products": inactive_products,
        "inactive_ratio_pct": round(inactive_products / total_products * 100, 1) if total_products else 0,
        "discounted_products": discounted_products,
        "total_inventory_value_cents": total_inventory_value,
        "total_discount_given_cents": total_discount,
        "avg_discount_per_product_cents": round(total_discount / total_products) if total_products else 0,
        "categories": categories,
    }


def analyze_refunds(data: dict) -> dict[str, Any]:
    """Identify refund patterns, return rate by reason, and estimated loss.

    Returns a structured summary for the LLM.
    """
    refunds = data.get("refunds", [])
    orders = data.get("orders", [])

    total_refunds = len(refunds)
    total_refund_amount = sum(r.get("amount", 0) for r in refunds)
    total_revenue = sum(o.get("total", 0) for o in orders)

    # Refund reasons breakdown
    reasons: dict[str, dict[str, Any]] = {}
    for r in refunds:
        reason = r.get("reason", "other")
        if reason not in reasons:
            reasons[reason] = {"count": 0, "total_amount_cents": 0}
        reasons[reason]["count"] += 1
        reasons[reason]["total_amount_cents"] += r.get("amount", 0)

    top_reason = max(reasons.items(), key=lambda x: x[1]["total_amount_cents"]) if reasons else ("none", {})

    return {
        "total_refunds": total_refunds,
        "total_refund_amount_cents": total_refund_amount,
        "refund_rate_pct": round(total_refunds / len(orders) * 100, 1) if orders else 0,
        "refund_to_revenue_pct": round(total_refund_amount / total_revenue * 100, 1) if total_revenue else 0,
        "refund_reasons": reasons,
        "top_refund_reason": top_reason[0],
        "top_refund_reason_amount_cents": top_reason[1]["total_amount_cents"] if reasons else 0,
        "avg_refund_amount_cents": round(total_refund_amount / total_refunds) if total_refunds else 0,
    }


def analyze_suppliers(data: dict) -> dict[str, Any]:
    """Identify supplier-related profit leaks — pricing, reliability, lead time.

    Returns a structured summary for the LLM.
    """
    suppliers = data.get("suppliers", [])
    products = data.get("products", [])

    total_suppliers = len(suppliers)

    # Supplier reliability
    low_reliability = sum(1 for s in suppliers if (s.get("reliability") or 1.0) < 0.8)
    high_lead_time = sum(1 for s in suppliers if (s.get("leadTimeDays") or 0) > 30)

    # Cost impact: products with high cost multiplier vs. their price
    high_cost_suppliers = sum(1 for s in suppliers if (s.get("costMultiplier") or 1.0) > 1.0)
    avg_cost_multiplier = (
        sum(s.get("costMultiplier", 1.0) or 1.0 for s in suppliers) / total_suppliers
        if total_suppliers else 1.0
    )

    # Product pricing vs compareAtPrice (proxy for cost margin erosion)
    margin_eroded = sum(
        1 for p in products
        if p.get("compareAtPrice") and p.get("price", 0) < (p.get("compareAtPrice", 0) or 0) * 0.7
    )

    return {
        "total_suppliers": total_suppliers,
        "low_reliability_suppliers": low_reliability,
        "high_lead_time_suppliers": high_lead_time,
        "high_cost_suppliers": high_cost_suppliers,
        "avg_cost_multiplier": round(avg_cost_multiplier, 2),
        "products_with_eroded_margin": margin_eroded,
    }


# ── Main Agent ─────────────────────────────────────────────────────────────

class BusinessAuditorAgent(BaseAgent):
    """Aggregates data from four sub-analyzers and runs LLM analysis to
    identify hidden profit leaks with estimated dollar impact."""

    use_complex_model = True

    def analyze(self, content: dict) -> AnalysisResult:
        # Run sub-analyzers in sequence (they're pure data transforms, no I/O)
        sales_data = analyze_sales(content)
        inventory_data = analyze_inventory(content)
        refund_data = analyze_refunds(content)
        supplier_data = analyze_suppliers(content)

        return self._run_llm_analysis(
            self._system_prompt(),
            self._user_prompt(sales_data, inventory_data, refund_data, supplier_data),
        )

    @staticmethod
    def _system_prompt() -> str:
        return (
            "You are a forensic e-commerce business auditor. Your role is to examine "
            "sales, inventory, refund, and supplier data to uncover hidden profit leaks. "
            "Follow these rules:\n\n"

            "1. **Monetary impact**: Every finding MUST include an estimated annualized "
            "dollar impact in cents (e.g., 50000 = $500). Be specific — show your math.\n\n"

            "2. **Severity levels**:\n"
            '   - "critical" — leak exceeds 20% of revenue or represents an existential risk\n'
            '   - "high" — meaningful profit erosion (5-20% of revenue)\n'
            '   - "medium" — moderate opportunity (1-5% of revenue)\n'
            '   - "low" — minor optimization\n\n'

            "3. **Actionability**: Every suggestion must include:\n"
            '   - "impact" ("high"/"medium"/"low") — how much this fixes the leak\n'
            '   - "effort" ("low"/"medium"/"high") — how hard to implement\n'
            '   - "expected_savings_cents" — estimated annual savings\n\n'

            "4. **Category tagging**: Tag each finding with a `category` field: "
            '"sales", "inventory", "refunds", or "suppliers".\n\n'

            "5. **Be specific**: Reference actual numbers from the data. "
            "Don't say 'high cancellation rate' — say '15.3% cancellation rate costs ~$12,000/yr'.\n\n"

            "6. Return ONLY valid JSON matching the schema. No markdown, no additional text."
        )

    @staticmethod
    def _user_prompt(
        sales_data: dict,
        inventory_data: dict,
        refund_data: dict,
        supplier_data: dict,
    ) -> str:
        return f"""
Analyze this e-commerce business for hidden profit leaks across all four domains.

## Sales Data
{json.dumps(sales_data, indent=2)}

## Inventory Data
{json.dumps(inventory_data, indent=2)}

## Refund Data
{json.dumps(refund_data, indent=2)}

## Supplier Data
{json.dumps(supplier_data, indent=2)}

## Analysis Requirements

1. **Score the business** from 0-100 (100 = no leaks, perfect health).
2. **Identify the 3-7 most impactful profit leaks** across all domains.
3. **For each finding**, estimate the annualized monetary impact in USD cents.
4. **For each suggestion**, provide impact, effort, and expected savings.

## Return Format

Return valid JSON with this exact structure:
{{
  "score": <int 0-100>,
  "findings": [
    {{
      "issue": "<short description of the leak>",
      "severity": "critical" | "high" | "medium" | "low",
      "detail": "<detailed explanation including specific numbers and annualized impact>",
      "category": "sales" | "inventory" | "refunds" | "suppliers",
      "estimated_annual_loss_cents": <int>
    }}
  ],
  "suggestions": [
    {{
      "area": "<domain name>",
      "suggestion": "<actionable, specific suggestion>",
      "impact": "high" | "medium" | "low",
      "effort": "low" | "medium" | "high",
      "expected_savings_cents": <int>
    }}
  ]
}}

Return ONLY the JSON object. No markdown fences, no explanation.
"""
