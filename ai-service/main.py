# FastAPI application entry point — defines routes for health check, chat, product analysis,
# report generation, and the job-queue-based analysis system.
#
# Analyses run as background jobs (one agent step at a time) to avoid overloading
# the LLM API and blocking the event loop.

import os
import asyncio
import logging
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# ── Job queue import (lazy — agents import inside handler) ────────────────


# ── App & lifespan ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Provision scoped DB roles, initialize DB pools, and start the background job worker."""
    # Startup
    try:
        from scoped_roles import ensure_scoped_roles
        logger.info("[startup] Provisioning scoped database roles...")
        await ensure_scoped_roles()
    except Exception as e:
        logger.warning("[startup] Scoped roles bootstrap skipped: %s", e)

    try:
        from db import pool
        logger.info("[startup] Initializing database connection pools...")
        await pool.init()
    except Exception as e:
        logger.warning("[startup] Database pool init skipped: %s", e)

    try:
        _start_job_worker()
    except Exception as e:
        logger.warning("[startup] Job worker init skipped: %s", e)

    yield

    # Shutdown
    try:
        _job_queue.stop_worker()
    except Exception as e:
        logger.warning("[shutdown] Job worker stop skipped: %s", e)

    try:
        from db import pool
        logger.info("[shutdown] Closing database connection pools...")
        await pool.close()
    except Exception as e:
        logger.warning("[shutdown] Database pool close skipped: %s", e)


