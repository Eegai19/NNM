"""Authentication endpoints."""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.security import create_access_token, verify_password
from app.crud import user as user_crud
from app.models.enums import AuditAction, AuditEntity
from app.schemas.auth import ChangePasswordRequest, LoginRequest, Token
from app.schemas.common import Message
from app.schemas.user import UserRead
from app.services import audit_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

#: "Remember me" keeps the session alive for a working week.
REMEMBER_ME_DAYS = 7


@router.post("/login", response_model=Token, summary="Exchange credentials for a JWT")
def login(payload: LoginRequest, db: DbSession) -> Token:
    user = user_crud.get_by_username(db, payload.username)
    if user is None or not verify_password(payload.password, user.password_hash):
        # Identical message for both cases so the endpoint cannot be used to
        # enumerate valid usernames.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact your TPM.",
        )

    expires_delta = (
        timedelta(days=REMEMBER_ME_DAYS)
        if payload.remember_me
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    token = create_access_token(
        user.id,
        extra_claims={"role": str(user.role), "username": user.username},
        expires_delta=expires_delta,
    )

    audit_service.record(
        db,
        entity_type=AuditEntity.USER,
        action=AuditAction.LOGIN,
        entity_id=user.id,
        description=f"{user.name} signed in",
        actor=user,
    )
    db.commit()

    return Token(
        access_token=token,
        expires_in=int(expires_delta.total_seconds()),
        user=UserRead.model_validate(user),
    )


@router.get("/me", response_model=UserRead, summary="Current authenticated user")
def read_me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post("/change-password", response_model=Message, summary="Change your own password")
def change_password(
    payload: ChangePasswordRequest, current_user: CurrentUser, db: DbSession
) -> Message:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The new password must differ from the current one",
        )

    user_crud.set_password(db, current_user, payload.new_password)
    audit_service.record(
        db,
        entity_type=AuditEntity.USER,
        action=AuditAction.PASSWORD_RESET,
        entity_id=current_user.id,
        description=f"{current_user.name} changed their own password",
        actor=current_user,
    )
    db.commit()
    return Message(detail="Password updated successfully")
