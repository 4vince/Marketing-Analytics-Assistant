# Quarterly report generation agent — analyzes results from the last 90 days and produces a summary report.
import json
import os

from .base import BaseAgent, AnalysisResult
from llm_client import LLMClient


class QuarterlyReportAgent(BaseAgent):
    def __init__(self):
        self.use_complex_model = True
        try:
            self.llm = LLMClient()
        except Exception:
            self.llm = None

    def analyze(self, content: dict) -> AnalysisResult:
        try:
            if self.llm is None:
                return self._fallback_result("LLM analysis failed to return valid results. Check API keys and network connectivity.")
            model = os.getenv("LLM_MODEL_COMPLEX") or os.getenv("LLM_MODEL")
            analyses = content.get("analyses", [])
            summary = f"""
Analyze these {len(analyses)} product analyses from the last quarter:

{chr(10).join(f"- {a.get('agentType', 'unknown')}: {a.get('score', 0)}/100" for a in analyses[:20])}

Produce a report with:
1. Overall score and trends
2. Most common issues found
3. Top 3 priorities for the next quarter
4. Action plan with effort estimates

Return JSON: {{"score": int, "findings": [{{"issue": str, "severity": str, "detail": str, "count": int}}], "suggestions": [{{"area": str, "suggestion": str, "effort": "low"/"medium"/"high"}}]}}
"""
            result = self.llm.chat("You are an expert e-commerce strategy analyst.", summary, model=model)
            return self._build_result(json.loads(result))
        except (json.JSONDecodeError, ValueError, TypeError):
            return self._fallback_result("LLM analysis failed to return valid results. Check API keys and network connectivity.")
