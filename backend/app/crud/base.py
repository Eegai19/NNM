"""Small helpers shared by the CRUD modules."""
from __future__ import annotations

from typing import Any, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


def count_query(db: Session, stmt: Select[Any]) -> int:
    """Return the number of rows a select statement would produce."""
    subquery = stmt.order_by(None).subquery()
    return int(db.execute(select(func.count()).select_from(subquery)).scalar_one())


def apply_pagination(stmt: Select[Any], *, offset: int, limit: int) -> Select[Any]:
    return stmt.offset(offset).limit(limit)
