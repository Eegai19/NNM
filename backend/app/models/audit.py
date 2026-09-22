"""Audit trail model -- an append-only record of every mutating action."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import AuditAction, AuditEntity
from app.models.mixins import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from app.models.user import User


class AuditTrail(Base):
    __tablename__ = "audit_trail"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    entity_type: Mapped[AuditEntity] = mapped_column(
        SAEnum(AuditEntity, native_enum=False, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[AuditAction] = mapped_column(
        SAEnum(AuditAction, native_enum=False, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        index=True,
    )
    #: Optional node the action relates to -- lets a node page show its timeline.
    node_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    #: JSON-encoded before/after payload (kept as text so SQLite and PostgreSQL agree).
    changes: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    performed_by_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    performer: Mapped["User | None"] = relationship(
        "User", foreign_keys=[performed_by], lazy="joined"
    )
