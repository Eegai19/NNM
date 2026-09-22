"""HTTP error helpers used across routers."""
from __future__ import annotations

from typing import NoReturn

from fastapi import HTTPException, status


def not_found(resource: str, identifier: object = None) -> NoReturn:
    suffix = f" with id {identifier}" if identifier is not None else ""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource}{suffix} was not found"
    )


def conflict(message: str) -> NoReturn:
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def bad_request(message: str) -> NoReturn:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def forbidden(message: str) -> NoReturn:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def unprocessable(message: str) -> NoReturn:
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)
