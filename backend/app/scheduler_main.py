"""APScheduler process for companion reminders and interventions."""

from __future__ import annotations

import logging
import signal
import sys
import threading
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.config import get_settings, validate_settings_for_environment
from app.db import get_session_factory
from app.models.intervention import Intervention
from app.models.task import Task
from app.observability.logging_json import configure_logging
from app.observability.sentry_setup import init_sentry_worker
from app.services.notifications.intervention import send_intervention_prompt_push
from app.services.notifications.reminders import run_task_reminder_scan
from app.services.user_prefs import allow_intervention_push

logger = logging.getLogger(__name__)

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:  # pragma: no cover
    BackgroundScheduler = None  # type: ignore[misc, assignment]


def _reminder_tick() -> None:
    settings = get_settings()
    db = get_session_factory()()
    try:
        stats = run_task_reminder_scan(db, settings)
        db.commit()
        if stats.records_created:
            logger.info(
                "scheduler_reminders users=%s records=%s pushes=%s",
                stats.users_notified,
                stats.records_created,
                stats.pushes_sent,
            )
    except Exception:
        db.rollback()
        logger.exception("scheduler_reminder_tick_failed")
    finally:
        db.close()


def _intervention_tick() -> None:
    settings = get_settings()
    db = get_session_factory()()
    try:
        now = datetime.now(UTC)
        cutoff = now - timedelta(hours=24)
        tasks = db.scalars(
            select(Task).where(
                Task.status == "open",
                Task.priority == "high",
                Task.due_at.isnot(None),
                Task.due_at < cutoff,
            )
        ).all()
        created = 0
        for task in tasks:
            user_id = task.assignee_user_id or task.user_id or task.created_by_user_id
            existing = db.scalar(
                select(Intervention).where(
                    Intervention.user_id == user_id,
                    Intervention.task_id == task.id,
                    Intervention.status == "pending",
                )
            )
            if existing is not None or not allow_intervention_push(db, user_id):
                continue
            intervention = Intervention(
                user_id=user_id,
                team_id=task.team_id,
                goal_id=task.goal_id,
                task_id=task.id,
                severity="high",
                reason="high_priority_overdue",
                status="pending",
                summary=f"This high-priority task has been overdue for a day: {task.title}",
                suggested_action="Decide now: finish it, reschedule it, or intentionally cancel it.",
                detail_json={"task_id": str(task.id), "due_at": task.due_at.isoformat() if task.due_at else None},
            )
            db.add(intervention)
            db.flush()
            send_intervention_prompt_push(db, settings, user_id, intervention)
            created += 1
        db.commit()
        if created:
            logger.info("scheduler_interventions created=%s", created)
    except Exception:
        db.rollback()
        logger.exception("scheduler_intervention_tick_failed")
    finally:
        db.close()


def _validate(settings) -> None:
    if settings.task_reminder_interval_minutes < 1:
        raise ValueError("TASK_REMINDER_INTERVAL_MINUTES must be >= 1")


def main() -> None:
    settings = get_settings()
    validate_settings_for_environment(settings)
    configure_logging(settings.log_level)
    worker_dsn = settings.sentry_worker_dsn or settings.sentry_dsn
    if worker_dsn:
        init_sentry_worker(
            dsn=worker_dsn,
            environment=settings.environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
        )
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
        _intervention_tick,
        "interval",
        minutes=60,
        id="interventions",
        replace_existing=True,
    )
    logger.info("scheduler started tz=%s", settings.scheduler_timezone)
    sched.start()
    if settings.jobs_run_on_startup:
        _reminder_tick()
        _intervention_tick()

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
