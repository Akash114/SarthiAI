from fastapi import Request
from fastapi.responses import JSONResponse

from app.schemas.api import Error


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        *,
        code: str,
        message: str,
        request_id: str,
        details: dict | None = None,
    ) -> None:
        self.status_code = status_code
        self.body = Error(
            code=code,
            message=message,
            request_id=request_id,
            details=details,
        )


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.body.model_dump(mode="json"),
    )
