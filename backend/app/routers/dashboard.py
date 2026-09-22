"""Dashboard aggregation endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.dashboard import (
    CircleSummaryItem,
    DashboardSummary,
    EngineerWorkloadItem,
    HierarchyProduct,
    StatusBreakdownItem,
)
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary, summary="Headline counters")
def summary(db: DbSession, current_user: CurrentUser) -> DashboardSummary:
    return dashboard_service.summary(db)


@router.get(
    "/circle-summary", response_model=list[CircleSummaryItem], summary="Node count per circle"
)
def circle_summary(db: DbSession, current_user: CurrentUser) -> list[CircleSummaryItem]:
    return dashboard_service.circle_summary(db)


@router.get(
    "/engineer-workload",
    response_model=list[EngineerWorkloadItem],
    summary="Nodes and activities per engineer",
)
def engineer_workload(
    db: DbSession, current_user: CurrentUser, limit: int = Query(20, ge=1, le=100)
) -> list[EngineerWorkloadItem]:
    return dashboard_service.engineer_workload(db, limit=limit)


@router.get(
    "/status-breakdown",
    response_model=list[StatusBreakdownItem],
    summary="Node count per deployment state",
)
def status_breakdown(db: DbSession, current_user: CurrentUser) -> list[StatusBreakdownItem]:
    return dashboard_service.status_breakdown(db)


@router.get(
    "/hierarchy",
    response_model=list[HierarchyProduct],
    summary="Product -> circle rollup for the dashboard drill-down",
)
def hierarchy(db: DbSession, current_user: CurrentUser) -> list[HierarchyProduct]:
    """Node and activity counts per product and per circle within it.

    Expanding a circle in the UI loads its nodes from
    ``GET /nodes?product_id=&circle_id=``, so this stays a small response.
    """
    return dashboard_service.hierarchy(db)
