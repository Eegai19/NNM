"""Global search endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.search import GlobalSearchResponse
from app.services import search_service

router = APIRouter(prefix="/search", tags=["Search"])


@router.get(
    "",
    response_model=GlobalSearchResponse,
    summary="Search nodes, activities, engineers, circles and products",
)
def global_search(
    db: DbSession,
    current_user: CurrentUser,
    q: str = Query("", description="Search term", max_length=120),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> GlobalSearchResponse:
    return search_service.global_search(db, q, page=page, page_size=page_size)
