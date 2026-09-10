# Content quality analysis agent — scores on readability, grammar, structure, and persuasiveness.
import json

from .base import BaseAgent, AnalysisResult
from llm_client import LLMClient


class ContentQualityAgent(BaseAgent):
    def __init__(self):
        try:
            self.llm = LLMClient()
        except Exception:
            self.llm = None

    def analyze(self, content: dict) -> AnalysisResult:
        if self.llm is None:
            return self._fallback_result("LLM analysis failed to return valid results. Check API keys and network connectivity.")
        prompt = f"""
Analyze this e-commerce product content for quality:

Name: {content.get('name', '')}
Description: {content.get('description', '')}

Score from 0-100 on:
1. Readability and clarity
2. Grammar and spelling
3. Structure and formatting
4. Persuasiveness and engagement

Return JSON: {{"score": int, "findings": [{{"issue": str, "severity": "high"/"medium"/"low", "detail": str}}], "suggestions": [{{"area": str, "suggestion": str}}]}}
"""
        try:
            result = self.llm.chat("You are an expert e-commerce content analyst.", prompt)
            return self._build_result(json.loads(result))
        except (json.JSONDecodeError, ValueError, TypeError):
            return self._fallback_result("LLM analysis failed to return valid results. Check API keys and network connectivity.")
