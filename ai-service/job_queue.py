# Thread-safe in-memory job queue with a sequential background worker.
# Each job tracks individual step progress (one agent per step).
# Steps run one-by-one; failed steps don't block remaining steps ("fail independent").
#
# Worker processes jobs in FIFO order from a single daemon thread.

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

JOB_STATUS_PENDING = "pending"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_PARTIAL = "partial"

STEP_STATUS_PENDING = "pending"
STEP_STATUS_RUNNING = "running"
STEP_STATUS_COMPLETED = "completed"
STEP_STATUS_FAILED = "failed"


# ── Data types ─────────────────────────────────────────────────────────────

@dataclass
class JobStep:
    name: str
    status: str = STEP_STATUS_PENDING
    result: dict | None = None
    error: str | None = None


@dataclass
class Job:
    id: str
    type: str
    status: str = JOB_STATUS_PENDING
    steps: list[JobStep] = field(default_factory=list)
    result: dict | None = None
    error: str | None = None
    payload: dict | None = None    # original request data passed to step handler
    created_at: float = field(default_factory=time.time)


# ── Callback type: how the worker processes one step ──────────────────────
# Receives (job, step) and should return (result_dict | None, error_str | None).

StepHandler = Callable[[Job, JobStep], tuple[dict | None, str | None]]


# ── Job Queue ──────────────────────────────────────────────────────────────

class JobQueue:
    """In-memory job queue with a sequential background worker thread.

    Usage:
        q = JobQueue()
        q.start_worker(handler_fn)
        job_id = q.create_job("competitor_analysis", steps=["scrape", "analyze"])
        # … later …
        job = q.get_job(job_id)
    """

    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._worker_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    # ── Public API ─────────────────────────────────────────────────────────

    def create_job(self, type: str, steps: list[str], payload: dict | None = None) -> str:
        """Create a new job with the given step names and enqueue it.

        Args:
            type: Job type identifier (e.g. "product_analysis", "competitor_analysis").
            steps: Ordered list of step names (e.g. ["content", "seo", …]).
            payload: Request data that the step handler may need.

        Returns:
            The new job's unique ID.
        """
        job_id = uuid.uuid4().hex[:12]
        job = Job(
            id=job_id,
            type=type,
            steps=[JobStep(name=s) for s in steps],
            payload=payload,
        )
        with self._lock:
            self._jobs[job_id] = job
        logger.info("[JobQueue] Created job %s (type=%s, steps=%s)", job_id, type, steps)
        return job_id

    def get_job(self, job_id: str) -> Job | None:
        """Thread-safe read of a job by ID."""
        with self._lock:
            return self._jobs.get(job_id)

    def to_dict(self, job: Job) -> dict:
        """Serialize a Job to a plain dict for JSON responses."""
        with self._lock:
            return {
                "id": job.id,
                "type": job.type,
                "status": job.status,
                "steps": [
                    {
                        "name": s.name,
                        "status": s.status,
                        "result": s.result,
                        "error": s.error,
                    }
                    for s in job.steps
                ],
                "result": job.result,
                "error": job.error,
                "created_at": job.created_at,
            }

    # ── Worker lifecycle ───────────────────────────────────────────────────

    def start_worker(self, step_handler: StepHandler, poll_interval: float = 1.0):
        """Start the background worker daemon thread.

        Args:
            step_handler: Called for each pending step: (job, step) → (result, error).
            poll_interval: Seconds to sleep when no pending jobs exist.
        """
        if self._worker_thread and self._worker_thread.is_alive():
            logger.warning("[JobQueue] Worker already running")
            return

        self._stop_event.clear()
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            args=(step_handler, poll_interval),
            daemon=True,
            name="job-queue-worker",
        )
        self._worker_thread.start()
        logger.info("[JobQueue] Worker thread started")

    def stop_worker(self, timeout: float = 5.0):
        """Signal the worker to stop and wait for it to finish."""
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=timeout)
            logger.info("[JobQueue] Worker thread stopped")

    # ── Internal ───────────────────────────────────────────────────────────

    def _update_step(
        self,
        job_id: str,
        step_name: str,
        status: str,
        result: dict | None = None,
        error: str | None = None,
    ):
        """Atomically update one step's status."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            for step in job.steps:
                if step.name == step_name:
                    step.status = status
                    if result is not None:
                        step.result = result
                    if error is not None:
                        step.error = error
                    break

    def _set_job_status(self, job_id: str, status: str, error: str | None = None):
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = status
                if error:
                    job.error = error

    def _set_job_result(self, job_id: str, result: dict):
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.result = result

    def _assemble_result(self, job_id: str):
        """Build job.result from completed step results."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            merged = {}
            for step in job.steps:
                if step.status == STEP_STATUS_COMPLETED and step.result is not None:
                    merged[step.name] = step.result
            job.result = merged if merged else None

    def _next_pending_job(self) -> Job | None:
        """Find the oldest pending job (FIFO). Thread-safe."""
        with self._lock:
            oldest: Job | None = None
            for job in self._jobs.values():
                if job.status == JOB_STATUS_PENDING:
                    if oldest is None or job.created_at < oldest.created_at:
                        oldest = job
            if oldest:
                oldest.status = JOB_STATUS_RUNNING
            return oldest

    def _worker_loop(self, handler: StepHandler, poll_interval: float):
        """Main worker loop — picks jobs and processes steps one-by-one."""
        while not self._stop_event.is_set():
            job = self._next_pending_job()
            if job is None:
                self._stop_event.wait(poll_interval)
                continue

            logger.info("[JobQueue] Processing job %s (type=%s)", job.id, job.type)
            completed_count = 0
            failed_count = 0

            for step in job.steps:
                if self._stop_event.is_set():
                    logger.info("[JobQueue] Stop requested — abandoning job %s", job.id)
                    self._set_job_status(job.id, JOB_STATUS_PARTIAL, "Worker stopped")
                    return

                # Mark step as running
                self._update_step(job.id, step.name, STEP_STATUS_RUNNING)
                logger.info("[JobQueue] Job %s step=%s …", job.id, step.name)

                try:
                    result, error = handler(job, step)
                    if error:
                        self._update_step(job.id, step.name, STEP_STATUS_FAILED, error=error)
                        logger.warning("[JobQueue] Job %s step=%s FAILED: %s", job.id, step.name, error)
                        failed_count += 1
                    else:
                        self._update_step(job.id, step.name, STEP_STATUS_COMPLETED, result=result)
                        logger.info("[JobQueue] Job %s step=%s OK", job.id, step.name)
                        completed_count += 1
                except Exception as e:
                    self._update_step(job.id, step.name, STEP_STATUS_FAILED, error=str(e))
                    logger.exception("[JobQueue] Job %s step=%s EXCEPTION", job.id, step.name)
                    failed_count += 1

            # Determine final job status
            total = len(job.steps)
            if completed_count == total:
                self._set_job_status(job.id, JOB_STATUS_COMPLETED)
                self._assemble_result(job.id)
                logger.info("[JobQueue] Job %s COMPLETED (%d/%d steps)", job.id, completed_count, total)
            elif completed_count > 0:
                self._set_job_status(job.id, JOB_STATUS_PARTIAL)
                self._assemble_result(job.id)
                logger.warning("[JobQueue] Job %s PARTIAL (%d/%d steps completed)", job.id, completed_count, total)
            else:
                self._set_job_status(job.id, JOB_STATUS_FAILED, "All steps failed")
                logger.error("[JobQueue] Job %s FAILED", job.id)
