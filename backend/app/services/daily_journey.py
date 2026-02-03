"""Services for daily journey summaries."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Dict, List, DefaultDict
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.resolution import Resolution
from app.db.models.task import Task
from app.services.resolution_category import infer_category, get_category_display_name


class JourneyCategorySummary:
    __slots__ = ("category", "display_name", "resolution_id", "resolution_title", "total_tasks", "completed_tasks")

    def __init__(
        self,
        category: str,
        resolution_id,
        resolution_title: str,
        total_tasks: int,
        completed_tasks: int,
    ) -> None:
        self.category = category
        self.display_name = get_category_display_name(category)
        self.resolution_id = resolution_id
        self.resolution_title = resolution_title
        self.total_tasks = total_tasks
        self.completed_tasks = completed_tasks

    def to_dict(self) -> Dict[str, object]:
        return {
            "category": self.category,
            "display_name": self.display_name,
            "resolution_id": str(self.resolution_id),
            "resolution_title": self.resolution_title,
            "total_tasks": self.total_tasks,
            "completed_tasks": self.completed_tasks,
        }


def build_daily_journey(db: Session, user_id: UUID, on_date: date | None = None) -> List[JourneyCategorySummary]:
    """Aggregate per-category progress for tasks scheduled on the given day."""
    target_day = on_date or date.today()
    resolutions = (
        db.query(Resolution)
        .filter(
            Resolution.user_id == user_id,
            Resolution.status == "active",
        )
        .order_by(Resolution.updated_at.desc())
        .all()
    )

    resolution_ids = [res.id for res in resolutions if res.id]
    tasks_by_resolution: DefaultDict[UUID, List[Task]] = defaultdict(list)
    if resolution_ids:
        task_rows = (
            db.query(Task)
            .filter(
                Task.user_id == user_id,
                Task.scheduled_day == target_day,
                Task.resolution_id.in_(resolution_ids),
            )
            .all()
        )
        for task in task_rows:
            if task.resolution_id:
                tasks_by_resolution[task.resolution_id].append(task)

    summaries: List[JourneyCategorySummary] = []
    for resolution in resolutions:
        category = resolution.category or infer_category(resolution.type)
        tasks = tasks_by_resolution.get(resolution.id, [])
        total = len(tasks)
        completed = sum(1 for t in tasks if t.completed)
        summaries.append(
            JourneyCategorySummary(
                category=category,
                resolution_id=resolution.id,
                resolution_title=resolution.title,
                total_tasks=total,
                completed_tasks=completed,
            )
        )

    return summaries
