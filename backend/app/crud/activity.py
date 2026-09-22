"""Node activity and activity log persistence."""
from __future__ import annotations

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models.activity import ActivityLog, NodeActivity
from app.models.catalog import ActivityMaster, Circle, Product
from app.models.enums import ActivityStatus
from app.models.node import Node
from app.models.user import User


def get(db: Session, activity_id: int) -> NodeActivity | None:
    return db.get(NodeActivity, activity_id)


def get_for_node_master(db: Session, node_id: int, master_id: int) -> NodeActivity | None:
    return db.execute(
        select(NodeActivity).where(
            NodeActivity.node_id == node_id,
            NodeActivity.activity_master_id == master_id,
        )
    ).scalar_one_or_none()


def list_for_node(db: Session, node_id: int) -> list[NodeActivity]:
    return list(
        db.execute(
            select(NodeActivity)
            .where(NodeActivity.node_id == node_id)
            .order_by(NodeActivity.created_at.asc())
        )
        .unique()
        .scalars()
        .all()
    )


def build_list_query(
    *,
    search: str | None = None,
    node_id: int | None = None,
    status: ActivityStatus | None = None,
    assigned_to: int | None = None,
    circle_id: int | None = None,
    product_id: int | None = None,
) -> Select[tuple]:
    """Flattened activity query joining node, catalogue and assignee names."""
    log_count = (
        select(func.count(ActivityLog.id))
        .where(ActivityLog.node_activity_id == NodeActivity.id)
        .scalar_subquery()
    )
    stmt = (
        select(
            NodeActivity.id,
            NodeActivity.node_id,
            Node.node_name,
            ActivityMaster.activity_name,
            Circle.circle_name,
            Product.product_name,
            User.name.label("assignee_name"),
            NodeActivity.status,
            NodeActivity.start_date,
            NodeActivity.completed_date,
            NodeActivity.remarks,
            log_count.label("log_count"),
        )
        .join(Node, NodeActivity.node_id == Node.id)
        .join(ActivityMaster, NodeActivity.activity_master_id == ActivityMaster.id)
        .join(Circle, Node.circle_id == Circle.id)
        .join(Product, Node.product_id == Product.id)
        .outerjoin(User, NodeActivity.assigned_to == User.id)
    )

    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Node.node_name).like(pattern),
                func.lower(ActivityMaster.activity_name).like(pattern),
                func.lower(func.coalesce(User.name, "")).like(pattern),
                func.lower(Circle.circle_name).like(pattern),
                func.lower(Product.product_name).like(pattern),
            )
        )
    if node_id is not None:
        stmt = stmt.where(NodeActivity.node_id == node_id)
    if status is not None:
        stmt = stmt.where(NodeActivity.status == status)
    if assigned_to is not None:
        stmt = stmt.where(NodeActivity.assigned_to == assigned_to)
    if circle_id is not None:
        stmt = stmt.where(Node.circle_id == circle_id)
    if product_id is not None:
        stmt = stmt.where(Node.product_id == product_id)

    return stmt.order_by(NodeActivity.updated_at.desc())


def delete(db: Session, activity: NodeActivity) -> None:
    db.delete(activity)
    db.flush()


# --- Activity logs ---------------------------------------------------------
def get_log(db: Session, log_id: int) -> ActivityLog | None:
    return db.get(ActivityLog, log_id)


def list_logs(db: Session, activity_id: int) -> list[ActivityLog]:
    return list(
        db.execute(
            select(ActivityLog)
            .where(ActivityLog.node_activity_id == activity_id)
            .order_by(ActivityLog.uploaded_at.desc())
        )
        .unique()
        .scalars()
        .all()
    )


def count_logs(db: Session, activity_id: int) -> int:
    return int(
        db.execute(
            select(func.count(ActivityLog.id)).where(
                ActivityLog.node_activity_id == activity_id
            )
        ).scalar_one()
    )


def create_log(
    db: Session,
    *,
    activity_id: int,
    file_name: str,
    file_path: str,
    content_type: str | None,
    file_size: int | None,
    uploaded_by: int | None,
) -> ActivityLog:
    log = ActivityLog(
        node_activity_id=activity_id,
        file_name=file_name,
        file_path=file_path,
        content_type=content_type,
        file_size=file_size,
        uploaded_by=uploaded_by,
    )
    db.add(log)
    db.flush()
    return log


def delete_log(db: Session, log: ActivityLog) -> None:
    db.delete(log)
    db.flush()
