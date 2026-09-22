"""Reusable column mixins."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp used as the default for audit columns."""
    return datetime.now(timezone.utc)


class TimestampMixin:
    """Adds ``created_at`` / ``updated_at`` bookkeeping columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
