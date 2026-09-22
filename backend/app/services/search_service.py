"""Global search across nodes, activities, engineers, circles and products."""
from __future__ import annotations

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.crud.base import count_query
from app.models.activity import NodeActivity
from app.models.catalog import ActivityMaster, Circle, Product
from app.models.node import Node
from app.models.user import User
from app.schemas.common import Page
from app.schemas.search import GlobalSearchResponse, SearchHit


def _paginate(
    db: Session, stmt: Select, *, page: int, page_size: int
) -> tuple[list, int]:
    total = count_query(db, stmt)
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return list(rows), total


def global_search(
    db: Session, query: str, *, page: int = 1, page_size: int = 10
) -> GlobalSearchResponse:
    """Search every searchable entity, each paginated independently."""
    term = (query or "").strip().lower()
    pattern = f"%{term}%"

    empty: Page[SearchHit] = Page.build([], 0, page, page_size)
    if not term:
        return GlobalSearchResponse(
            query=query,
            nodes=empty,
            activities=empty,
            engineers=empty,
            circles=empty,
            products=empty,
            total=0,
        )

    # --- Nodes -----------------------------------------------------------
    node_stmt = (
        select(Node.id, Node.node_name, Circle.circle_name, Product.product_name)
        .join(Circle, Node.circle_id == Circle.id)
        .join(Product, Node.product_id == Product.id)
        .where(func.lower(Node.node_name).like(pattern))
        .order_by(Node.node_name.asc())
    )
    node_rows, node_total = _paginate(db, node_stmt, page=page, page_size=page_size)
    nodes = [
        SearchHit(
            type="node",
            id=node_id,
            title=name,
            subtitle=f"{circle} / {product}",
            url=f"/nodes/{node_id}",
        )
        for node_id, name, circle, product in node_rows
    ]

    # --- Activities ------------------------------------------------------
    activity_stmt = (
        select(
            NodeActivity.id,
            ActivityMaster.activity_name,
            Node.id.label("node_id"),
            Node.node_name,
            NodeActivity.status,
        )
        .join(ActivityMaster, NodeActivity.activity_master_id == ActivityMaster.id)
        .join(Node, NodeActivity.node_id == Node.id)
        .where(func.lower(ActivityMaster.activity_name).like(pattern))
        .order_by(ActivityMaster.activity_name.asc())
    )
    activity_rows, activity_total = _paginate(db, activity_stmt, page=page, page_size=page_size)
    activities = [
        SearchHit(
            type="activity",
            id=activity_id,
            title=activity_name,
            subtitle=f"{node_name} - {status}",
            url=f"/nodes/{node_id}?activity={activity_id}",
        )
        for activity_id, activity_name, node_id, node_name, status in activity_rows
    ]

    # --- Engineers -------------------------------------------------------
    engineer_stmt = (
        select(User.id, User.name, User.username, User.role)
        .where(
            or_(
                func.lower(User.name).like(pattern),
                func.lower(User.username).like(pattern),
            )
        )
        .order_by(User.name.asc())
    )
    engineer_rows, engineer_total = _paginate(db, engineer_stmt, page=page, page_size=page_size)
    engineers = [
        SearchHit(
            type="engineer",
            id=user_id,
            title=name,
            subtitle=f"{username} - {role}",
            url=f"/nodes?assigned_user_id={user_id}",
        )
        for user_id, name, username, role in engineer_rows
    ]

    # --- Circles ---------------------------------------------------------
    circle_stmt = (
        select(Circle.id, Circle.circle_name)
        .where(func.lower(Circle.circle_name).like(pattern))
        .order_by(Circle.circle_name.asc())
    )
    circle_rows, circle_total = _paginate(db, circle_stmt, page=page, page_size=page_size)
    circles = [
        SearchHit(
            type="circle",
            id=circle_id,
            title=circle_name,
            subtitle="Circle",
            url=f"/nodes?circle_id={circle_id}",
        )
        for circle_id, circle_name in circle_rows
    ]

    # --- Products --------------------------------------------------------
    product_stmt = (
        select(Product.id, Product.product_name)
        .where(func.lower(Product.product_name).like(pattern))
        .order_by(Product.product_name.asc())
    )
    product_rows, product_total = _paginate(db, product_stmt, page=page, page_size=page_size)
    products = [
        SearchHit(
            type="product",
            id=product_id,
            title=product_name,
            subtitle="Product",
            url=f"/nodes?product_id={product_id}",
        )
        for product_id, product_name in product_rows
    ]

    return GlobalSearchResponse(
        query=query,
        nodes=Page.build(nodes, node_total, page, page_size),
        activities=Page.build(activities, activity_total, page, page_size),
        engineers=Page.build(engineers, engineer_total, page, page_size),
        circles=Page.build(circles, circle_total, page, page_size),
        products=Page.build(products, product_total, page, page_size),
        total=node_total + activity_total + engineer_total + circle_total + product_total,
    )
