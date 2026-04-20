"""APScheduler process for reminders and week-1 recovery (optional).

Run from backend directory::

    python -m app.scheduler_main

Requires ``SCHEDULER_ENABLED=true`` and valid ``DATABASE_URL`` / ``REDIS_URL``
when recovery enqueues RQ jobs.

**Multi-instance:** Do not run more than one scheduler process against the same
database/reminder configuration, or reminder scans and week-1 recovery enqueues
may duplicate work. Prefer a single scheduler deployment or add an external
leader lock (Redis) before scaling horizontally.
"""

from __future__ import annotations

import logging
import signal
import sys
import threading
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.config import get_settings, validate_settings_for_environment
from app.db import get_session_factory
from app.jobs.week1 import run_generate_week1
from app.models.resolution import Resolution
from app.observability.logging_json import configure_logging
from app.queue import task_queue
from app.services.notifications.reminders import run_task_reminder_scan

logger = logging.getLogger(__name__)

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:  # pragma: no cover
    BackgroundScheduler = None  # type: ignore[misc, assignment]


def _reminder_tick() -> None:
    s = get_settings()
    factory = get_session_factory()
    db = factory()
    try:
        stats = run_task_reminder_scan(db, s)
        db.commit()
        if stats.pushes_sent:
            logger.info(
                "scheduler_reminders users=%s pushes=%s",
                stats.users_notified,
                stats.pushes_sent,
            )
    except Exception:
        logger.exception("scheduler_reminder_tick_failed")
        db.rollback()
    finally:
        db.close()


def _week1_recover_tick() -> None:
    s = get_settings()
    factory = get_session_factory()
    db = factory()
    try:
        cutoff = datetime.now(UTC) - timedelta(minutes=30)
        rows = db.scalars(
            select(Resolution).where(
                Resolution.week_1_plan_status == "pending",
                Resolution.updated_at < cutoff,
            )
        ).all()
        for r in rows:
            task_queue().enqueue(
                run_generate_week1,
                str(r.id),
                job_timeout=120,
                meta={"request_id": "scheduler-week1-recover", "traceparent": None},
            )
            logger.info("enqueued week1 recover resolution_id=%s", r.id)
    except Exception:
        logger.exception("scheduler_week1_recover_failed")
    finally:
        db.close()


def _validate(settings) -> None:
    if not (0 <= settings.weekly_job_day <= 6):
        raise ValueError("WEEKLY_JOB_DAY must be 0-6")
    if not (0 <= settings.weekly_job_hour <= 23):
        raise ValueError("WEEKLY_JOB_HOUR must be 0-23")
    if not (0 <= settings.weekly_job_minute <= 59):
        raise ValueError("WEEKLY_JOB_MINUTE must be 0-59")
    if settings.task_reminder_interval_minutes < 1:
        raise ValueError("TASK_REMINDER_INTERVAL_MINUTES must be >= 1")


def main() -> None:
    settings = get_settings()
    validate_settings_for_environment(settings)
    configure_logging(settings.log_level)
    if BackgroundScheduler is None:
        logger.error("apscheduler not installed")
        sys.exit(1)
    try:
        _validate(settings)
    except ValueError as exc:
        logger.error("invalid scheduler config: %s", exc)
        sys.exit(1)

    if not settings.scheduler_enabled:
        logger.warning("SCHEDULER_ENABLED is false; exiting.")
        return

    sched = BackgroundScheduler(timezone=settings.scheduler_timezone)
    sched.add_job(
        _reminder_tick,
        "interval",
        minutes=max(1, settings.task_reminder_interval_minutes),
        id="task_reminders",
        replace_existing=True,
    )
    sched.add_job(
        _week1_recover_tick,
        "cron",
        day_of_week=str(settings.weekly_job_day),
        hour=settings.weekly_job_hour,
        minute=settings.weekly_job_minute,
        id="week1_recover",
        replace_existing=True,
    )
    logger.info(
        "scheduler started tz=%s reminders_every=%smin week1_recover=%s %02d:%02d",
        settings.scheduler_timezone,
        settings.task_reminder_interval_minutes,
        settings.weekly_job_day,
        settings.weekly_job_hour,
        settings.weekly_job_minute,
    )
    sched.start()
    if settings.jobs_run_on_startup:
        _reminder_tick()
        _week1_recover_tick()

    stop = threading.Event()

    def shutdown(signum, _frame) -> None:  # pragma: no cover
        logger.info("scheduler shutdown signal=%s", signum)
        sched.shutdown(wait=False)
        stop.set()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    stop.wait()


if __name__ == "__main__":  # pragma: no cover
    main()
