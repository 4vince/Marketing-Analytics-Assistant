# Competitor Analysis Agent — scrapes competitor websites via the scraper utility,
# compares data against the user's own products, and produces a structured 9-section
# competitive analysis with SWOT grid, executive summary, and a full markdown report.
#
# Scoring: 0-100 overall competitive position (higher = stronger vs competitor).
#   - >= 80  — Strongly positioned. Few competitive threats.
#   - >= 50  — Competitive. Actionable improvements available.
#   - < 50   — Vulnerable. Significant strategic gaps to address.

import json
import logging
from typing import Any

from .base import BaseAgent, AnalysisResult

logger = logging.getLogger(__name__)

SECTION_LABELS = {
    "core_product": "Core Product",
    "value_props": "Value Propositions",
    "features": "Features",
    "pricing": "Pricing",
    "target_audience": "Target Audience",
    "market_presence": "Market Presence",
    "swot_grid": "SWOT Grid",
    "why_choose_us": "Why Merchants Choose Us",
    "objections": "Possible Objections",
}


class CompetitorAnalysisAgent(BaseAgent):
    """Analyzes a competitor's website and produces a structured 9-section competitive
    analysis with SWOT grid, executive summary, and a full narrative report."""

    use_complex_model = True

    def analyze(self, content: dict) -> AnalysisResult:
        competitor = content.get("competitor", {})
        scraped_data = content.get("scraped_data", {})
        own_products = content.get("own_products", [])

        if self.llm is None:
            return self._fallback_result("LLM client could not be initialized.")

        model = self._get_model()
        system_prompt = self._system_prompt()
        user_prompt = self._user_prompt(competitor, scraped_data, own_products)

        last_error: str | None = None
        for attempt in range(self.max_retries + 1):
            try:
                raw = self.llm.chat(system_prompt, user_prompt, model=model)
                data = json.loads(raw)

                summary = data.get("summary", "")
                markdown_report = data.get("markdown_report", "")

                result = self._build_result(data)
                # Extra fields for report generation (stored via __dict__ since
                # AnalysisResult is a strict Pydantic model without extra=allow)
                result.__dict__["summary"] = summary
                result.__dict__["markdown_report"] = markdown_report
                return result

            except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
                last_error = str(e)
                logger.warning("[CompetitorAnalysis] Attempt %d/%d failed: %s", attempt + 1, self.max_retries + 1, e)
                continue

        return self._fallback_result(
            f"Analysis failed after {self.max_retries + 1} attempts: {last_error}"
        )

    @staticmethod
    def _system_prompt() -> str:
        return (
            "You are an expert competitive intelligence analyst for e-commerce businesses. "
            "Your role is to analyze competitor websites and produce structured strategic analysis.\n\n"

            "You will receive:\n"
            "1. **Competitor info** (name, domain, notes)\n"
            "2. **Scraped website data** — raw intelligence gathered from the competitor's site\n"
            "3. **Your own store's products** — for comparison against the competitor\n\n"

            "## Analysis Sections\n\n"

            "Produce findings organized into these 9 sections. Every finding MUST include "
            "a `section` field matching one of these slugs:\n\n"

            '1. **core_product** — What is their main offering? Catalog breadth, product types, '
            "categories they serve. Compare with your own catalog.\n"
            '2. **value_props** — Key value propositions found on the site (headlines, USPs, '
            "guarantees, trust signals, emotional appeals). How do they position themselves?\n"
            '3. **features** — Product features, site capabilities, shipping policies, '
            "support options, return policies, payment methods.\n"
            '4. **pricing** — Pricing strategy analysis. SEPARATE hardware (one-time) from '
            "software (subscription) pricing. Note discounts, tiers, freemium, and compare "
            "to your own pricing. Include specific dollar amounts.\n"
            '5. **target_audience** — Who are they targeting? B2B or B2C? Segments, '
            "persona signals from tone, visuals, content, pricing.\n"
            '6. **market_presence** — SEO signals (meta tags, schema markup), social proof '
            "(reviews, testimonials, case studies), content marketing, brand recognition signals.\n"
            '7. **swot_grid** — Formal SWOT items. Each finding MUST also have a `category` '
            'field: "strength" (competitor advantage), "weakness" (competitor gap), '
            '"opportunity" (market gap you can exploit), or "threat" (risk to your position).\n'
            '8. **why_choose_us** — Specific reasons a merchant would pick YOUR store over '
            "this competitor. Be concrete — reference actual product, pricing, or positioning differences.\n"
            '9. **objections** — Why a merchant might choose the competitor instead. Be candid. '
            "Each objection should identify a real risk and suggest how to address it.\n\n"

            "## Output Rules\n\n"
            "1. **Be specific.** Reference actual prices, product names, categories, and data from the "
            "scraped content. Don't make vague claims.\n"
            "2. **Be balanced.** Acknowledge genuine competitor strengths, not just weaknesses.\n"
            "3. **Severity levels:**\n"
            '   - "critical" — existential competitive threat or major gap\n'
            '   - "high" — significant competitive disadvantage or opportunity\n'
            '   - "medium" — moderate difference worth addressing\n'
            '   - "low" — minor difference, nice-to-have\n'
            "4. **Suggestion impact/effort:** Every suggestion should have impact and effort ratings.\n"
            "5. **Evidence-based.** When citing scraped data, reference what you saw "
            "(e.g., 'Homepage headline emphasizes ...', 'Product page for X priced at $Y').\n\n"

            "## Score\n\n"
            "Score the overall competitive position 0-100:\n"
            "- 80+ — Strongly positioned vs this competitor\n"
            "- 50-79 — Competitive, but has some advantages worth addressing\n"
            "- Below 50 — Vulnerable; this competitor has meaningful advantages\n\n"

            "## Markdown Report\n\n"
            "In addition to the structured findings, generate a `markdown_report` field containing "
            "a full narrative competitive analysis report in Markdown format. This should read like "
            "a consulting document with:\n\n"
            "- **Executive Summary** — 2-3 paragraphs overview\n"
            "- **Sections 1-6** as prose with subheadings, bullet points, and data callouts\n"
            "- **SWOT Analysis** as a formal markdown table or 2×2 matrix\n"
            "- **Strategic Recommendations** — 3-5 actionable next steps\n"
            "- **Summary** — Closing assessment\n\n"

            "Also provide a short `summary` field (2-3 sentences) for the executive summary.\n\n"

            "Return ONLY valid JSON. No markdown fences, no additional text."
        )

    @staticmethod
    def _user_prompt(competitor: dict, scraped_data: dict, own_products: list) -> str:
        name = competitor.get("name", "Unknown")
        domain = competitor.get("domain", "")
        notes = competitor.get("notes", "")

        # Format own products as a compact table for the LLM
        own_products_summary = []
        for p in own_products[:20]:
            own_products_summary.append({
                "name": p.get("name", ""),
                "price_cents": p.get("price", 0),
                "category": p.get("category", ""),
                "has_meta_title": bool(p.get("meta_title")),
                "has_meta_description": bool(p.get("meta_description")),
                "image_count": len(p.get("images", [])) if isinstance(p.get("images"), (list, tuple)) else 0,
                "slug": p.get("slug", ""),
            })

        # Scraped data summary
        homepage = scraped_data.get("homepage", {})
        product_pages = scraped_data.get("product_pages", [])
        all_pricing = scraped_data.get("all_pricing", [])
        all_features = scraped_data.get("all_features", [])
        errors = scraped_data.get("errors", [])
        has_data = scraped_data.get("has_data", False)
        pages_scraped = scraped_data.get("pages_scraped", 0)

        homepage_meta = homepage.get("meta") or {} if homepage else {}
        homepage_title = homepage_meta.get("title") or "N/A"
        homepage_desc = homepage_meta.get("description") or "N/A"
        homepage_nav = homepage.get("navigation") or []
        homepage_ctas = homepage.get("cta_buttons") or []
        homepage_pricing = homepage.get("pricing") or []

        errors_text = "\n".join(f"  - {e}" for e in errors) if errors else "None"

        # Format pricing as a table
        pricing_lines = []
        for p in all_pricing[:15]:
            pricing_lines.append(f"  - ${p['amount']:.2f} ({p['period']}) — context: {p['context_snippet']}")
        pricing_text = "\n".join(pricing_lines) if pricing_lines else "No pricing detected"

        # Format features
        features_text = "\n".join(f"  - {f}" for f in all_features[:20]) if all_features else "No features detected"

        # Format product pages (safe access)
        product_lines = []
        for pp in product_pages[:5]:
            pp_meta = pp.get("meta") or {}
            pp_title = pp_meta.get("title") or pp.get("url") or ""
            pp_pricing = pp.get("pricing") or []
            pp_word_count = pp.get("word_count") or 0
            pp_images = pp.get("images") or {}
            pp_has_images = bool(pp_images.get("total_images", 0) > 0)
            pp_headings = pp.get("headings") or []
            pp_features = pp.get("features") or []
            pp_ctas = pp.get("cta_buttons") or []
            product_lines.append(
                f"  - [{pp.get('type', 'page')}] {pp_title}\n"
                f"    Word count: {pp_word_count} | Images: {'Yes' if pp_has_images else 'No'}\n"
                f"    Pricing signals: {len(pp_pricing)} | Features found: {len(pp_features)}\n"
                f"    CTAs: {[c['text'] for c in pp_ctas if isinstance(c, dict)]}\n"
                f"    Key headings: {pp_headings[:5]}"
            )
        product_pages_text = "\n".join(product_lines) if product_lines else "No product pages scraped"

        # Homepage stats (safe access)
        has_schema = bool(homepage_meta.get("has_schema_markup"))
        social_proof = homepage.get("social_proof") or {}
        image_info = homepage.get("images") or {}

        return f"""
## Competitor: {name}

**Domain:** {domain}
**Notes:** {notes or "None"}
**Pages scraped:** {pages_scraped}
**Scrape errors:** {errors_text}
**Has usable data:** {has_data}

---

## Scraped Homepage Data

**Title:** {homepage_title}
**Meta Description:** {homepage_desc[:300]}
**Has Schema Markup:** {has_schema}
**Navigation categories:** {homepage_nav[:10]}
**Primary CTAs:** {[c['text'] for c in homepage_ctas]}
**Images:** {image_info.get('total_images', '?')} total ({image_info.get('images_with_alt', '?')} with alt text)
**Social proof signals:** {social_proof}

### Homepage Pricing Found
{pricing_text}

### Features/Value Props Found
{features_text}

---

## Scraped Product Pages
{product_pages_text}

---

## Your Store Products (for comparison)
```json
{json.dumps(own_products_summary, indent=2)}
```

---

## Analysis Instructions

Now analyze the competitor against your store using the 9-section framework defined in the system prompt.

Key comparisons to make:
1. **Product breadth** — How does their catalog compare to yours? Categories overlap or gaps?
2. **Pricing** — Compare their pricing (hardware + software separate) to yours. Where are they higher/lower?
3. **SEO & content** — How well optimized is their site compared to yours?
4. **Positioning** — How do they differentiate vs how you differentiate?
5. **SWOT** — Be specific and evidence-based for each quadrant.
6. **Why choose us** — Give concrete, compelling reasons based on actual data differences.
7. **Objections** — Be honest about where they beat you. These are the objections your sales/marketing need to overcome.

{"NOTE: The scraper encountered errors and could not fully scrape this competitor's site. Base your analysis on what data is available, noting limited visibility where appropriate." if errors and not has_data else ""}

Return ONLY valid JSON with this exact structure:
{{
  "score": <int 0-100>,
  "summary": "<2-3 sentence executive summary>",
  "findings": [
    {{
      "issue": "<short title>",
      "severity": "critical" | "high" | "medium" | "low",
      "detail": "<detailed analysis with evidence>",
      "section": "core_product" | "value_props" | "features" | "pricing" | "target_audience" | "market_presence" | "swot_grid" | "why_choose_us" | "objections",
      "category": "strength" | "weakness" | "opportunity" | "threat" | null,
      "competitor": "{name}"
    }}
  ],
  "suggestions": [
    {{
      "area": "<section or dimension>",
      "suggestion": "<actionable recommendation>",
      "impact": "high" | "medium" | "low",
      "effort": "low" | "medium" | "high",
      "competitor": "{name}"
    }}
  ],
  "markdown_report": "# Competitive Analysis: {name}\\n\\n..."
}}

Return ONLY the JSON object. No markdown fences, no explanation.
"""
