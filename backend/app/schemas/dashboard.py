"""Dashboard schemas."""
from __future__ import annotations

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_nodes: int = 0
    pending_activities: int = 0
    in_progress_activities: int = 0
    completed_activities: int = 0
    # Extra context used by the dashboard cards -- harmless for API consumers
    # that only read the four documented counters.
    total_activities: int = 0
    total_users: int = 0
    total_engineers: int = 0
    completion_rate: float = 0.0


class CircleSummaryItem(BaseModel):
    circle: str
    count: int


class EngineerWorkloadItem(BaseModel):
    engineer: str
    assigned_nodes: int
    activities: int


class StatusBreakdownItem(BaseModel):
    status: str
    count: int


class StatusCounts(BaseModel):
    """Node counts per overall status, used at every level of the hierarchy."""

    not_started: int = 0
    in_progress: int = 0
    completed: int = 0
    blocked: int = 0

    @property
    def total(self) -> int:
        return self.not_started + self.in_progress + self.completed + self.blocked


class HierarchyCircle(BaseModel):
    circle_id: int
    circle: str
    node_count: int = 0
    status: StatusCounts = StatusCounts()
    total_activities: int = 0
    completed_activities: int = 0


class HierarchyProduct(BaseModel):
    product_id: int
    product: str
    node_count: int = 0
    status: StatusCounts = StatusCounts()
    total_activities: int = 0
    completed_activities: int = 0
    circles: list[HierarchyCircle] = []
