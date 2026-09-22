"""Node schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import DeploymentState, NodeStatus
from app.schemas.catalog import CircleRead, ProductRead
from app.schemas.user import UserBrief


class NodeBase(BaseModel):
    node_name: str = Field(..., min_length=2, max_length=160)
    product_id: int
    circle_id: int
    owner_id: int | None = None
    lead_id: int | None = None
    tpm_id: int | None = None
    deployment_state: DeploymentState = DeploymentState.PLANNED
    overall_status: NodeStatus = NodeStatus.NOT_STARTED

    @field_validator("node_name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Node name cannot be blank")
        return value


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    node_name: str | None = Field(None, min_length=2, max_length=160)
    product_id: int | None = None
    circle_id: int | None = None
    owner_id: int | None = None
    lead_id: int | None = None
    tpm_id: int | None = None
    deployment_state: DeploymentState | None = None
    overall_status: NodeStatus | None = None

    @field_validator("node_name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Node name cannot be blank")
        return value


class NodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_name: str
    product_id: int
    circle_id: int
    owner_id: int | None = None
    lead_id: int | None = None
    tpm_id: int | None = None
    deployment_state: DeploymentState
    overall_status: NodeStatus
    created_at: datetime
    updated_at: datetime

    product: ProductRead | None = None
    circle: CircleRead | None = None
    owner: UserBrief | None = None
    lead: UserBrief | None = None
    tpm: UserBrief | None = None


class NodeSummary(NodeRead):
    """Node row enriched with activity counters for table views."""

    total_activities: int = 0
    completed_activities: int = 0
    pending_activities: int = 0
    in_progress_activities: int = 0
    assigned_engineers: int = 0
