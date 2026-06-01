from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.focus_session import FocusSession
from app.models.goal import Goal
from app.models.task import Task
from app.models.team_member import TeamMember
from app.models.user import User


def build_companion_context(
    db: Session,
    *,
    user_id: UUID,
    focus_session_id: UUID | None = None,
    task_id: UUID | None = None,
    goal_id: UUID | None = None,
    team_id: UUID | None = None,
) -> dict[str, Any]:
    user = db.get(User, user_id)
    now = datetime.now(UTC)
    active_focus = None
    if focus_session_id is not None:
        active_focus = db.get(FocusSession, focus_session_id)
    if active_focus is None:
        active_focus = db.scalar(
            select(FocusSession)
            .where(FocusSession.user_id == user_id, FocusSession.ended_at.is_(None))
            .order_by(FocusSession.started_at.desc())
        )

    if task_id is None and active_focus is not None:
        task_id = active_focus.task_id

    active_task = db.get(Task, task_id) if task_id else None
    if goal_id is None and active_task is not None:
        goal_id = active_task.goal_id
    active_goal = db.get(Goal, goal_id) if goal_id else None

    personal_tasks = db.scalars(
        select(Task)
        .where(Task.user_id == user_id, Task.status == "open")
        .order_by(Task.due_at.is_(None), Task.due_at, Task.created_at.desc())
        .limit(30)
    ).all()
    personal_goals = db.scalars(
        select(Goal).where(Goal.user_id == user_id, Goal.status == "active").order_by(Goal.created_at.desc()).limit(20)
    ).all()
    memberships = db.scalars(select(TeamMember).where(TeamMember.user_id == user_id)).all()
    team_ids = [membership.team_id for membership in memberships]
    team_tasks: list[Task] = []
    team_goals: list[Goal] = []
    if team_ids:
        team_tasks = db.scalars(
            select(Task)
            .where(Task.team_id.in_(team_ids), Task.status == "open")
            .order_by(Task.due_at.is_(None), Task.due_at, Task.created_at.desc())
            .limit(30)
        ).all()
        team_goals = db.scalars(
            select(Goal).where(Goal.team_id.in_(team_ids), Goal.status == "active").order_by(Goal.created_at.desc()).limit(20)
        ).all()
    recent_completed = db.scalars(
        select(Task)
        .where(Task.completed_by_user_id == user_id, Task.completed_at >= now - timedelta(days=14))
        .order_by(Task.completed_at.desc())
        .limit(20)
    ).all()

    def task_json(task: Task) -> dict[str, Any]:
        return {
            "id": str(task.id),
            "title": task.title,
            "notes": task.notes,
            "goal_id": str(task.goal_id) if task.goal_id else None,
            "team_id": str(task.team_id) if task.team_id else None,
            "due_at": task.due_at.isoformat() if task.due_at else None,
            "status": task.status,
            "priority": task.priority,
        }

    def goal_json(goal: Goal) -> dict[str, Any]:
        return {
            "id": str(goal.id),
            "title": goal.title,
            "description": goal.description,
            "team_id": str(goal.team_id) if goal.team_id else None,
            "target_at": goal.target_at.isoformat() if goal.target_at else None,
            "progress_summary": goal.progress_summary,
        }

    return {
        "generated_at": now.isoformat(),
        "user": {
            "id": str(user_id),
            "email": user.email if user else None,
            "display_name": user.display_name if user else None,
        },
        "active_focus_session": {
            "id": str(active_focus.id),
            "task_id": str(active_focus.task_id) if active_focus.task_id else None,
            "started_at": active_focus.started_at.isoformat(),
        }
        if active_focus
        else None,
        "active_task": task_json(active_task) if active_task else None,
        "active_goal": goal_json(active_goal) if active_goal else None,
        "requested_team_id": str(team_id) if team_id else None,
        "open_tasks": [task_json(task) for task in [*personal_tasks, *team_tasks]],
        "active_goals": [goal_json(goal) for goal in [*personal_goals, *team_goals]],
        "recent_completed_tasks": [task_json(task) for task in recent_completed],
    }
