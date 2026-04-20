from fastapi import APIRouter

from app.api.v1 import (
    auth,
    brain_dump_routes,
    core_routes,
    dashboard_routes,
    notification_config,
    ops_routes,
    planning_routes,
    preferences_routes,
    users_onboard,
)

v1_router = APIRouter()
v1_router.include_router(auth.router)
v1_router.include_router(users_onboard.router)
v1_router.include_router(preferences_routes.router)
v1_router.include_router(brain_dump_routes.router)
v1_router.include_router(notification_config.router)
v1_router.include_router(core_routes.router)
v1_router.include_router(planning_routes.router)
v1_router.include_router(dashboard_routes.router)
v1_router.include_router(ops_routes.router)