app = FastAPI(title="AI Marketing Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Global agent instances (reused across jobs) ───────────────────────────

from agents.quarterly_report import QuarterlyReportAgent
from orchestrator import Orchestrator
from agents.supervisor import SupervisorAgent
from agents.base import ChatContext
from agents.competitor_analysis import CompetitorAnalysisAgent
from scraper import scrape_competitor

orchestrator = Orchestrator()
_supervisor = SupervisorAgent()


def _get_supervisor() -> SupervisorAgent:
    return _supervisor


# ── Job queue setup ────────────────────────────────────────────────────────

_job_queue = None        # set during lifespan startup
_agent_map: dict = {}    # lazy-populated


def _get_agent_map() -> dict:
    """Lazy singleton so agent classes are imported only when the worker starts."""
    global _agent_map
    if not _agent_map:
        from agents.content_quality import ContentQualityAgent
        from agents.seo import SEOAgent
        from agents.product_page import ProductPageAgent
        from agents.content_optimization import ContentOptimizationAgent
        _agent_map = {
            "content": ContentQualityAgent(),
            "seo": SEOAgent(),
            "product": ProductPageAgent(),
            "optimization": ContentOptimizationAgent(),
        }
    return _agent_map


def _handle_step(job, step) -> tuple[dict | None, str | None]:
    """Callback invoked by the background worker for each job step.

    Returns (result_dict, error_string). One of the two is always None.
    """
    from job_queue import Job

    try:
        if job.type == "product_analysis":
            return _handle_product_step(job, step)
        elif job.type == "competitor_analysis":
            return _handle_competitor_step(job, step)
        else:
            return None, f"Unknown job type: {job.type}"
    except Exception as e:
        logger.exception("[worker] Step %s/%s failed", job.type, step.name)
        return None, str(e)


def _handle_product_step(job, step) -> tuple[dict | None, str | None]:
    """Run one agent step for product analysis."""
    agents = _get_agent_map()
    agent = agents.get(step.name)
    if agent is None:
        return None, f"Unknown product agent: {step.name}"

    product_data = job.payload or {}
    result = agent.analyze(product_data)
    return {"score": result.score, "findings": result.findings, "suggestions": result.suggestions}, None


def _handle_competitor_step(job, step) -> tuple[dict | None, str | None]:
    """Run one step of competitor analysis (scrape or analyze)."""
    payload = job.payload or {}
    competitor = payload.get("competitor", {})
    domain = competitor.get("domain", "")

    if step.name == "scrape":
        scraped = scrape_competitor(domain) if domain else {}
        return scraped, None

    elif step.name == "analyze":
        # Collect scraped data from the previous step
        scraped_data = {}
        for s in job.steps:
            if s.name == "scrape" and s.result is not None:
                scraped_data = s.result
                break

        # Fetch own products from DB (called synchronously in the worker thread)
        own_products = _fetch_own_products_sync()

        agent = CompetitorAnalysisAgent()
        result = agent.analyze({
            "competitor": competitor,
            "scraped_data": scraped_data,
            "own_products": own_products,
        })

        return {
            "score": result.score,
            "findings": result.findings,
            "suggestions": result.suggestions,
            "summary": getattr(result, "summary", ""),
            "markdown_report": getattr(result, "markdown_report", ""),
        }, None

    else:
        return None, f"Unknown competitor step: {step.name}"


# Own-products fetch, called synchronously from the worker thread.

def _fetch_own_products_sync() -> list[dict]:
    """Fetch own products synchronously (for use in the background worker)."""
    import sys
    # Try async-to-sync via run_until_complete
    try:
        loop = asyncio.new_event_loop()
        return loop.run_until_complete(_fetch_own_products())
    except Exception as e:
        logger.warning("[competitor] Failed to fetch own products: %s", e)
        return []
    finally:
        loop.close()


async def _fetch_own_products() -> list[dict]:
    """Fetch the user's own store products from the database for comparison.

    Uses a self-contained connection created on whatever event loop this runs
    on, rather than the app-loop-bound global pool, so it is safe to call from
    worker threads via _fetch_own_products_sync.
    """
    try:
        import asyncpg
        from db import pool
        from agents.types import AgentType
        dsn = pool._get_dsn(AgentType.ADMIN)
        if not dsn:
            logger.warning("[competitor] No scoped DB connection available — skipping own products fetch")
            return []
        conn = await asyncpg.connect(dsn=dsn, timeout=5)
        try:
            rows = await conn.fetch(
                "SELECT id, name, price, category, description, slug, "
                "meta_title, meta_description, images, status "
                "FROM products WHERE status = 'active' ORDER BY created_at DESC"
            )
            return [dict(row) for row in rows]
        finally:
            await conn.close()
    except Exception as e:
        logger.warning("[competitor] Failed to fetch own products: %s", e)
        return []


def _start_job_worker():
    """Initialize the JobQueue singleton and start the background worker."""
    global _job_queue
    from job_queue import JobQueue
    _job_queue = JobQueue()
    _job_queue.start_worker(_handle_step)
    logger.info("[startup] Job queue worker started")


# ── Chat endpoints ─────────────────────────────────────────────────────────

@app.websocket("/chat/{conversation_id}")
async def chat_websocket(websocket: WebSocket, conversation_id: str):
    await websocket.accept()
    supervisor = _get_supervisor()
    ctx = ChatContext(conversation_id=conversation_id)

    while True:
        try:
            data = await websocket.receive_json()
            message = data.get("message", "")
            if data.get("catalog"):
                ctx.product_catalog = data["catalog"]
            if data.get("role"):
                ctx.role = data.get("role", "customer")

            response = await supervisor.respond(message, ctx)
            await websocket.send_json({"type": "response", "message": response.message})
        except WebSocketDisconnect:
            break


@app.post("/chat/{conversation_id}")
async def chat_http(conversation_id: str, data: dict):
    supervisor = _get_supervisor()
    ctx = ChatContext(
        conversation_id=conversation_id,
        product_catalog=data.get("catalog", []),
        role=data.get("role", "customer"),
    )
    response = await supervisor.respond(data.get("message", ""), ctx)
    return {"message": response.message}


# ── Job-based analysis endpoints ───────────────────────────────────────────

@app.post("/analyze/product")
async def analyze_product(data: dict):
    """Enqueue a product analysis job and return its ID immediately.

    The background worker runs agents one-by-one: content → seo → product → optimization.
    """
    global _job_queue
    if _job_queue is None:
        raise HTTPException(status_code=503, detail="Job queue not initialized")

    job_id = _job_queue.create_job(
        type="product_analysis",
        steps=["content", "seo", "product", "optimization"],
        payload=data,
    )
    return {"job_id": job_id}


@app.post("/analyze/competitor")
async def analyze_competitor(data: dict):
    """Enqueue a competitor analysis job and return its ID immediately.

    The background worker runs: scrape → analyze.
    """
    global _job_queue
    if _job_queue is None:
        raise HTTPException(status_code=503, detail="Job queue not initialized")

    job_id = _job_queue.create_job(
        type="competitor_analysis",
        steps=["scrape", "analyze"],
        payload=data,
    )
    return {"job_id": job_id}


@app.get("/analyze/status/{job_id}")
async def get_job_status(job_id: str):
    """Return the current status and results of an analysis job."""
    global _job_queue
    if _job_queue is None:
        raise HTTPException(status_code=503, detail="Job queue not initialized")

    job = _job_queue.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return _job_queue.to_dict(job)


# ── Report endpoint (unchanged) ────────────────────────────────────────────

@app.post("/analyze/report")
async def generate_report(data: dict):
    agent = QuarterlyReportAgent()
    result = agent.analyze(data)
    return result.model_dump()


# ── Business audit (unchanged) ─────────────────────────────────────────────

@app.post("/analyze/audit")
async def run_business_audit(data: dict):
    try:
        result = orchestrator.run_business_audit(data)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Competitor report schema (unchanged) ──────────────────────────────────

@app.get("/analyze/competitor/report")
async def get_competitor_report_preview():
    """Return the structure of a competitor analysis report for reference."""
    return {
        "report_sections": [
            "core_product",
            "value_props",
            "features",
            "pricing",
            "target_audience",
            "market_presence",
            "swot_grid",
            "why_choose_us",
            "objections",
        ],
        "format": "markdown",
    }


# ── Direct entry point ─────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
