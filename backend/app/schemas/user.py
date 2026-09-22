"""User schemas."""
from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import UserRole

_USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,64}$")
_MOBILE_RE = re.compile(r"^[0-9+\-\s]{6,20}$")


class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    username: str = Field(..., min_length=3, max_length=64)
    mobile_number: str | None = Field(None, max_length=20)
    role: UserRole = UserRole.ENGINEER

    @field_validator("username")
    @classmethod
    def _validate_username(cls, value: str) -> str:
        value = value.strip().lower()
        if not _USERNAME_RE.match(value):
            raise ValueError(
                "Username must be 3-64 characters using letters, digits, dot, dash or underscore"
            )
        return value

    @field_validator("mobile_number")
    @classmethod
    def _validate_mobile(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        value = value.strip()
        if not _MOBILE_RE.match(value):
            raise ValueError("Mobile number must contain 6-20 digits")
        return value


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    is_active: bool = True


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=120)
    mobile_number: str | None = Field(None, max_length=20)
    role: UserRole | None = None
    is_active: bool | None = None

    @field_validator("mobile_number")
    @classmethod
    def _validate_mobile(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        value = value.strip()
        if not _MOBILE_RE.match(value):
            raise ValueError("Mobile number must contain 6-20 digits")
        return value


class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    username: str
    mobile_number: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime


class UserBrief(BaseModel):
    """Compact representation embedded in node / activity payloads."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    username: str
    role: UserRole
