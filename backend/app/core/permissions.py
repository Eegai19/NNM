"""Role and node-level authorisation rules.

Permission matrix
-----------------
TPM       full access everywhere (users, nodes, activities, catalogue, exports)
LEAD      operational admin -- may create/edit nodes, assign engineers and
          manage activities, but may never touch user accounts
ENGINEER  read-only everywhere, except on nodes they are assigned to through
          PRIMARY_OWNER / SECONDARY_OWNER / SUPPORT_ENGINEER
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assignment import NodeAssignment
from app.models.enums import ADMIN_ROLES, MODIFY_ASSIGNMENT_ROLES, UserRole
from app.models.user import User


def is_admin(user: User) -> bool:
    """TPM and LEAD both hold organisation-wide write access."""
    return user.role in ADMIN_ROLES


def is_tpm(user: User) -> bool:
    return user.role == UserRole.TPM


def can_manage_users(user: User) -> bool:
    """Only a TPM may create, edit, deactivate or delete user accounts."""
    return user.role == UserRole.TPM


def can_delete_nodes(user: User) -> bool:
    """Node deletion is destructive and therefore TPM-only."""
    return user.role == UserRole.TPM


def can_create_nodes(user: User) -> bool:
    return is_admin(user)


def can_manage_catalog(user: User) -> bool:
    """Products, circles and the activity catalogue are admin-managed."""
    return is_admin(user)


def can_assign_engineers(user: User) -> bool:
    return is_admin(user)


def can_modify_node(db: Session, user: User, node_id: int) -> bool:
    """Return ``True`` when ``user`` may write to the node identified by ``node_id``.

    TPM and LEAD always may. An engineer may only when an assignment row links
    them to the node with one of the three modify-granting roles.
    """
    if not user.is_active:
        return False
    if is_admin(user):
        return True

    assignment_role = db.execute(
        select(NodeAssignment.role).where(
            NodeAssignment.node_id == node_id,
            NodeAssignment.user_id == user.id,
        )
    ).scalar_one_or_none()
    return assignment_role in MODIFY_ASSIGNMENT_ROLES


def require_node_modify_access(db: Session, user: User, node_id: int) -> None:
    """Raise ``403`` unless ``user`` may modify the node."""
    if not can_modify_node(db, user, node_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this node",
        )


def require_role(user: User, *roles: UserRole) -> None:
    """Raise ``403`` unless ``user`` holds one of ``roles``."""
    if user.role not in roles:
        allowed = ", ".join(str(role) for role in roles)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This action requires one of the following roles: {allowed}",
        )
