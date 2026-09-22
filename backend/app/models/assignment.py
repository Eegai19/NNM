"""Node assignment model -- links engineers to nodes with a role."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import AssignmentRole
from app.models.mixins import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from app.models.node import Node
    from app.models.user import User


class NodeAssignment(Base):
    __tablename__ = "node_assignments"
    __table_args__ = (
        # A user may hold only one role per node -- guards duplicate assignments
        # at the database level in addition to the service-layer validation.
        UniqueConstraint("node_id", "user_id", name="uq_node_assignment_node_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    node_id: Mapped[int] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[AssignmentRole] = mapped_column(
        SAEnum(
            AssignmentRole,
            native_enum=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        index=True,
    )
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    node: Mapped["Node"] = relationship("Node", back_populates="assignments")
    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="assignments", lazy="joined"
    )
    assigner: Mapped["User | None"] = relationship(
        "User", foreign_keys=[assigned_by], lazy="joined"
    )
