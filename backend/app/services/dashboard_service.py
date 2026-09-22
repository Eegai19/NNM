"""Aggregations backing the dashboard endpoints."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.activity import NodeActivity
from app.models.assignment import NodeAssignment
from app.models.catalog import Circle
from app.models.enums import ActivityStatus, UserRole
from app.models.node import Node
from app.models.user import User
from app.schemas.dashboard import (
    CircleSummaryItem,
    DashboardSummary,
    EngineerWorkloadItem,
    StatusBreakdownItem,
)


def summary(db: Session) -> DashboardSummary:
    total_nodes = int(db.execute(select(func.count(Node.id))).scalar_one())

    status_rows = db.execute(
        select(NodeActivity.status, func.count(NodeActivity.id)).group_by(NodeActivity.status)
    ).all()
    by_status = {ActivityStatus(status): count for status, count in status_rows}

    pending = by_status.get(ActivityStatus.PENDING, 0)
    in_progress = by_status.get(ActivityStatus.IN_PROGRESS, 0)
    completed = by_status.get(ActivityStatus.COMPLETED, 0)
    total_activities = pending + in_progress + completed

    total_users = int(db.execute(select(func.count(User.id))).scalar_one())
    total_engineers = int(
        db.execute(
            select(func.count(User.id)).where(User.role == UserRole.ENGINEER)
        ).scalar_one()
    )

    return DashboardSummary(
        total_nodes=total_nodes,
        pending_activities=pending,
        in_progress_activities=in_progress,
        completed_activities=completed,
        total_activities=total_activities,
        total_users=total_users,
        total_engineers=total_engineers,
        completion_rate=round(completed / total_activities * 100, 1) if total_activities else 0.0,
    )


def circle_summary(db: Session) -> list[CircleSummaryItem]:
    rows = db.execute(
        select(Circle.circle_name, func.count(Node.id))
        .select_from(Circle)
        .outerjoin(Node, Node.circle_id == Circle.id)
        .group_by(Circle.id, Circle.circle_name)
        .order_by(func.count(Node.id).desc(), Circle.circle_name.asc())
    ).all()
    return [CircleSummaryItem(circle=name, count=int(count)) for name, count in rows]


def engineer_workload(db: Session, *, limit: int = 20) -> list[EngineerWorkloadItem]:
    """Assigned node count and activity count per active engineer."""
    assigned_nodes = (
        select(func.count(func.distinct(NodeAssignment.node_id)))
        .where(NodeAssignment.user_id == User.id)
        .scalar_subquery()
    )
    activity_count = (
        select(func.count(NodeActivity.id))
        .where(NodeActivity.assigned_to == User.id)
        .scalar_subquery()
    )

    rows = db.execute(
        select(User.name, assigned_nodes.label("nodes"), activity_count.label("activities"))
        .where(User.is_active.is_(True), User.role == UserRole.ENGINEER)
        .order_by(assigned_nodes.desc(), activity_count.desc(), User.name.asc())
        .limit(limit)
    ).all()

    return [
        EngineerWorkloadItem(engineer=name, assigned_nodes=int(nodes), activities=int(activities))
        for name, nodes, activities in rows
    ]


def status_breakdown(db: Session) -> list[StatusBreakdownItem]:
    """Node counts per deployment state -- powers the dashboard donut chart."""
    rows = db.execute(
        select(Node.deployment_state, func.count(Node.id))
        .group_by(Node.deployment_state)
        .order_by(func.count(Node.id).desc())
    ).all()
    return [StatusBreakdownItem(status=str(state), count=int(count)) for state, count in rows]
