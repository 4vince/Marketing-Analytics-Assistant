# SEO analysis agent — evaluates product pages across 9 weighted dimensions using
# Agentic-SEO-Skill methodology: evidence-backed findings, confidence labels,
# and an impact/effort prioritization matrix.
#
# Scoring weights (sum to 100):
#   Title Tag         20%   Meta Description   15%   URL Slug          10%
#   Heading Structure  8%   Image Opt.         10%   Schema Markup     12%
#   Content Quality   15%   Core Web Vitals    5%    Internal Links     5%

import json
from .base import BaseAgent, AnalysisResult


# Product schema template for e-commerce JSON-LD recommendations
PRODUCT_SCHEMA_TEMPLATE = """
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{name}",
  "description": "{description}",
  "image": "{image}",
  "offers": {
    "@type": "Offer",
    "price": "{price}",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "category": "{category}"
}
"""


class SEOAgent(BaseAgent):
    """Evaluates product page SEO across 9 weighted dimensions with evidence-backed findings."""

    use_complex_model = True

    SCORING_WEIGHTS = """
    Scoring weights (each dimension 0-100, weighted average for final score):
    - Title Tag (20%): length (50-60 chars recommended), keyword placement,
      brand inclusion, stop word avoidance, uniqueness
    - Meta Description (15%): length (150-160 chars), keyword inclusion,
      call-to-action presence, readability, search intent alignment
    - URL Slug (10%): keyword usage, hyphens vs underscores, stop word usage,
      slug length vs content depth, structure (breadcrumb alignment)
    - Heading Structure (8%): H1 presence (exactly one), keyword alignment
      between H1/page title, heading hierarchy (H1→H2→H3), keyword-rich H2s
    - Image Optimization (10%): alt text presence on all images, keyword usage
      in alt text without keyword stuffing, image file naming conventions,
      image compression considerations
    - Schema Markup (12%): Product schema completeness (name, description,
      offers, brand, category, review/aggregateRating), organization schema,
      breadcrumb schema, review snippet eligibility
    - Content Quality (15%): word count sufficiency (300+ words for product
      pages), keyword density (1-3%), readability score, paragraph structure,
      bulleted feature lists, uniqueness vs manufacturer copy
    - Core Web Vitals & Technical (5%): page speed indicators (LCP, INP, CLS),
      mobile responsiveness, HTTPS, crawlability (noindex/nofollow)
    - Internal Links & Navigation (5%): breadcrumb presence, related product
      linking, category tree depth, contextual anchor text
    """

    def analyze(self, content: dict) -> AnalysisResult:
        return self._run_llm_analysis(self._system_prompt(), self._user_prompt(content))

    def _system_prompt(self) -> str:
        return (
            "You are an expert e-commerce SEO analyst. Your role is to evaluate "
            "product pages using evidence-backed analysis. Follow these rules:\n\n"

            "1. **Confidence labels**: Every finding must have a `confidence` field:\n"
            '   - "Confirmed" — you can determine this from the data provided\n'
            '   - "Likely" — strong signal but missing data to fully verify\n'
            '   - "Hypothesis" — reasonable assumption that needs external verification\n\n'

            "2. **Severity levels**:\n"
            '   - "critical" — blocks indexing or causes significant traffic loss\n'
            '   - "high" — meaningfully impacts ranking potential\n'
            '   - "medium" — reduces optimization quality\n'
            '   - "low" — minor improvement opportunity\n\n'

            "3. **Suggestions must include impact/effort**:\n"
            '   Every suggestion should have "impact" ("high"/"medium"/"low") and '
            '"effort" ("low"/"medium"/"high") so the user can prioritize.\n\n'

            "4. **E-E-A-T signals** apply to all competitive queries. Consider "
            "whether the content demonstrates Experience, Expertise, "
            "Authoritativeness, and Trustworthiness.\n\n"

            "5. **Be specific and actionable**. Instead of 'improve the title', "
            "suggest exact wording. Reference real word counts and character lengths.\n\n"

            "6. **FAQPage schema** is restricted to government/healthcare sites only. "
            "Do not recommend it for e-commerce products.\n\n"

            "7. **HowTo schema** is deprecated — do not recommend it.\n\n"

            "8. Return ONLY valid JSON matching the schema. No markdown, no additional text."
        )

    def _user_prompt(self, content: dict) -> str:
        name = content.get("name", "")
        description = content.get("description", "")
        category = content.get("category", "")
        slug = content.get("slug", "")
        meta_title = content.get("meta_title", "")
        meta_description = content.get("meta_description", "")
        images = content.get("images", [])
        price = content.get("price", 0)
        status = content.get("status", "")

        # Count images and check for alt text signals
        image_count = len(images) if isinstance(images, (list, tuple)) else 0
        has_images = image_count > 0

        # Compute basic metrics for the LLM to use
        title_length = len(meta_title or name)
        desc_length = len(meta_description or "")
        slug_words = slug.replace("-", " ").replace("_", " ").split()

        return f"""
Analyze this e-commerce product page for SEO effectiveness.

## Product Data
- Product Name: {name}
- Meta Title: {meta_title or '(not set — falls back to product name)'}
- Meta Description: {meta_description or '(not set)'}
- Description: {description[:500] if description else '(empty)'}
- Category: {category}
- Slug: {slug}
- Price: {price} (in cents)
- Status: {status}
- Images: {image_count} image(s) available
- Title Length: {title_length} chars
- Description Length: {desc_length} chars

{self.SCORING_WEIGHTS}

## Analysis Requirements

1. **Score each dimension** from 0-100 based on the data provided.
2. **Compute final weighted score** using the percentages above.
3. **Identify the 3-5 most impactful findings** across all dimensions.
4. **For every finding**, assign a confidence label based on what you can verify.
5. **For every suggestion**, rate impact and effort.

## Return Format

Return valid JSON with this exact structure:
{{
  "score": <int 0-100 weighted final score>,
  "findings": [
    {{
      "issue": "<short description of the issue>",
      "severity": "critical" | "high" | "medium" | "low",
      "detail": "<detailed explanation with specific evidence from the data>",
      "confidence": "Confirmed" | "Likely" | "Hypothesis",
      "dimension": "<dimension name, e.g. title_tag>"
    }}
  ],
  "suggestions": [
    {{
      "area": "<dimension name>",
      "suggestion": "<actionable, specific suggestion>",
      "impact": "high" | "medium" | "low",
      "effort": "low" | "medium" | "high"
    }}
  ]
}}

Return ONLY the JSON object. No markdown fences, no explanation.
"""
