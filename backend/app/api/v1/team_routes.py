from __future__ import annotations

import secrets
import string
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.exceptions import ApiError
from app.api.v1.deps import _rid, current_user_id
from app.db import get_db
from app.models.team import Team as TeamORM
from app.models.team_member import TeamMember as TeamMemberORM
from app.models.user import User
from app.schemas.api import (
    Team,
    TeamCreateRequest,
    TeamCreateResponse,
    TeamDetailResponse,
    TeamJoinRequest,
    TeamListResponse,
    TeamMemberOut,
    TeamSummary,
)

router = APIRouter(tags=["teams"])


def _gen_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


def _ensure_member(db: Session, team_id: UUID, user_id: UUID, rid: str) -> TeamMemberORM:
    member = db.get(TeamMemberORM, {"team_id": team_id, "user_id": user_id})
    if member is None:
        raise ApiError(403, code="forbidden", message="Not a team member", request_id=rid)
    return member


def _ensure_admin(db: Session, team_id: UUID, user_id: UUID, rid: str) -> None:
    member = _ensure_member(db, team_id, user_id, rid)
    if member.role != "admin":
        raise ApiError(403, code="forbidden", message="Admin role required", request_id=rid)


@router.post("/teams", response_model=TeamCreateResponse, status_code=201)
def create_team(
    request: Request,
    body: TeamCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> TeamCreateResponse:
    rid = _rid(request)
    name = body.name.strip()
    if not name:
        raise ApiError(400, code="validation", message="name must not be empty", request_id=rid)
    invite_code = _gen_invite_code()
    for _ in range(8):
        if db.scalar(select(TeamORM).where(TeamORM.invite_code == invite_code)) is None:
            break
        invite_code = _gen_invite_code()
    else:
        raise ApiError(500, code="server_error", message="Could not generate invite code", request_id=rid)
    team = TeamORM(name=name, invite_code=invite_code, created_by_user_id=user_id)
    db.add(team)
    db.flush()
    db.add(TeamMemberORM(team_id=team.id, user_id=user_id, role="admin"))
    db.commit()
    db.refresh(team)
    return TeamCreateResponse(team=Team.model_validate(team), invite_code=team.invite_code)


@router.get("/teams", response_model=TeamListResponse)
def list_teams(
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> TeamListResponse:
    memberships = db.scalars(
        select(TeamMemberORM).where(TeamMemberORM.user_id == user_id).order_by(TeamMemberORM.joined_at.desc())
    ).all()
    out: list[TeamSummary] = []
    for membership in memberships:
        team = db.get(TeamORM, membership.team_id)
        if team is None:
            continue
        member_count = db.scalar(
            select(func.count()).select_from(TeamMemberORM).where(TeamMemberORM.team_id == team.id)
        ) or 0
        out.append(
            TeamSummary(
                id=team.id,
                name=team.name,
                role="admin" if membership.role == "admin" else "member",
                member_count=int(member_count),
            )
        )
    return TeamListResponse(teams=out)


@router.get("/teams/{team_id}", response_model=TeamDetailResponse)
def team_detail(
    request: Request,
    team_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> TeamDetailResponse:
    rid = _rid(request)
    _ensure_member(db, team_id, user_id, rid)
    team = db.get(TeamORM, team_id)
    if team is None:
        raise ApiError(404, code="not_found", message="Team not found", request_id=rid)
    members = db.scalars(select(TeamMemberORM).where(TeamMemberORM.team_id == team_id)).all()
    out_members: list[TeamMemberOut] = []
    for member in members:
        user = db.get(User, member.user_id)
        if user is None:
            continue
        out_members.append(
            TeamMemberOut(
                user_id=member.user_id,
                email=user.email,
                display_name=user.display_name,
                profile_image_url=user.profile_image_url,
                role="admin" if member.role == "admin" else "member",
                joined_at=member.joined_at,
            )
        )
    return TeamDetailResponse(team=Team.model_validate(team), members=out_members)


@router.post("/teams/join", response_model=TeamDetailResponse)
def join_team(
    request: Request,
    body: TeamJoinRequest,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> TeamDetailResponse:
    rid = _rid(request)
    team = db.scalar(select(TeamORM).where(TeamORM.invite_code == body.invite_code.strip().upper()))
    if team is None:
        raise ApiError(404, code="not_found", message="Invite code not found", request_id=rid)
    if db.get(TeamMemberORM, {"team_id": team.id, "user_id": user_id}) is not None:
        raise ApiError(409, code="already_member", message="Already a team member", request_id=rid)
    db.add(TeamMemberORM(team_id=team.id, user_id=user_id, role="member"))
    db.commit()
    return team_detail(request, team.id, db, user_id)


@router.post("/teams/{team_id}/leave", status_code=204, response_class=Response)
def leave_team(
    request: Request,
    team_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Response:
    rid = _rid(request)
    member = _ensure_member(db, team_id, user_id, rid)
    if member.role == "admin":
        admin_count = db.scalar(
            select(func.count()).select_from(TeamMemberORM).where(TeamMemberORM.team_id == team_id, TeamMemberORM.role == "admin")
        ) or 0
        if admin_count <= 1:
            raise ApiError(400, code="last_admin", message="Sole admin cannot leave team", request_id=rid)
    db.delete(member)
    db.commit()
    return Response(status_code=204)


@router.delete("/teams/{team_id}", status_code=204, response_class=Response)
def delete_team(
    request: Request,
    team_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> Response:
    rid = _rid(request)
    _ensure_admin(db, team_id, user_id, rid)
    team = db.get(TeamORM, team_id)
    if team is None:
        raise ApiError(404, code="not_found", message="Team not found", request_id=rid)
    db.delete(team)
    db.commit()
    return Response(status_code=204)
