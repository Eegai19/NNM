"""Password hashing and JWT helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from app.core.config import settings

# bcrypt refuses inputs longer than 72 bytes; truncate defensively.
_BCRYPT_MAX_BYTES = 72


def _prepare(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Return a salted bcrypt hash for ``password``."""
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Constant-time comparison of a plaintext password against its hash."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(_prepare(plain_password), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(
    subject: str | int,
    *,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT for ``subject`` (the user id)."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode a JWT, returning ``None`` when it is invalid or expired."""
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except (ExpiredSignatureError, InvalidTokenError):
        return None
