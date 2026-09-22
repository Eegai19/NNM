"""Aggregations backing the dashboard endpoints."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.activity import NodeActivity
from app.models.assignment import NodeAssignment
from app.models.catalog import Circle, Product
from app.models.enums import ActivityStatus, NodeStatus, UserRole
from app.models.node import Node
from app.models.user import User
from app.schemas.dashboard import (
    CircleSummaryItem,
    DashboardSummary,
    EngineerWorkloadItem,
    HierarchyCircle,
    HierarchyProduct,
    StatusBreakdownItem,
    StatusCounts,
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


#: Maps a node status onto the field that counts it.
_STATUS_FIELDS = {
    NodeStatus.NOT_STARTED: "not_started",
    NodeStatus.IN_PROGRESS: "in_progress",
    NodeStatus.COMPLETED: "completed",
    NodeStatus.BLOCKED: "blocked",
}


def hierarchy(db: Session) -> list[HierarchyProduct]:
    """Product -> circle rollup for the dashboard drill-down.

    Node rows themselves are not included: the UI fetches them from
    ``GET /nodes?product_id=&circle_id=`` when a circle is expanded, so this
    response stays small however large the inventory grows.
    """
    products = list(
        db.execute(select(Product).order_by(Product.product_name.asc())).scalars().all()
    )
    result = {
        product.id: HierarchyProduct(
            product_id=product.id,
            product=product.product_name,
            status=StatusCounts(),
            circles=[],
        )
        for product in products
    }
    circles_by_product: dict[int, dict[int, HierarchyCircle]] = {p.id: {} for p in products}

    # --- Node counts, grouped by product, circle and status ----------------
    node_rows = db.execute(
        select(
            Node.product_id,
            Node.circle_id,
            Circle.circle_name,
            Node.overall_status,
            func.count(Node.id),
        )
        .join(Circle, Node.circle_id == Circle.id)
        .group_by(Node.product_id, Node.circle_id, Circle.circle_name, Node.overall_status)
    ).all()

    for product_id, circle_id, circle_name, status, count in node_rows:
        product_entry = result.get(product_id)
        if product_entry is None:  # a node pointing at a deleted product
            continue

        bucket = circles_by_product[product_id].get(circle_id)
        if bucket is None:
            bucket = HierarchyCircle(
                circle_id=circle_id, circle=circle_name, status=StatusCounts()
            )
            circles_by_product[product_id][circle_id] = bucket

        field = _STATUS_FIELDS[NodeStatus(status)]
        setattr(bucket.status, field, getattr(bucket.status, field) + count)
        setattr(product_entry.status, field, getattr(product_entry.status, field) + count)
        bucket.node_count += count
        product_entry.node_count += count

    # --- Activity progress, same grouping ----------------------------------
    activity_rows = db.execute(
        select(Node.product_id, Node.circle_id, NodeActivity.status, func.count(NodeActivity.id))
        .join(NodeActivity, NodeActivity.node_id == Node.id)
        .group_by(Node.product_id, Node.circle_id, NodeActivity.status)
    ).all()

    for product_id, circle_id, status, count in activity_rows:
        product_entry = result.get(product_id)
        bucket = circles_by_product.get(product_id, {}).get(circle_id)
        if product_entry is None or bucket is None:
            continue

        product_entry.total_activities += count
        bucket.total_activities += count
        if ActivityStatus(status) == ActivityStatus.COMPLETED:
            product_entry.completed_activities += count
            bucket.completed_activities += count

    for product_id, buckets in circles_by_product.items():
        result[product_id].circles = sorted(buckets.values(), key=lambda c: c.circle)

    return [result[product.id] for product in products]
