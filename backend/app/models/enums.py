"""Domain enumerations shared by models, schemas and services."""
from __future__ import annotations

from enum import Enum


class StrEnum(str, Enum):
    """String enum whose members compare equal to their value."""

    def __str__(self) -> str:  # pragma: no cover - trivial
        return str(self.value)


class UserRole(StrEnum):
    TPM = "TPM"
    LEAD = "LEAD"
    ENGINEER = "ENGINEER"


class DeploymentState(StrEnum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    INTEGRATION = "INTEGRATION"
    ACCEPTANCE = "ACCEPTANCE"
    LIVE = "LIVE"
    ON_HOLD = "ON_HOLD"
    CANCELLED = "CANCELLED"


class NodeStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"


class ActivityStatus(StrEnum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"


class AssignmentRole(StrEnum):
    PRIMARY_OWNER = "PRIMARY_OWNER"
    SECONDARY_OWNER = "SECONDARY_OWNER"
    SUPPORT_ENGINEER = "SUPPORT_ENGINEER"


class AuditAction(StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    ASSIGN = "ASSIGN"
    UNASSIGN = "UNASSIGN"
    STATUS_CHANGE = "STATUS_CHANGE"
    UPLOAD = "UPLOAD"
    DOWNLOAD = "DOWNLOAD"
    LOGIN = "LOGIN"
    PASSWORD_RESET = "PASSWORD_RESET"


class AuditEntity(StrEnum):
    USER = "USER"
    NODE = "NODE"
    NODE_ACTIVITY = "NODE_ACTIVITY"
    NODE_ASSIGNMENT = "NODE_ASSIGNMENT"
    ACTIVITY_LOG = "ACTIVITY_LOG"
    ACTIVITY_MASTER = "ACTIVITY_MASTER"
    PRODUCT = "PRODUCT"
    CIRCLE = "CIRCLE"


#: Roles that hold organisation-wide write access.
ADMIN_ROLES: frozenset[UserRole] = frozenset({UserRole.TPM, UserRole.LEAD})

#: Assignment roles that grant an engineer write access to a node.
MODIFY_ASSIGNMENT_ROLES: frozenset[AssignmentRole] = frozenset(
    {
        AssignmentRole.PRIMARY_OWNER,
        AssignmentRole.SECONDARY_OWNER,
        AssignmentRole.SUPPORT_ENGINEER,
    }
)
