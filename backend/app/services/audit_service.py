"""Audit trail recording.

Every mutating endpoint funnels through :func:`record` so the application keeps
a single, consistent history of who did what and when.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditTrail
from app.models.enums import AuditAction, AuditEntity
from app.models.user import User


def _serialise(changes: dict[str, Any] | None) -> str | None:
    if not changes:
        return None
    try:
        return json.dumps(changes, default=str, ensure_ascii=False)
    except (TypeError, ValueError):  # pragma: no cover - defensive
        return None


def record(
    db: Session,
    *,
    entity_type: AuditEntity,
    action: AuditAction,
    description: str,
    actor: User | None = None,
    entity_id: int | None = None,
    node_id: int | None = None,
    changes: dict[str, Any] | None = None,
) -> AuditTrail:
    """Append an entry to the audit trail (flushed, not committed)."""
    entry = AuditTrail(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        node_id=node_id,
        description=description,
        changes=_serialise(changes),
        performed_by=actor.id if actor else None,
        performed_by_name=actor.name if actor else None,
    )
    db.add(entry)
    db.flush()
    return entry


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Return ``{field: {"from": x, "to": y}}`` for every changed field."""
    changed: dict[str, Any] = {}
    for key, new_value in after.items():
        old_value = before.get(key)
        if old_value != new_value:
            changed[key] = {"from": old_value, "to": new_value}
    return changed


def snapshot(instance: Any, fields: list[str]) -> dict[str, Any]:
    """Capture the named attributes of an ORM instance for diffing."""
    return {field: getattr(instance, field, None) for field in fields}
