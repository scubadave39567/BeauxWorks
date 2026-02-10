import logging

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class NotFoundError(HTTPException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=404, detail=detail)


class ConflictError(HTTPException):
    def __init__(self, detail: str = "Conflict"):
        super().__init__(status_code=409, detail=detail)


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(status_code=403, detail=detail)


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


class MfaRequiredError(HTTPException):
    def __init__(self, mfa_token: str):
        super().__init__(status_code=403, detail="MFA verification required")
        self.mfa_token = mfa_token


class AccountLockedError(HTTPException):
    def __init__(self, locked_until: str):
        super().__init__(status_code=423, detail=f"Account locked until {locked_until}")


class BusinessError(HTTPException):
    """Business logic error with an error_code for client handling."""

    def __init__(self, detail: str, *, error_code: str, status_code: int = 422):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code


async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    error_code = getattr(exc, "error_code", None)
    body: dict = {"success": False, "error": exc.detail}
    if error_code:
        body["error_code"] = error_code
    # Preserve MFA token if present
    if isinstance(exc, MfaRequiredError):
        body["mfa_token"] = exc.mfa_token
    return JSONResponse(status_code=exc.status_code, content=body, headers=getattr(exc, "headers", None))


async def generic_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"},
    )
