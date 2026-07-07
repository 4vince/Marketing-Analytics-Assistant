# Content optimization agent — rewrites product title/description to be keyword-rich, readable, and aligned with search intent.
import json
import os

from .base import BaseAgent, AnalysisResult
from llm_client import LLMClient


class ContentOptimizationAgent(BaseAgent):
    def __init__(self):
        self.use_complex_model = True
        try:
            self.llm = LLMClient()
        except Exception:
            self.llm = None

    def analyze(self, content: dict) -> AnalysisResult:
        if self.llm is None:
            return AnalysisResult(
                score=0,
                findings=[
                    {
                        "issue": "Analysis unavailable",
                        "severity": "high",
                        "detail": "LLM analysis failed to return valid results. Check API keys and network connectivity.",
                    }
                ],
                suggestions=[],
            )

        model = os.getenv("LLM_MODEL_COMPLEX") or os.getenv("LLM_MODEL")
        prompt = f"""
Rewrite this product title and description to be keyword-rich, readable, and aligned with search intent.

Product Title: {content.get('name', '')}
Product Description: {content.get('description', '')}
Category: {content.get('category', '')}
Meta Description: {content.get('meta_description', '')}

Evaluate the current copy and then provide:
1. A revised product title optimized for keywords and relevance.
2. A revised product description that is clear, persuasive, and search-intent aligned.
3. Suggestions for improving keyword usage, readability, and search relevance.

Score from 0-100 on:
1. Keyword richness
2. Readability and clarity
3. Search intent alignment
4. Conversion-focused writing

Return JSON: {{"score": int, "findings": [{{"issue": str, "severity": str, "detail": str}}], "suggestions": [{{"area": str, "suggestion": str}}]}}
"""
        try:
            result = self.llm.chat("You are an expert e-commerce content optimization specialist.", prompt, model=model)
            data = json.loads(result)
            return AnalysisResult(**data)
        except json.JSONDecodeError:
            return AnalysisResult(
                score=0,
                findings=[
                    {
                        "issue": "Analysis unavailable",
                        "severity": "high",
                        "detail": "LLM analysis failed to return valid results. Check API keys and network connectivity.",
                    }
                ],
                suggestions=[],
            )
