"""NNM -- Nokia Node Manager: FastAPI application entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.database import init_db
from app.routers import (
    activities,
    audit,
    auth,
    catalog,
    dashboard,
    exports,
    nodes,
    search,
    users,
)

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("nnm")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and the storage directory before serving the first request."""
    Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)
    init_db()
    logger.info("NNM API ready (environment=%s)", settings.environment)
    yield
    logger.info("NNM API shutting down")


app = FastAPI(
    title=settings.project_name,
    description=(
        "Operations portal for tracking Nokia network node deployments, the "
        "activities performed on them and the engineers who own them."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Return a single readable message alongside the per-field errors.

    Pydantic puts the original exception object in ``ctx``, which is not JSON
    serialisable, so each error is rebuilt from its primitive fields only.
    """
    messages: list[str] = []
    errors: list[dict[str, str]] = []
    for error in exc.errors():
        location = " -> ".join(str(part) for part in error.get("loc", []) if part != "body")
        message = str(error.get("msg", "Invalid value"))
        messages.append(f"{location}: {message}" if location else message)
        errors.append({"field": location, "message": message, "type": str(error.get("type", ""))})

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "; ".join(messages) or "Validation error", "errors": errors},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Translate database constraint violations into a 409 instead of a 500."""
    logger.warning("Integrity error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": (
                "This operation conflicts with existing data "
                "(a duplicate or a referenced record still in use)."
            )
        },
    )


API = settings.api_v1_prefix
for router in (
    auth.router,
    users.router,
    catalog.router,
    nodes.router,
    activities.router,
    dashboard.router,
    search.router,
    audit.router,
    exports.router,
):
    app.include_router(router, prefix=API)


@app.get("/", tags=["Health"], summary="Service banner")
def root() -> dict[str, str]:
    return {
        "name": settings.project_name,
        "version": app.version,
        "docs": "/docs",
        "status": "ok",
    }


@app.get("/health", tags=["Health"], summary="Liveness probe")
def health() -> dict[str, str]:
    return {"status": "healthy", "environment": settings.environment}
