import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# In-memory rate limiter for auth endpoints
_buckets: dict[str, list[float]] = defaultdict(list)

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 10  # requests per window
RATE_LIMITED_PREFIXES = ("/api/v1/auth/login", "/api/v1/auth/verify-mfa")


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if not any(path.startswith(p) for p in RATE_LIMITED_PREFIXES):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{path}"
        now = time.time()

        # Clean old entries
        _buckets[key] = [t for t in _buckets[key] if now - t < RATE_LIMIT_WINDOW]

        if len(_buckets[key]) >= RATE_LIMIT_MAX:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
            )

        _buckets[key].append(now)
        return await call_next(request)
