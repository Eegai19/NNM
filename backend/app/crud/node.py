"""Node persistence and filtering."""
from __future__ import annotations

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models.activity import NodeActivity
from app.models.assignment import NodeAssignment
from app.models.catalog import Circle, Product
from app.models.enums import ActivityStatus, DeploymentState, NodeStatus
from app.models.node import Node
from app.models.user import User
from app.schemas.node import NodeCreate, NodeUpdate


def get(db: Session, node_id: int) -> Node | None:
    return db.get(Node, node_id)


def get_by_name(db: Session, node_name: str) -> Node | None:
    return db.execute(
        select(Node).where(func.lower(Node.node_name) == node_name.strip().lower())
    ).scalar_one_or_none()


def build_query(
    *,
    search: str | None = None,
    circle_id: int | None = None,
    product_id: int | None = None,
    deployment_state: DeploymentState | None = None,
    overall_status: NodeStatus | None = None,
    assigned_user_id: int | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
) -> Select[tuple[Node]]:
    """Compose the filtered node query used by the list endpoint and exports."""
    stmt = select(Node)

    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.join(Circle, Node.circle_id == Circle.id).join(
            Product, Node.product_id == Product.id
        )
        stmt = stmt.where(
            or_(
                func.lower(Node.node_name).like(pattern),
                func.lower(Circle.circle_name).like(pattern),
                func.lower(Product.product_name).like(pattern),
            )
        )
    if circle_id is not None:
        stmt = stmt.where(Node.circle_id == circle_id)
    if product_id is not None:
        stmt = stmt.where(Node.product_id == product_id)
    if deployment_state is not None:
        stmt = stmt.where(Node.deployment_state == deployment_state)
    if overall_status is not None:
        stmt = stmt.where(Node.overall_status == overall_status)
    if assigned_user_id is not None:
        assigned_nodes = select(NodeAssignment.node_id).where(
            NodeAssignment.user_id == assigned_user_id
        )
        stmt = stmt.where(
            or_(
                Node.id.in_(assigned_nodes),
                Node.owner_id == assigned_user_id,
                Node.lead_id == assigned_user_id,
                Node.tpm_id == assigned_user_id,
            )
        )

    sortable = {
        "node_name": Node.node_name,
        "created_at": Node.created_at,
        "updated_at": Node.updated_at,
        "deployment_state": Node.deployment_state,
        "overall_status": Node.overall_status,
    }
    column = sortable.get(sort_by, Node.created_at)
    return stmt.order_by(column.desc() if sort_dir.lower() == "desc" else column.asc())


def create(db: Session, payload: NodeCreate) -> Node:
    node = Node(**payload.model_dump())
    db.add(node)
    db.flush()
    return node


def update(db: Session, node: Node, payload: NodeUpdate) -> Node:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(node, field, value)
    db.flush()
    return node


def delete(db: Session, node: Node) -> None:
    db.delete(node)
    db.flush()


def activity_counts(db: Session, node_ids: list[int]) -> dict[int, dict[str, int]]:
    """Aggregate per-node activity counters in a single round trip."""
    if not node_ids:
        return {}

    rows = db.execute(
        select(NodeActivity.node_id, NodeActivity.status, func.count(NodeActivity.id))
        .where(NodeActivity.node_id.in_(node_ids))
        .group_by(NodeActivity.node_id, NodeActivity.status)
    ).all()

    counts: dict[int, dict[str, int]] = {
        node_id: {
            "total_activities": 0,
            "pending_activities": 0,
            "in_progress_activities": 0,
            "completed_activities": 0,
            "assigned_engineers": 0,
        }
        for node_id in node_ids
    }
    status_field = {
        ActivityStatus.PENDING: "pending_activities",
        ActivityStatus.IN_PROGRESS: "in_progress_activities",
        ActivityStatus.COMPLETED: "completed_activities",
    }
    for node_id, status, count in rows:
        bucket = counts[node_id]
        bucket["total_activities"] += count
        key = status_field.get(ActivityStatus(status))
        if key:
            bucket[key] += count

    assignment_rows = db.execute(
        select(NodeAssignment.node_id, func.count(NodeAssignment.id))
        .where(NodeAssignment.node_id.in_(node_ids))
        .group_by(NodeAssignment.node_id)
    ).all()
    for node_id, count in assignment_rows:
        counts[node_id]["assigned_engineers"] = count

    return counts


def recalculate_overall_status(db: Session, node: Node) -> Node:
    """Derive ``overall_status`` from the node's activities.

    No activities -> NOT_STARTED; all completed -> COMPLETED; otherwise
    IN_PROGRESS. A node explicitly marked BLOCKED keeps that status.
    """
    if node.overall_status == NodeStatus.BLOCKED:
        return node

    rows = db.execute(
        select(NodeActivity.status, func.count(NodeActivity.id))
        .where(NodeActivity.node_id == node.id)
        .group_by(NodeActivity.status)
    ).all()
    by_status = {ActivityStatus(status): count for status, count in rows}
    total = sum(by_status.values())

    if total == 0:
        node.overall_status = NodeStatus.NOT_STARTED
    elif by_status.get(ActivityStatus.COMPLETED, 0) == total:
        node.overall_status = NodeStatus.COMPLETED
    elif by_status.get(ActivityStatus.PENDING, 0) == total:
        node.overall_status = NodeStatus.NOT_STARTED
    else:
        node.overall_status = NodeStatus.IN_PROGRESS

    db.flush()
    return node


def engineer_candidates(db: Session) -> list[User]:
    return list(
        db.execute(select(User).where(User.is_active.is_(True)).order_by(User.name.asc()))
        .scalars()
        .all()
    )
