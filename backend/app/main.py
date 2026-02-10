import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.config import settings
from fastapi import HTTPException

from app.exceptions import generic_exception_handler, http_exception_handler
from app.middleware.audit import AuditMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: import models so relationships are resolved
    import app.models  # noqa: F401

    yield
    # Shutdown


app = FastAPI(
    title="BeauxWorks API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimitMiddleware)

# Exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Mount v1 API
app.include_router(api_v1_router)


@app.get("/health")
def health():
    return {"status": "ok"}
