from fastapi import APIRouter

from app.api.v1 import (
    auth,
    brain_dump_routes,
    core_routes,
    focus_sessions_routes,
    notification_config,
    preferences_routes,
    team_routes,
    users_onboard,
)

v1_router = APIRouter()
v1_router.include_router(auth.router)
v1_router.include_router(users_onboard.router)
v1_router.include_router(preferences_routes.router)
v1_router.include_router(brain_dump_routes.router)
v1_router.include_router(notification_config.router)
v1_router.include_router(core_routes.router)
v1_router.include_router(focus_sessions_routes.router)
v1_router.include_router(team_routes.router)
