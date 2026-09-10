# Product page conversion analysis agent — scores on description, pricing, CTA, social proof, and images.
import json

from .base import BaseAgent, AnalysisResult
from llm_client import LLMClient


class ProductPageAgent(BaseAgent):
    def __init__(self):
        try:
            self.llm = LLMClient()
        except Exception:
            self.llm = None

    def analyze(self, content: dict) -> AnalysisResult:
        if self.llm is None:
            return self._fallback_result("LLM analysis failed to return valid results. Check API keys and network connectivity.")
        prompt = f"""
Analyze this product page for conversion optimization:

Name: {content.get('name', '')}
Description: {content.get('description', '')}
Price: {content.get('price', '')}
Images count: {len(content.get('images', []))}
Category: {content.get('category', '')}

Score from 0-100 on:
1. Description completeness and clarity
2. Pricing presentation
3. Call-to-action effectiveness
4. Social proof potential (reviews, ratings)
5. Image quality signals

Return JSON: {{"score": int, "findings": [{{"issue": str, "severity": str, "detail": str}}], "suggestions": [{{"area": str, "suggestion": str}}]}}
"""
        try:
            result = self.llm.chat("You are an expert e-commerce conversion analyst.", prompt)
            return self._build_result(json.loads(result))
        except (json.JSONDecodeError, ValueError, TypeError):
            return self._fallback_result("LLM analysis failed to return valid results. Check API keys and network connectivity.")
