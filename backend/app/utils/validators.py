"""Cross-entity validation helpers shared by the routers."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.crud import node as node_crud
from app.crud import user as user_crud
from app.models.catalog import ActivityMaster, Circle, Product
from app.models.node import Node
from app.models.user import User
from app.utils.errors import bad_request, conflict, not_found


def ensure_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        not_found("Product", product_id)
    if not product.is_active:
        bad_request(f"Product '{product.product_name}' is inactive")
    return product


def ensure_circle(db: Session, circle_id: int) -> Circle:
    circle = db.get(Circle, circle_id)
    if circle is None:
        not_found("Circle", circle_id)
    if not circle.is_active:
        bad_request(f"Circle '{circle.circle_name}' is inactive")
    return circle


def ensure_activity_master(db: Session, master_id: int) -> ActivityMaster:
    master = db.get(ActivityMaster, master_id)
    if master is None:
        not_found("Activity", master_id)
    if not master.is_active:
        bad_request(f"Activity '{master.activity_name}' is inactive")
    return master


def ensure_user(db: Session, user_id: int, *, label: str = "User") -> User:
    user = user_crud.get(db, user_id)
    if user is None:
        not_found(label, user_id)
    if not user.is_active:
        bad_request(f"{label} '{user.name}' is deactivated")
    return user


def ensure_node(db: Session, node_id: int) -> Node:
    node = node_crud.get(db, node_id)
    if node is None:
        not_found("Node", node_id)
    return node


def ensure_unique_node_name(db: Session, node_name: str, *, exclude_id: int | None = None) -> None:
    existing = node_crud.get_by_name(db, node_name)
    if existing is not None and existing.id != exclude_id:
        conflict(f"A node named '{node_name}' already exists")


def ensure_unique_username(db: Session, username: str, *, exclude_id: int | None = None) -> None:
    existing = user_crud.get_by_username(db, username)
    if existing is not None and existing.id != exclude_id:
        conflict(f"Username '{username}' is already taken")
