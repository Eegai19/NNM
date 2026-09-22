"""Physical file storage for activity logs.

Files are written under ``settings.storage_dir`` in a per-activity folder with a
random prefix, so two uploads of ``report.pdf`` never collide and the original
file name stays readable in the UI.
"""
from __future__ import annotations

import re
import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

#: Extensions accepted by the activity log uploader.
ALLOWED_EXTENSIONS: frozenset[str] = frozenset(
    {".pdf", ".zip", ".txt", ".xlsx", ".csv", ".png", ".jpg", ".jpeg"}
)

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
_CHUNK_SIZE = 1024 * 1024  # 1 MiB


def sanitize_filename(file_name: str) -> str:
    """Strip directory components and unsafe characters from an upload name."""
    base = Path(file_name or "").name
    cleaned = _SAFE_NAME_RE.sub("_", base).strip("._") or "upload"
    return cleaned[:200]


def validate_extension(file_name: str) -> str:
    """Return the lower-cased extension, rejecting unsupported types."""
    extension = Path(file_name or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ext.lstrip(".") for ext in ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{extension or 'unknown'}'. Allowed types: {allowed}",
        )
    return extension


def activity_dir(activity_id: int) -> Path:
    path = Path(settings.storage_dir) / f"activity_{activity_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(upload: UploadFile, activity_id: int) -> tuple[str, str, int]:
    """Persist ``upload`` to disk.

    Returns ``(display_name, relative_path, size_in_bytes)``. The stored path is
    relative to the storage root so the database stays portable across machines.
    """
    display_name = sanitize_filename(upload.filename or "upload")
    validate_extension(display_name)

    target_dir = activity_dir(activity_id)
    stored_name = f"{uuid.uuid4().hex}_{display_name}"
    destination = target_dir / stored_name

    size = 0
    max_bytes = settings.max_upload_size_bytes
    try:
        with destination.open("wb") as buffer:
            while chunk := upload.file.read(_CHUNK_SIZE):
                size += len(chunk)
                if size > max_bytes:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the {settings.max_upload_size_mb} MB limit",
                    )
                buffer.write(chunk)
    finally:
        upload.file.close()

    if size == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty"
        )

    relative_path = str(destination.relative_to(Path(settings.storage_dir)))
    return display_name, relative_path, size


def absolute_path(relative_path: str) -> Path:
    """Resolve a stored path, refusing anything that escapes the storage root."""
    root = Path(settings.storage_dir).resolve()
    candidate = (root / relative_path).resolve()
    if not candidate.is_relative_to(root):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
        )
    return candidate


def delete_file(relative_path: str) -> None:
    """Remove a stored file; a missing file is not an error."""
    try:
        absolute_path(relative_path).unlink(missing_ok=True)
    except HTTPException:  # pragma: no cover - already-invalid path
        return


def purge_activity_files(activity_id: int) -> None:
    """Delete the whole folder for an activity (used when the activity is removed)."""
    path = Path(settings.storage_dir) / f"activity_{activity_id}"
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
