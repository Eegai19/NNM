"""User model."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import UserRole
from app.models.mixins import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from app.models.assignment import NodeAssignment
    from app.models.node import Node


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    mobile_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, native_enum=False, values_callable=lambda e: [m.value for m in e]),
        default=UserRole.ENGINEER,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships -------------------------------------------------------
    owned_nodes: Mapped[list["Node"]] = relationship(
        "Node", foreign_keys="Node.owner_id", back_populates="owner"
    )
    led_nodes: Mapped[list["Node"]] = relationship(
        "Node", foreign_keys="Node.lead_id", back_populates="lead"
    )
    tpm_nodes: Mapped[list["Node"]] = relationship(
        "Node", foreign_keys="Node.tpm_id", back_populates="tpm"
    )
    assignments: Mapped[list["NodeAssignment"]] = relationship(
        "NodeAssignment",
        foreign_keys="NodeAssignment.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<User id={self.id} username={self.username!r} role={self.role}>"
