from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest

from app.worker import scheduler_main


def _set_valid_schedule(monkeypatch):
    monkeypatch.setattr(scheduler_main.settings, "weekly_job_day", 6)
    monkeypatch.setattr(scheduler_main.settings, "weekly_job_hour", 9)
    monkeypatch.setattr(scheduler_main.settings, "weekly_job_minute", 0)
    monkeypatch.setattr(scheduler_main.settings, "scheduler_timezone", "UTC")


def test_worker_warns_when_disabled(monkeypatch, caplog):
    _set_valid_schedule(monkeypatch)
    monkeypatch.setattr(scheduler_main.settings, "scheduler_enabled", False)
    monkeypatch.setattr(scheduler_main, "init_opik", lambda: None)
    caplog.set_level("WARNING")
    scheduler_main.main()
    assert "SCHEDULER_ENABLED=false" in caplog.text


def test_worker_logs_schedule_when_enabled(monkeypatch, caplog):
    _set_valid_schedule(monkeypatch)
    monkeypatch.setattr(scheduler_main.settings, "scheduler_enabled", True)
    monkeypatch.setattr(scheduler_main.settings, "jobs_run_on_startup", False)
    monkeypatch.setattr(scheduler_main, "init_opik", lambda: None)

    class DummyScheduler:
        def __init__(self, timezone=None):
            self.running = False

        def add_job(self, *args, **kwargs):
            return None

        def start(self):
            self.running = True

        def shutdown(self, wait=False):
            self.running = False

    monkeypatch.setattr(scheduler_main, "BackgroundScheduler", DummyScheduler)
    monkeypatch.setattr(scheduler_main, "_wait_forever", lambda event: None)
    monkeypatch.setattr(scheduler_main.signal, "signal", lambda *args, **kwargs: None)

    caplog.set_level("INFO")
    scheduler_main.main()
    assert "Scheduler enabled" in caplog.text
    assert "Registered scheduler jobs" in caplog.text


def test_job_execution_emits_metrics(monkeypatch):
    metrics = []
    monkeypatch.setattr(
        scheduler_main,
        "log_metric",
        lambda name, value, metadata=None: metrics.append((name, value, metadata)),
    )

    traces = []

    class DummyTrace:
        def __init__(self, *args, **kwargs):
            traces.append(kwargs)

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(scheduler_main, "trace", lambda *args, **kwargs: DummyTrace(*args, **kwargs))

    class DummySession:
        def close(self):
            return None

    monkeypatch.setattr(scheduler_main, "SessionLocal", lambda: DummySession())

    def fake_runner(session):
        return SimpleNamespace(users_processed=2, snapshots_written=1)

    monkeypatch.setattr(scheduler_main, "run_weekly_plan_for_all_users", fake_runner)
    scheduler_main._run_weekly_plan_job()
    assert traces, "trace should be recorded"
    assert any(name == "jobs.success" for name, _, _ in metrics)


def test_validate_config_errors(monkeypatch):
    monkeypatch.setattr(scheduler_main.settings, "weekly_job_day", 7)
    with pytest.raises(ValueError):
        scheduler_main._validate_config()
    monkeypatch.setattr(scheduler_main.settings, "weekly_job_day", 0)
    monkeypatch.setattr(scheduler_main.settings, "weekly_job_hour", 24)
    with pytest.raises(ValueError):
        scheduler_main._validate_config()
    monkeypatch.setattr(scheduler_main.settings, "weekly_job_hour", 0)
    monkeypatch.setattr(scheduler_main.settings, "weekly_job_minute", 99)
    with pytest.raises(ValueError):
        scheduler_main._validate_config()
