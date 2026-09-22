"""Shared schema helpers."""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Message(BaseModel):
    """Generic acknowledgement payload."""

    detail: str


class Page(BaseModel, Generic[T]):
    """Envelope returned by every paginated list endpoint."""

    items: list[T]
    total: int = Field(..., description="Total rows matching the filter")
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    pages: int = Field(..., ge=0, description="Total number of pages")

    @classmethod
    def build(cls, items: list[T], total: int, page: int, page_size: int) -> "Page[T]":
        pages = (total + page_size - 1) // page_size if page_size else 0
        return cls(items=items, total=total, page=page, page_size=page_size, pages=pages)


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=200)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
