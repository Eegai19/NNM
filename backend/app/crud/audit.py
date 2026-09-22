"""Audit trail persistence."""
from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.audit import AuditTrail
from app.models.enums import AuditAction, AuditEntity


def build_query(
    *,
    entity_type: AuditEntity | None = None,
    entity_id: int | None = None,
    node_id: int | None = None,
    action: AuditAction | None = None,
    performed_by: int | None = None,
) -> Select[tuple[AuditTrail]]:
    stmt = select(AuditTrail)
    if entity_type is not None:
        stmt = stmt.where(AuditTrail.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(AuditTrail.entity_id == entity_id)
    if node_id is not None:
        stmt = stmt.where(AuditTrail.node_id == node_id)
    if action is not None:
        stmt = stmt.where(AuditTrail.action == action)
    if performed_by is not None:
        stmt = stmt.where(AuditTrail.performed_by == performed_by)
    return stmt.order_by(AuditTrail.created_at.desc(), AuditTrail.id.desc())
