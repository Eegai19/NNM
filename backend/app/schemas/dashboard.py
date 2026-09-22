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
