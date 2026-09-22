"""Vercel serverless entry point.

Vercel's Python runtime looks for an ASGI application called ``app`` inside an
``api/`` directory at the service root, so this module simply re-exports the
FastAPI application.

Running here imposes two constraints that the rest of the project does not:

* the filesystem is ephemeral, so ``NNM_DATABASE_URL`` must point at a hosted
  PostgreSQL instance -- SQLite would be lost between invocations;
* uploaded activity-log artifacts also need external storage, which the local
  storage service does not yet provide.

See the "Deploying to Vercel" section of the README before using this.
"""
from __future__ import annotations

from app.main import app

__all__ = ["app"]
