"""Node activity and activity log models."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ActivityStatus
from app.models.mixins import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from app.models.catalog import ActivityMaster
    from app.models.node import Node
    from app.models.user import User


class NodeActivity(Base):
    __tablename__ = "node_activities"
    __table_args__ = (
        # The same catalogue activity may only be attached to a node once.
        UniqueConstraint("node_id", "activity_master_id", name="uq_node_activity_node_master"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    node_id: Mapped[int] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_master_id: Mapped[int] = mapped_column(
        ForeignKey("activity_masters.id"), nullable=False, index=True
    )
    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    status: Mapped[ActivityStatus] = mapped_column(
        SAEnum(
            ActivityStatus,
            native_enum=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        default=ActivityStatus.PENDING,
        nullable=False,
        index=True,
    )
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    node: Mapped["Node"] = relationship("Node", back_populates="activities")
    activity_master: Mapped["ActivityMaster"] = relationship(
        "ActivityMaster", back_populates="node_activities", lazy="joined"
    )
    assignee: Mapped["User | None"] = relationship(
        "User", foreign_keys=[assigned_to], lazy="joined"
    )
    logs: Mapped[list["ActivityLog"]] = relationship(
        "ActivityLog",
        back_populates="node_activity",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ActivityLog.uploaded_at.desc()",
    )


class ActivityLog(Base):
    """A file attached to a node activity as evidence of the work done."""

    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    node_activity_id: Mapped[int] = mapped_column(
        ForeignKey("node_activities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    node_activity: Mapped["NodeActivity"] = relationship("NodeActivity", back_populates="logs")
    uploader: Mapped["User | None"] = relationship(
        "User", foreign_keys=[uploaded_by], lazy="joined"
    )
