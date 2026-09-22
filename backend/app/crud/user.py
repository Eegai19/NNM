"""User persistence."""
from __future__ import annotations

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_username(db: Session, username: str) -> User | None:
    return db.execute(
        select(User).where(func.lower(User.username) == username.strip().lower())
    ).scalar_one_or_none()


def build_query(
    db: Session,
    *,
    search: str | None = None,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> Select[tuple[User]]:
    stmt = select(User)
    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.name).like(pattern),
                func.lower(User.username).like(pattern),
                func.lower(func.coalesce(User.mobile_number, "")).like(pattern),
            )
        )
    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    return stmt.order_by(User.name.asc())


def create(db: Session, payload: UserCreate) -> User:
    user = User(
        name=payload.name.strip(),
        username=payload.username,
        password_hash=hash_password(payload.password),
        mobile_number=payload.mobile_number,
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.flush()
    return user


def update(db: Session, user: User, payload: UserUpdate) -> User:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(user, field, value.strip() if isinstance(value, str) else value)
    db.flush()
    return user


def set_password(db: Session, user: User, new_password: str) -> User:
    user.password_hash = hash_password(new_password)
    db.flush()
    return user


def delete(db: Session, user: User) -> None:
    db.delete(user)
    db.flush()
