"""Reusable FastAPI dependencies: authentication, pagination and role guards."""
from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import can_manage_users, is_admin, is_tpm
from app.core.security import decode_access_token
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import PaginationParams

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Resolve the authenticated user from the ``Authorization: Bearer`` header."""
    if credentials is None or not credentials.credentials:
        raise CREDENTIALS_EXCEPTION

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    subject = payload.get("sub")
    if subject is None:
        raise CREDENTIALS_EXCEPTION

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise CREDENTIALS_EXCEPTION from None

    user = db.get(User, user_id)
    if user is None:
        raise CREDENTIALS_EXCEPTION
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated"
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Build a dependency that allows only the given roles."""

    def _dependency(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            allowed = ", ".join(str(role) for role in roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of the following roles: {allowed}",
            )
        return current_user

    return _dependency


def require_admin(current_user: CurrentUser) -> User:
    """TPM or LEAD."""
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires TPM or LEAD privileges",
        )
    return current_user


def require_tpm(current_user: CurrentUser) -> User:
    """TPM only."""
    if not is_tpm(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This action requires TPM privileges"
        )
    return current_user


def require_user_manager(current_user: CurrentUser) -> User:
    """User administration is TPM-only."""
    if not can_manage_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a TPM may manage user accounts",
        )
    return current_user


def pagination_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(20, ge=1, le=200, description="Rows per page"),
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)


AdminUser = Annotated[User, Depends(require_admin)]
TpmUser = Annotated[User, Depends(require_tpm)]
UserManager = Annotated[User, Depends(require_user_manager)]
Pagination = Annotated[PaginationParams, Depends(pagination_params)]
