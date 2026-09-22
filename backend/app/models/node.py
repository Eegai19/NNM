"""Node model -- the central entity of the application."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import DeploymentState, NodeStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:  # pragma: no cover
    from app.models.activity import NodeActivity
    from app.models.assignment import NodeAssignment
    from app.models.catalog import Circle, Product
    from app.models.user import User


class Node(Base, TimestampMixin):
    __tablename__ = "nodes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    node_name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False, index=True)

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    circle_id: Mapped[int] = mapped_column(ForeignKey("circles.id"), nullable=False, index=True)

    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    tpm_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    deployment_state: Mapped[DeploymentState] = mapped_column(
        SAEnum(
            DeploymentState,
            native_enum=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        default=DeploymentState.PLANNED,
        nullable=False,
        index=True,
    )
    overall_status: Mapped[NodeStatus] = mapped_column(
        SAEnum(NodeStatus, native_enum=False, values_callable=lambda e: [m.value for m in e]),
        default=NodeStatus.NOT_STARTED,
        nullable=False,
        index=True,
    )

    # Relationships -------------------------------------------------------
    product: Mapped["Product"] = relationship("Product", back_populates="nodes", lazy="joined")
    circle: Mapped["Circle"] = relationship("Circle", back_populates="nodes", lazy="joined")
    owner: Mapped["User | None"] = relationship(
        "User", foreign_keys=[owner_id], back_populates="owned_nodes", lazy="joined"
    )
    lead: Mapped["User | None"] = relationship(
        "User", foreign_keys=[lead_id], back_populates="led_nodes", lazy="joined"
    )
    tpm: Mapped["User | None"] = relationship(
        "User", foreign_keys=[tpm_id], back_populates="tpm_nodes", lazy="joined"
    )

    assignments: Mapped[list["NodeAssignment"]] = relationship(
        "NodeAssignment",
        back_populates="node",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    activities: Mapped[list["NodeActivity"]] = relationship(
        "NodeActivity",
        back_populates="node",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Node id={self.id} name={self.node_name!r}>"
