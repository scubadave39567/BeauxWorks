import hashlib
import json

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.database import SessionLocal
from app.models.production import ApiIdempotencyKey


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Supports X-Idempotency-Key header for offline queue replay.

    Only applies to POST/PUT/PATCH requests that include the header.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method not in ("POST", "PUT", "PATCH"):
            return await call_next(request)

        idem_key = request.headers.get("X-Idempotency-Key")
        if not idem_key:
            return await call_next(request)

        # We need the user_id from the auth context — extract from token
        # For simplicity, look up in DB by key only (scoped to key uniqueness)
        # Full implementation would parse the JWT here
        db = SessionLocal()
        try:
            existing = (
                db.query(ApiIdempotencyKey)
                .filter(ApiIdempotencyKey.idempotency_key == idem_key)
                .first()
            )
            if existing and existing.response_metadata_json:
                cached = json.loads(existing.response_metadata_json)
                return JSONResponse(
                    status_code=cached.get("status_code", 200),
                    content=cached.get("body"),
                )
        finally:
            db.close()

        return await call_next(request)
