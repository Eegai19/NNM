"""Product, circle and activity-master persistence."""
from __future__ import annotations

from typing import TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.catalog import ActivityMaster, Circle, Product

ModelT = TypeVar("ModelT", Product, Circle, ActivityMaster)


# --- Product ---------------------------------------------------------------
def list_products(db: Session, *, include_inactive: bool = False) -> list[Product]:
    stmt: Select[tuple[Product]] = select(Product).order_by(Product.product_name.asc())
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))
    return list(db.execute(stmt).scalars().all())


def get_product_by_name(db: Session, name: str) -> Product | None:
    return db.execute(
        select(Product).where(func.lower(Product.product_name) == name.strip().lower())
    ).scalar_one_or_none()


# --- Circle ----------------------------------------------------------------
def list_circles(db: Session, *, include_inactive: bool = False) -> list[Circle]:
    stmt: Select[tuple[Circle]] = select(Circle).order_by(Circle.circle_name.asc())
    if not include_inactive:
        stmt = stmt.where(Circle.is_active.is_(True))
    return list(db.execute(stmt).scalars().all())


def get_circle_by_name(db: Session, name: str) -> Circle | None:
    return db.execute(
        select(Circle).where(func.lower(Circle.circle_name) == name.strip().lower())
    ).scalar_one_or_none()


# --- Activity master -------------------------------------------------------
def list_activity_masters(db: Session, *, include_inactive: bool = False) -> list[ActivityMaster]:
    stmt: Select[tuple[ActivityMaster]] = select(ActivityMaster).order_by(
        ActivityMaster.activity_name.asc()
    )
    if not include_inactive:
        stmt = stmt.where(ActivityMaster.is_active.is_(True))
    return list(db.execute(stmt).scalars().all())


def get_activity_master_by_name(db: Session, name: str) -> ActivityMaster | None:
    return db.execute(
        select(ActivityMaster).where(
            func.lower(ActivityMaster.activity_name) == name.strip().lower()
        )
    ).scalar_one_or_none()
