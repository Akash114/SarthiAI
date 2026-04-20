"""Client-readable notification configuration."""

from fastapi import APIRouter

from app.config import get_settings
from app.schemas.api import NotificationsConfigResponse

router = APIRouter(tags=["devices"])


@router.get(
    "/notifications/config",
    response_model=NotificationsConfigResponse,
)
def notifications_config() -> NotificationsConfigResponse:
    s = get_settings()
    return NotificationsConfigResponse(
        enabled=s.notifications_enabled,
        provider="expo" if s.notifications_enabled else "noop",
    )
