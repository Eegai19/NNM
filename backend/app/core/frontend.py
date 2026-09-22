"""Serve the built frontend from the API process.

When ``NNM_FRONTEND_DIST_DIR`` contains a Vite build, the same server that
answers ``/api`` also serves the single-page app. That keeps deployment to one
process on one port, and because everything is same-origin there is no CORS to
configure at all.

If no build is present the API runs on its own, which is what the tests and the
``npm run dev`` workflow rely on.
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings

logger = logging.getLogger("nnm")

#: Path prefixes the SPA fallback must never answer, so an unknown API route
#: still returns a JSON 404 instead of the HTML shell.
API_PREFIXES: tuple[str, ...] = ("api", "docs", "redoc", "openapi.json", "health")

#: Vite emits content-hashed file names under /assets, so they can be cached
#: indefinitely. index.html must never be cached or clients pin an old build.
ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"
INDEX_CACHE_CONTROL = "no-cache"


def _is_api_path(path: str) -> bool:
    head = path.lstrip("/").split("/", 1)[0]
    return head in API_PREFIXES


def mount_frontend(app: FastAPI) -> bool:
    """Attach static-file and SPA-fallback routes. Returns whether it mounted."""
    dist = Path(settings.frontend_dist_dir)
    index_file = dist / "index.html"

    if not index_file.is_file():
        logger.info(
            "No frontend build at %s -- serving the API only. "
            "Run `npm run build` in frontend/ to bundle the UI.",
            dist,
        )
        return False

    assets_dir = dist / "assets"
    if assets_dir.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=assets_dir),
            name="assets",
        )

    @app.middleware("http")
    async def _cache_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/assets/"):
            response.headers.setdefault("Cache-Control", ASSET_CACHE_CONTROL)
        return response

    def _index() -> FileResponse:
        return FileResponse(index_file, headers={"Cache-Control": INDEX_CACHE_CONTROL})

    # Registered last so every API route is matched first.
    @app.get("/", include_in_schema=False)
    async def serve_root() -> FileResponse:
        return _index()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        if _is_api_path(full_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Not found"
            )

        # Serve a real file when one exists (favicon.svg and friends), refusing
        # anything that tries to escape the build directory.
        if full_path:
            candidate = (dist / full_path).resolve()
            if candidate.is_relative_to(dist.resolve()) and candidate.is_file():
                return FileResponse(candidate)

        # Everything else is a client-side route.
        return _index()

    logger.info("Serving the frontend from %s", dist)
    return True
