# Analysis orchestrator — runs all agents (ContentQuality, SEO, ProductPage,
# ContentOptimization, BusinessAuditor) on product or business data.
import concurrent.futures
import threading
from typing import Any

from agents.base import AnalysisResult
from agents.content_quality import ContentQualityAgent
from agents.seo import SEOAgent
from agents.product_page import ProductPageAgent
from agents.content_optimization import ContentOptimizationAgent
from agents.business_auditor import BusinessAuditorAgent


class Orchestrator:
    def __init__(self):
        self.agents: dict[str, Any] = {
            "content": ContentQualityAgent(),
            "seo": SEOAgent(),
            "product": ProductPageAgent(),
            "optimization": ContentOptimizationAgent(),
        }
        self.business_auditor = BusinessAuditorAgent()

    def run_all_analyses(self, product_data: dict) -> dict[str, AnalysisResult]:
        results: dict[str, AnalysisResult] = {}
        results_lock = threading.Lock()
        agent_items = list(self.agents.items())

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            def run_one(name_agent: tuple[str, Any]) -> None:
                name, agent = name_agent
                result = agent.analyze(product_data)
                with results_lock:
                    results[name] = result

            list(pool.map(run_one, agent_items))

        return results

    def run_business_audit(self, business_data: dict) -> AnalysisResult:
        return self.business_auditor.analyze(business_data)
