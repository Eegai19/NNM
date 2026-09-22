"""Application configuration loaded from the environment."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Runtime settings. Every field can be overridden with an ``NNM_`` env var."""

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_prefix="NNM_",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application ---------------------------------------------------------
    project_name: str = "NNM - Nokia Node Manager"
    api_v1_prefix: str = "/api"
    environment: str = "development"
    debug: bool = True

    # Security ------------------------------------------------------------
    secret_key: str = "insecure-development-key-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # Database ------------------------------------------------------------
    database_url: str = f"sqlite:///{BASE_DIR / 'nnm.db'}"

    # Bundled frontend ----------------------------------------------------
    #: Directory holding the built frontend. When it exists the API also serves
    #: the SPA, so the whole app runs as a single process on a single port.
    frontend_dist_dir: Path = BASE_DIR.parent / "frontend" / "dist"

    # File storage --------------------------------------------------------
    storage_dir: Path = BASE_DIR / "storage" / "activity_logs"
    max_upload_size_mb: int = 25

    # CORS ----------------------------------------------------------------
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ]

    # Bootstrap user ------------------------------------------------------
    first_tpm_username: str = "admin"
    first_tpm_password: str = "Admin@123"
    first_tpm_name: str = "System Administrator"
    first_tpm_mobile: str = "9000000000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Parse ``NNM_CORS_ORIGINS`` as a comma separated list, or as JSON.

        ``NoDecode`` on the field stops pydantic-settings from JSON-decoding the
        raw value first, which would reject the comma separated form that
        ``.env.example`` documents.
        """
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                try:
                    return json.loads(text)
                except ValueError:
                    pass
            return [origin.strip() for origin in text.split(",") if origin.strip()]
        return value

    @field_validator("storage_dir", "frontend_dist_dir", mode="before")
    @classmethod
    def _resolve_storage(cls, value: object) -> object:
        if isinstance(value, str):
            path = Path(value)
            return path if path.is_absolute() else (BASE_DIR / path).resolve()
        return value

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def serves_frontend(self) -> bool:
        """True when a built frontend is present next to the API."""
        return (Path(self.frontend_dist_dir) / "index.html").is_file()

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor so the env file is parsed only once."""
    return Settings()


settings = get_settings()
