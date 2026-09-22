"""Node assignment schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import AssignmentRole
from app.schemas.user import UserBrief


class AssignmentCreate(BaseModel):
    user_id: int
    role: AssignmentRole


class AssignmentUpdate(BaseModel):
    role: AssignmentRole


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int
    user_id: int
    role: AssignmentRole
    assigned_by: int | None = None
    created_at: datetime

    user: UserBrief | None = None
    assigner: UserBrief | None = None
