"""ORM models. Importing this package registers every mapper."""
from app.models.activity import ActivityLog, NodeActivity
from app.models.assignment import NodeAssignment
from app.models.audit import AuditTrail
from app.models.catalog import ActivityMaster, Circle, Product
from app.models.enums import (
    ADMIN_ROLES,
    MODIFY_ASSIGNMENT_ROLES,
    ActivityStatus,
    AssignmentRole,
    AuditAction,
    AuditEntity,
    DeploymentState,
    NodeStatus,
    UserRole,
)
from app.models.node import Node
from app.models.user import User

__all__ = [
    "ADMIN_ROLES",
    "MODIFY_ASSIGNMENT_ROLES",
    "ActivityLog",
    "ActivityMaster",
    "ActivityStatus",
    "AssignmentRole",
    "AuditAction",
    "AuditEntity",
    "AuditTrail",
    "Circle",
    "DeploymentState",
    "Node",
    "NodeActivity",
    "NodeAssignment",
    "NodeStatus",
    "Product",
    "User",
    "UserRole",
]
