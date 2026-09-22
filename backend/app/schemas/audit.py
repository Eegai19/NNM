"""Audit trail schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import AuditAction, AuditEntity


class AuditTrailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: AuditEntity
    entity_id: int | None = None
    action: AuditAction
    node_id: int | None = None
    description: str
    changes: str | None = None
    performed_by: int | None = None
    performed_by_name: str | None = None
    created_at: datetime
