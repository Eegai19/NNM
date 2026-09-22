"""Product, circle and activity-master schemas."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=120)
    is_active: bool = True


class ProductUpdate(BaseModel):
    product_name: str | None = Field(None, min_length=1, max_length=120)
    is_active: bool | None = None


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_name: str
    is_active: bool


class CircleCreate(BaseModel):
    circle_name: str = Field(..., min_length=1, max_length=120)
    is_active: bool = True


class CircleUpdate(BaseModel):
    circle_name: str | None = Field(None, min_length=1, max_length=120)
    is_active: bool | None = None


class CircleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    circle_name: str
    is_active: bool


class ActivityMasterCreate(BaseModel):
    activity_name: str = Field(..., min_length=1, max_length=160)
    description: str | None = None
    is_active: bool = True


class ActivityMasterUpdate(BaseModel):
    activity_name: str | None = Field(None, min_length=1, max_length=160)
    description: str | None = None
    is_active: bool | None = None


class ActivityMasterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activity_name: str
    description: str | None = None
    is_active: bool
