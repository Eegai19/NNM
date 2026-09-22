"""Node activity and activity log schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ActivityStatus
from app.schemas.catalog import ActivityMasterRead
from app.schemas.user import UserBrief


class NodeActivityCreate(BaseModel):
    activity_master_id: int
    assigned_to: int | None = None
    status: ActivityStatus = ActivityStatus.PENDING
    start_date: datetime | None = None
    remarks: str | None = Field(None, max_length=2000)


class NodeActivityUpdate(BaseModel):
    assigned_to: int | None = None
    status: ActivityStatus | None = None
    start_date: datetime | None = None
    completed_date: datetime | None = None
    remarks: str | None = Field(None, max_length=2000)


class ActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_activity_id: int
    file_name: str
    content_type: str | None = None
    file_size: int | None = None
    uploaded_by: int | None = None
    uploaded_at: datetime

    uploader: UserBrief | None = None


class NodeActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int
    activity_master_id: int
    assigned_to: int | None = None
    status: ActivityStatus
    start_date: datetime | None = None
    completed_date: datetime | None = None
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime

    activity_master: ActivityMasterRead | None = None
    assignee: UserBrief | None = None
    logs: list[ActivityLogRead] = []


class NodeActivityListItem(BaseModel):
    """Flattened activity row used by the global activity table and exports."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int
    node_name: str
    activity_name: str
    circle_name: str | None = None
    product_name: str | None = None
    assignee_name: str | None = None
    status: ActivityStatus
    start_date: datetime | None = None
    completed_date: datetime | None = None
    remarks: str | None = None
    log_count: int = 0
