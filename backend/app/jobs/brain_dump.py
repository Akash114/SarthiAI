from __future__ import annotations

import logging
from uuid import UUID

from app.db import get_session_factory
from app.models.brain_dump import BrainDump
from app.services.brain_dump_processor import persist_processed_brain_dump, process_brain_dump
from app.services.companion_context import build_companion_context

logger = logging.getLogger(__name__)


def run_process_brain_dump(dump_id: str) -> None:
    db = get_session_factory()()
    try:
        dump = db.get(BrainDump, UUID(dump_id))
        if dump is None:
            return
        context = build_companion_context(
            db,
            user_id=dump.user_id,
            focus_session_id=dump.focus_session_id,
            task_id=dump.active_task_id,
            goal_id=dump.active_goal_id,
            team_id=dump.team_id,
        )
        result = process_brain_dump(db, dump)
        persist_processed_brain_dump(db, dump, result, context)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("brain_dump_job_failed", extra={"dump_id": dump_id})
        try:
            dump = db.get(BrainDump, UUID(dump_id))
            if dump is not None:
                dump.processing_status = "failed"
                db.commit()
        except Exception:
            db.rollback()
        raise
    finally:
        db.close()
