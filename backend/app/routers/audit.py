"""Audit trail endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.deps import DbSession, Pagination, require_admin
from app.crud import audit as audit_crud
from app.crud.base import count_query
from app.models.enums import AuditAction, AuditEntity
from app.models.user import User
from app.schemas.audit import AuditTrailRead
from app.schemas.common import Page

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.get(
    "", response_model=Page[AuditTrailRead], summary="Browse the audit trail (TPM / LEAD)"
)
def list_audit(
    db: DbSession,
    pagination: Pagination,
    entity_type: AuditEntity | None = None,
    entity_id: int | None = None,
    node_id: int | None = None,
    action: AuditAction | None = None,
    performed_by: int | None = None,
    admin: User = Depends(require_admin),
) -> Page[AuditTrailRead]:
    stmt = audit_crud.build_query(
        entity_type=entity_type,
        entity_id=entity_id,
        node_id=node_id,
        action=action,
        performed_by=performed_by,
    )
    total = count_query(db, stmt)
    rows = (
        db.execute(stmt.offset(pagination.offset).limit(pagination.page_size))
        .unique()
        .scalars()
        .all()
    )
    return Page.build(
        [AuditTrailRead.model_validate(row) for row in rows],
        total,
        pagination.page,
        pagination.page_size,
    )
