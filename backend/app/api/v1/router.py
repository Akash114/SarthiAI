from fastapi import APIRouter

from app.api.v1 import auth, core_routes, users_onboard

v1_router = APIRouter()
v1_router.include_router(auth.router)
v1_router.include_router(users_onboard.router)
v1_router.include_router(core_routes.router)
