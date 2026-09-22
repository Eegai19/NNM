"""Master data: products, circles and the activity catalogue."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:  # pragma: no cover
    from app.models.activity import NodeActivity
    from app.models.node import Node


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    nodes: Mapped[list["Node"]] = relationship("Node", back_populates="product")


class Circle(Base):
    __tablename__ = "circles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    circle_name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    nodes: Mapped[list["Node"]] = relationship("Node", back_populates="circle")


class ActivityMaster(Base):
    __tablename__ = "activity_masters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    activity_name: Mapped[str] = mapped_column(
        String(160), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    node_activities: Mapped[list["NodeActivity"]] = relationship(
        "NodeActivity", back_populates="activity_master"
    )
