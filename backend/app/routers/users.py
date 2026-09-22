"""User management endpoints (TPM only for every mutating operation)."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession, Pagination, UserManager
from app.crud import user as user_crud
from app.crud.base import count_query
from app.models.enums import AuditAction, AuditEntity, UserRole
from app.schemas.common import Message, Page
from app.schemas.user import PasswordReset, UserBrief, UserCreate, UserRead, UserUpdate
from app.services import audit_service
from app.utils.errors import bad_request, conflict, not_found
from app.utils.validators import ensure_unique_username

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=Page[UserRead], summary="List users")
def list_users(
    db: DbSession,
    current_user: CurrentUser,
    pagination: Pagination,
    search: str | None = Query(None, description="Match name, username or mobile"),
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> Page[UserRead]:
    """Every authenticated role may read the directory; only TPM may change it."""
    stmt = user_crud.build_query(db, search=search, role=role, is_active=is_active)
    total = count_query(db, stmt)
    rows = (
        db.execute(stmt.offset(pagination.offset).limit(pagination.page_size))
        .scalars()
        .all()
    )
    return Page.build(
        [UserRead.model_validate(row) for row in rows],
        total,
        pagination.page,
        pagination.page_size,
    )


@router.get("/assignable", response_model=list[UserBrief], summary="Users available for assignment")
def assignable_users(db: DbSession, current_user: CurrentUser) -> list[UserBrief]:
    stmt = user_crud.build_query(db, is_active=True)
    rows = db.execute(stmt).scalars().all()
    return [UserBrief.model_validate(row) for row in rows]


@router.post("", response_model=UserRead, status_code=201, summary="Create a user (TPM only)")
def create_user(payload: UserCreate, db: DbSession, manager: UserManager) -> UserRead:
    ensure_unique_username(db, payload.username)
    user = user_crud.create(db, payload)
    audit_service.record(
        db,
        entity_type=AuditEntity.USER,
        action=AuditAction.CREATE,
        entity_id=user.id,
        description=f"Created user '{user.name}' ({user.username}) with role {user.role}",
        actor=manager,
        changes={"role": str(user.role), "is_active": user.is_active},
    )
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.get("/{user_id}", response_model=UserRead, summary="Read a single user")
def read_user(user_id: int, db: DbSession, current_user: CurrentUser) -> UserRead:
    user = user_crud.get(db, user_id)
    if user is None:
        not_found("User", user_id)
    return UserRead.model_validate(user)


@router.put("/{user_id}", response_model=UserRead, summary="Update a user (TPM only)")
def update_user(
    user_id: int, payload: UserUpdate, db: DbSession, manager: UserManager
) -> UserRead:
    user = user_crud.get(db, user_id)
    if user is None:
        not_found("User", user_id)

    before = audit_service.snapshot(user, ["name", "mobile_number", "role", "is_active"])
    if (
        payload.is_active is False
        and user.id == manager.id
    ):
        bad_request("You cannot deactivate your own account")
    if payload.role is not None and user.id == manager.id and payload.role != UserRole.TPM:
        bad_request("You cannot remove your own TPM role")

    user_crud.update(db, user, payload)
    after = audit_service.snapshot(user, ["name", "mobile_number", "role", "is_active"])

    audit_service.record(
        db,
        entity_type=AuditEntity.USER,
        action=AuditAction.UPDATE,
        entity_id=user.id,
        description=f"Updated user '{user.name}'",
        actor=manager,
        changes=audit_service.diff(before, after),
    )
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.patch(
    "/{user_id}/status", response_model=UserRead, summary="Activate or deactivate a user"
)
def set_user_status(
    user_id: int, is_active: bool, db: DbSession, manager: UserManager
) -> UserRead:
    user = user_crud.get(db, user_id)
    if user is None:
        not_found("User", user_id)
    if user.id == manager.id and not is_active:
        bad_request("You cannot deactivate your own account")

    user.is_active = is_active
    db.flush()
    audit_service.record(
        db,
        entity_type=AuditEntity.USER,
        action=AuditAction.UPDATE,
        entity_id=user.id,
        description=f"{'Activated' if is_active else 'Deactivated'} user '{user.name}'",
        actor=manager,
        changes={"is_active": {"to": is_active}},
    )
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.post(
    "/{user_id}/reset-password", response_model=Message, summary="Reset a user's password"
)
def reset_password(
    user_id: int, payload: PasswordReset, db: DbSession, manager: UserManager
) -> Message:
    user = user_crud.get(db, user_id)
    if user is None:
        not_found("User", user_id)

    user_crud.set_password(db, user, payload.new_password)
    audit_service.record(
        db,
        entity_type=AuditEntity.USER,
        action=AuditAction.PASSWORD_RESET,
        entity_id=user.id,
        description=f"Reset password for '{user.name}'",
        actor=manager,
    )
    db.commit()
    return Message(detail=f"Password reset for {user.name}")


@router.delete("/{user_id}", response_model=Message, summary="Delete a user (TPM only)")
def delete_user(user_id: int, db: DbSession, manager: UserManager) -> Message:
    user = user_crud.get(db, user_id)
    if user is None:
        not_found("User", user_id)
    if user.id == manager.id:
        bad_request("You cannot delete your own account")
    if user.owned_nodes or user.led_nodes or user.tpm_nodes:
        conflict(
            "This user is still referenced by one or more nodes. "
            "Reassign those nodes first, or deactivate the account instead."
        )

    name = user.name
    user_crud.delete(db, user)
    audit_service.record(
        db,
        entity_type=AuditEntity.USER,
        action=AuditAction.DELETE,
        entity_id=user_id,
        description=f"Deleted user '{name}'",
        actor=manager,
    )
    db.commit()
    return Message(detail=f"User {name} deleted")
