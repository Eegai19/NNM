"""Global search schemas."""
from __future__ import annotations

from pydantic import BaseModel

from app.schemas.common import Page


class SearchHit(BaseModel):
    type: str
    id: int
    title: str
    subtitle: str | None = None
    url: str


class GlobalSearchResponse(BaseModel):
    query: str
    nodes: Page[SearchHit]
    activities: Page[SearchHit]
    engineers: Page[SearchHit]
    circles: Page[SearchHit]
    products: Page[SearchHit]
    total: int
