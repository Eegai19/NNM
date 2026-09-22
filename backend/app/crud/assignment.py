"""Node assignment persistence."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assignment import NodeAssignment
from app.models.enums import AssignmentRole


def list_for_node(db: Session, node_id: int) -> list[NodeAssignment]:
    return list(
        db.execute(
            select(NodeAssignment)
            .where(NodeAssignment.node_id == node_id)
            .order_by(NodeAssignment.created_at.asc())
        )
        .unique()
        .scalars()
        .all()
    )


def get(db: Session, assignment_id: int) -> NodeAssignment | None:
    return db.get(NodeAssignment, assignment_id)


def get_for_node_user(db: Session, node_id: int, user_id: int) -> NodeAssignment | None:
    return db.execute(
        select(NodeAssignment).where(
            NodeAssignment.node_id == node_id, NodeAssignment.user_id == user_id
        )
    ).scalar_one_or_none()


def get_by_role(db: Session, node_id: int, role: AssignmentRole) -> NodeAssignment | None:
    return db.execute(
        select(NodeAssignment).where(
            NodeAssignment.node_id == node_id, NodeAssignment.role == role
        )
    ).scalar_one_or_none()


def create(
    db: Session, *, node_id: int, user_id: int, role: AssignmentRole, assigned_by: int | None
) -> NodeAssignment:
    assignment = NodeAssignment(
        node_id=node_id, user_id=user_id, role=role, assigned_by=assigned_by
    )
    db.add(assignment)
    db.flush()
    return assignment


def delete(db: Session, assignment: NodeAssignment) -> None:
    db.delete(assignment)
    db.flush()
