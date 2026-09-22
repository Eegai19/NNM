"""Settings parsing, including the .env file paths the README documents."""
from __future__ import annotations

from pathlib import Path

from app.core.config import Settings


def _write_env(tmp_path: Path, body: str) -> Path:
    env_file = tmp_path / ".env"
    env_file.write_text(body, encoding="utf-8")
    return env_file


def test_defaults_load_without_an_env_file() -> None:
    settings = Settings(_env_file=None)
    assert settings.cors_origins
    assert settings.is_sqlite
    assert settings.max_upload_size_bytes == settings.max_upload_size_mb * 1024 * 1024


def test_comma_separated_cors_origins_from_env_file(tmp_path: Path) -> None:
    """The documented `.env` format is comma separated, not JSON."""
    env_file = _write_env(
        tmp_path,
        "NNM_CORS_ORIGINS=http://localhost:5173,http://nnm.example.com\n",
    )
    settings = Settings(_env_file=str(env_file))
    assert settings.cors_origins == ["http://localhost:5173", "http://nnm.example.com"]


def test_comma_separated_cors_origins_from_environment(monkeypatch) -> None:
    monkeypatch.setenv("NNM_CORS_ORIGINS", "http://a.test, http://b.test ,")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://a.test", "http://b.test"]


def test_json_list_is_still_accepted(tmp_path: Path) -> None:
    env_file = _write_env(tmp_path, 'NNM_CORS_ORIGINS=["http://a.test","http://b.test"]\n')
    settings = Settings(_env_file=str(env_file))
    assert settings.cors_origins == ["http://a.test", "http://b.test"]


def test_shipped_env_example_parses() -> None:
    """The committed .env.example must work verbatim -- the README says to copy it."""
    example = Path(__file__).resolve().parent.parent / ".env.example"
    settings = Settings(_env_file=str(example))
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]
    assert settings.project_name == "NNM - Nokia Node Manager"
    assert settings.access_token_expire_minutes == 480


def test_relative_storage_dir_is_resolved(tmp_path: Path) -> None:
    env_file = _write_env(tmp_path, "NNM_STORAGE_DIR=./storage/activity_logs\n")
    settings = Settings(_env_file=str(env_file))
    assert settings.storage_dir.is_absolute()
