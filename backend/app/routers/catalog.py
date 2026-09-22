"""Master data endpoints: products, circles and the activity catalogue."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, DbSession, require_admin, require_tpm
from app.crud import catalog as catalog_crud
from app.models.catalog import ActivityMaster, Circle, Product
from app.models.enums import AuditAction, AuditEntity
from app.models.user import User
from app.schemas.catalog import (
    ActivityMasterCreate,
    ActivityMasterRead,
    ActivityMasterUpdate,
    CircleCreate,
    CircleRead,
    CircleUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
)
from app.schemas.common import Message
from app.services import audit_service
from app.utils.errors import conflict, not_found

router = APIRouter(tags=["Master Data"])


# --- Products --------------------------------------------------------------
@router.get("/products", response_model=list[ProductRead], summary="List products")
def list_products(
    db: DbSession, current_user: CurrentUser, include_inactive: bool = Query(False)
) -> list[ProductRead]:
    return [
        ProductRead.model_validate(row)
        for row in catalog_crud.list_products(db, include_inactive=include_inactive)
    ]


@router.post("/products", response_model=ProductRead, status_code=201, summary="Create a product")
def create_product(
    payload: ProductCreate, db: DbSession, admin: User = Depends(require_admin)
) -> ProductRead:
    if catalog_crud.get_product_by_name(db, payload.product_name):
        conflict(f"A product named '{payload.product_name}' already exists")
    product = Product(product_name=payload.product_name.strip(), is_active=payload.is_active)
    db.add(product)
    db.flush()
    audit_service.record(
        db,
        entity_type=AuditEntity.PRODUCT,
        action=AuditAction.CREATE,
        entity_id=product.id,
        description=f"Created product '{product.product_name}'",
        actor=admin,
    )
    db.commit()
    db.refresh(product)
    return ProductRead.model_validate(product)


@router.put("/products/{product_id}", response_model=ProductRead, summary="Update a product")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: DbSession,
    admin: User = Depends(require_admin),
) -> ProductRead:
    product = db.get(Product, product_id)
    if product is None:
        not_found("Product", product_id)
    if payload.product_name:
        existing = catalog_crud.get_product_by_name(db, payload.product_name)
        if existing and existing.id != product_id:
            conflict(f"A product named '{payload.product_name}' already exists")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value.strip() if isinstance(value, str) else value)
    db.flush()
    audit_service.record(
        db,
        entity_type=AuditEntity.PRODUCT,
        action=AuditAction.UPDATE,
        entity_id=product.id,
        description=f"Updated product '{product.product_name}'",
        actor=admin,
    )
    db.commit()
    db.refresh(product)
    return ProductRead.model_validate(product)


@router.delete("/products/{product_id}", response_model=Message, summary="Delete a product")
def delete_product(
    product_id: int, db: DbSession, tpm: User = Depends(require_tpm)
) -> Message:
    product = db.get(Product, product_id)
    if product is None:
        not_found("Product", product_id)
    if product.nodes:
        conflict("This product is still used by one or more nodes")
    name = product.product_name
    db.delete(product)
    audit_service.record(
        db,
        entity_type=AuditEntity.PRODUCT,
        action=AuditAction.DELETE,
        entity_id=product_id,
        description=f"Deleted product '{name}'",
        actor=tpm,
    )
    db.commit()
    return Message(detail=f"Product {name} deleted")


# --- Circles ---------------------------------------------------------------
@router.get("/circles", response_model=list[CircleRead], summary="List circles")
def list_circles(
    db: DbSession, current_user: CurrentUser, include_inactive: bool = Query(False)
) -> list[CircleRead]:
    return [
        CircleRead.model_validate(row)
        for row in catalog_crud.list_circles(db, include_inactive=include_inactive)
    ]


@router.post("/circles", response_model=CircleRead, status_code=201, summary="Create a circle")
def create_circle(
    payload: CircleCreate, db: DbSession, admin: User = Depends(require_admin)
) -> CircleRead:
    if catalog_crud.get_circle_by_name(db, payload.circle_name):
        conflict(f"A circle named '{payload.circle_name}' already exists")
    circle = Circle(circle_name=payload.circle_name.strip(), is_active=payload.is_active)
    db.add(circle)
    db.flush()
    audit_service.record(
        db,
        entity_type=AuditEntity.CIRCLE,
        action=AuditAction.CREATE,
        entity_id=circle.id,
        description=f"Created circle '{circle.circle_name}'",
        actor=admin,
    )
    db.commit()
    db.refresh(circle)
    return CircleRead.model_validate(circle)


@router.put("/circles/{circle_id}", response_model=CircleRead, summary="Update a circle")
def update_circle(
    circle_id: int, payload: CircleUpdate, db: DbSession, admin: User = Depends(require_admin)
) -> CircleRead:
    circle = db.get(Circle, circle_id)
    if circle is None:
        not_found("Circle", circle_id)
    if payload.circle_name:
        existing = catalog_crud.get_circle_by_name(db, payload.circle_name)
        if existing and existing.id != circle_id:
            conflict(f"A circle named '{payload.circle_name}' already exists")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(circle, field, value.strip() if isinstance(value, str) else value)
    db.flush()
    audit_service.record(
        db,
        entity_type=AuditEntity.CIRCLE,
        action=AuditAction.UPDATE,
        entity_id=circle.id,
        description=f"Updated circle '{circle.circle_name}'",
        actor=admin,
    )
    db.commit()
    db.refresh(circle)
    return CircleRead.model_validate(circle)


@router.delete("/circles/{circle_id}", response_model=Message, summary="Delete a circle")
def delete_circle(circle_id: int, db: DbSession, tpm: User = Depends(require_tpm)) -> Message:
    circle = db.get(Circle, circle_id)
    if circle is None:
        not_found("Circle", circle_id)
    if circle.nodes:
        conflict("This circle is still used by one or more nodes")
    name = circle.circle_name
    db.delete(circle)
    audit_service.record(
        db,
        entity_type=AuditEntity.CIRCLE,
        action=AuditAction.DELETE,
        entity_id=circle_id,
        description=f"Deleted circle '{name}'",
        actor=tpm,
    )
    db.commit()
    return Message(detail=f"Circle {name} deleted")


# --- Activity catalogue ----------------------------------------------------
@router.get(
    "/activity-masters",
    response_model=list[ActivityMasterRead],
    summary="List catalogue activities",
)
def list_activity_masters(
    db: DbSession, current_user: CurrentUser, include_inactive: bool = Query(False)
) -> list[ActivityMasterRead]:
    return [
        ActivityMasterRead.model_validate(row)
        for row in catalog_crud.list_activity_masters(db, include_inactive=include_inactive)
    ]


@router.post(
    "/activity-masters",
    response_model=ActivityMasterRead,
    status_code=201,
    summary="Create a catalogue activity",
)
def create_activity_master(
    payload: ActivityMasterCreate, db: DbSession, admin: User = Depends(require_admin)
) -> ActivityMasterRead:
    if catalog_crud.get_activity_master_by_name(db, payload.activity_name):
        conflict(f"An activity named '{payload.activity_name}' already exists")
    master = ActivityMaster(
        activity_name=payload.activity_name.strip(),
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(master)
    db.flush()
    audit_service.record(
        db,
        entity_type=AuditEntity.ACTIVITY_MASTER,
        action=AuditAction.CREATE,
        entity_id=master.id,
        description=f"Created activity '{master.activity_name}'",
        actor=admin,
    )
    db.commit()
    db.refresh(master)
    return ActivityMasterRead.model_validate(master)


@router.put(
    "/activity-masters/{master_id}",
    response_model=ActivityMasterRead,
    summary="Update a catalogue activity",
)
def update_activity_master(
    master_id: int,
    payload: ActivityMasterUpdate,
    db: DbSession,
    admin: User = Depends(require_admin),
) -> ActivityMasterRead:
    master = db.get(ActivityMaster, master_id)
    if master is None:
        not_found("Activity", master_id)
    if payload.activity_name:
        existing = catalog_crud.get_activity_master_by_name(db, payload.activity_name)
        if existing and existing.id != master_id:
            conflict(f"An activity named '{payload.activity_name}' already exists")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(master, field, value.strip() if isinstance(value, str) else value)
    db.flush()
    audit_service.record(
        db,
        entity_type=AuditEntity.ACTIVITY_MASTER,
        action=AuditAction.UPDATE,
        entity_id=master.id,
        description=f"Updated activity '{master.activity_name}'",
        actor=admin,
    )
    db.commit()
    db.refresh(master)
    return ActivityMasterRead.model_validate(master)


@router.delete(
    "/activity-masters/{master_id}",
    response_model=Message,
    summary="Delete a catalogue activity (TPM only)",
)
def delete_activity_master(
    master_id: int, db: DbSession, tpm: User = Depends(require_tpm)
) -> Message:
    master = db.get(ActivityMaster, master_id)
    if master is None:
        not_found("Activity", master_id)
    if master.node_activities:
        conflict(
            "This activity is already attached to one or more nodes. "
            "Deactivate it instead of deleting it."
        )
    name = master.activity_name
    db.delete(master)
    audit_service.record(
        db,
        entity_type=AuditEntity.ACTIVITY_MASTER,
        action=AuditAction.DELETE,
        entity_id=master_id,
        description=f"Deleted activity '{name}'",
        actor=tpm,
    )
    db.commit()
    return Message(detail=f"Activity {name} deleted")
