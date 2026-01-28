"""Dedicated APScheduler worker process."""
from __future__ import annotations

import logging
import signal
import sys
import threading
from time import perf_counter
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

try:  # pragma: no cover - fallback for environments without apscheduler
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:  # pragma: no cover
    class BackgroundScheduler:  # type: ignore[override]
        def __init__(self, timezone=None):
            self.running = False
            logger.warning("apscheduler not installed; using stub scheduler that will not run jobs.")

        def add_job(self, *args, **kwargs):
            return None

        def start(self):
            return None

        def shutdown(self, wait=False):
            return None

from app.core.config import settings
from app.core.logging import configure_logging
from app.observability.client import init_opik
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.db.session import SessionLocal
from app.services.job_runner import (
    run_interventions_for_all_users,
    run_weekly_plan_for_all_users,
)
from app.services.task_reminder import run_task_reminder_check


def main() -> None:
    configure_logging(log_level=settings.log_level)
    init_opik()
    try:
        _validate_config()
    except ValueError as exc:
        logger.error("Invalid scheduler configuration: %s", exc)
        sys.exit(1)

    logger.info("Scheduler worker starting (enabled=%s)", settings.scheduler_enabled)

    if not settings.scheduler_enabled:
        logger.warning("Scheduler worker started but SCHEDULER_ENABLED=false. No jobs will run.")
        return

    scheduler = BackgroundScheduler(timezone=settings.scheduler_timezone)
    _register_jobs(scheduler)
    logger.info(
        "Scheduler enabled (tz=%s, weekly_plan=%s %02d:%02d, interventions=%s %02d:%02d)",
        settings.scheduler_timezone,
        settings.weekly_job_day,
        settings.weekly_job_hour,
        settings.weekly_job_minute,
        settings.intervention_job_day,
        settings.intervention_job_hour,
        settings.intervention_job_minute,
    )
    logger.info(
        "Notifications config: enabled=%s provider=%s reminder_interval=%s lookahead=%s",
        settings.notifications_enabled,
        settings.notifications_provider,
        settings.task_reminder_interval_minutes,
        settings.task_reminder_lookahead_minutes,
    )
    scheduler.start()
    if settings.jobs_run_on_startup:
        logger.info("Running jobs once on startup")
        _run_weekly_plan_job()
        _run_intervention_job()
        _run_task_reminder_job()

    stop_event = threading.Event()

    def shutdown(signum, frame):  # pragma: no cover - signal handler
        logger.info("Scheduler worker shutting down (signal=%s)", signum)
        if scheduler.running:
            scheduler.shutdown(wait=False)
        stop_event.set()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        _wait_forever(stop_event)
    except KeyboardInterrupt:  # pragma: no cover - manual stop
        shutdown(signal.SIGINT, None)


def _register_jobs(scheduler: BackgroundScheduler) -> None:
    weekly_day = str(settings.weekly_job_day)
    intervention_day = str(settings.intervention_job_day)
    scheduler.add_job(
        _run_weekly_plan_job,
        trigger="cron",
        day_of_week=weekly_day,
        hour=settings.weekly_job_hour,
        minute=settings.weekly_job_minute,
        id="weekly_plan_job",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_intervention_job,
        trigger="cron",
        day_of_week=intervention_day,
        hour=settings.intervention_job_hour,
        minute=settings.intervention_job_minute,
        id="interventions_job",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_task_reminder_job,
        trigger="interval",
        minutes=max(1, settings.task_reminder_interval_minutes),
        id="task_reminders_job",
        replace_existing=True,
    )
    logger.info(
        "Registered jobs (tz=%s): weekly_plan=%s %02d:%02d, interventions=%s %02d:%02d, task_reminders every %s min",
        settings.scheduler_timezone,
        weekly_day,
        settings.weekly_job_hour,
        settings.weekly_job_minute,
        intervention_day,
        settings.intervention_job_hour,
        settings.intervention_job_minute,
        settings.task_reminder_interval_minutes,
    )


def _run_weekly_plan_job() -> None:
    _execute_job(
        job_name="weekly_plan",
        runner=run_weekly_plan_for_all_users,
        scheduled_run_time=datetime.now(timezone.utc),
    )


def _run_intervention_job() -> None:
    _execute_job(
        job_name="interventions",
        runner=run_interventions_for_all_users,
        scheduled_run_time=datetime.now(timezone.utc),
    )


def _run_task_reminder_job() -> None:
    _execute_job(
        job_name="task_reminders",
        runner=run_task_reminder_check,
        scheduled_run_time=datetime.now(timezone.utc),
    )


def _execute_job(job_name: str, runner, scheduled_run_time=None) -> None:
    session = SessionLocal()
    start = perf_counter()
    scheduled_str = scheduled_run_time.isoformat() if scheduled_run_time else None
    metadata = {"job": job_name, "scheduled_run_time": scheduled_str}
    logger.info("Job %s starting (scheduled_run_time=%s)", job_name, scheduled_str or "now")

    users_processed = 0
    snapshots_written = 0
    skipped = 0
    success = 0
    try:
        with trace(f"jobs.{job_name}", metadata=metadata):
            result = runner(session)
            users_processed = result.users_processed
            snapshots_written = result.snapshots_written
            skipped = getattr(result, "skipped_due_to_preferences", 0)
            success = 1
    except Exception:  # pragma: no cover - defensive guard
        logger.exception("Job %s failed", job_name)
    finally:
        session.close()

    duration_ms = (perf_counter() - start) * 1000
    log_metric("jobs.success", success, metadata={"job": job_name})
    log_metric("jobs.users_processed", users_processed, metadata={"job": job_name})
    log_metric("jobs.snapshots_written", snapshots_written, metadata={"job": job_name})
    log_metric("jobs.skipped_due_to_preferences", skipped, metadata={"job": job_name})
    log_metric("jobs.duration_ms", duration_ms, metadata={"job": job_name})

    if success:
        logger.info(
            "Job %s complete: users=%s, snapshots=%s, skipped=%s, duration_ms=%0.2f",
            job_name,
            users_processed,
            snapshots_written,
            skipped,
            duration_ms,
        )


def _validate_config() -> None:
    if not (0 <= settings.weekly_job_day <= 6):
        raise ValueError("WEEKLY_JOB_DAY must be between 0 and 6")
    if not (0 <= settings.weekly_job_hour <= 23):
        raise ValueError("WEEKLY_JOB_HOUR must be between 0 and 23")
    if not (0 <= settings.weekly_job_minute <= 59):
        raise ValueError("WEEKLY_JOB_MINUTE must be between 0 and 59")
    if not (0 <= settings.intervention_job_day <= 6):
        raise ValueError("INTERVENTION_JOB_DAY must be between 0 and 6")
    if not (0 <= settings.intervention_job_hour <= 23):
        raise ValueError("INTERVENTION_JOB_HOUR must be between 0 and 23")
    if not (0 <= settings.intervention_job_minute <= 59):
        raise ValueError("INTERVENTION_JOB_MINUTE must be between 0 and 59")
    if settings.task_reminder_interval_minutes < 1:
        raise ValueError("TASK_REMINDER_INTERVAL_MINUTES must be >= 1")


def _wait_forever(stop_event: threading.Event) -> None:
    stop_event.wait()


if __name__ == "__main__":  # pragma: no cover - manual launch
    main()
