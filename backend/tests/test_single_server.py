"""Serving the SPA and the API from one process on one port."""
from __future__ import annotations

import importlib
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.frontend import API_PREFIXES, mount_frontend


@pytest.fixture()
def dist(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A minimal Vite-shaped build directory."""
    build = tmp_path / "dist"
    (build / "assets").mkdir(parents=True)
    (build / "index.html").write_text("<!doctype html><title>NNM</title>", encoding="utf-8")
    (build / "assets" / "index-abc123.js").write_text("console.log(1)", encoding="utf-8")
    (build / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    monkeypatch.setattr(settings, "frontend_dist_dir", build)
    return build


@pytest.fixture()
def bundled(dist: Path) -> Iterator[TestClient]:
    """An app with the frontend mounted, plus a stand-in API route."""
    app = FastAPI()

    @app.get("/api/ping")
    def ping() -> dict[str, str]:
        return {"pong": "yes"}

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "healthy"}

    assert mount_frontend(app) is True
    with TestClient(app) as client:
        yield client


def test_serves_frontend_flag_follows_the_build(dist: Path) -> None:
    assert settings.serves_frontend is True
    (dist / "index.html").unlink()
    assert settings.serves_frontend is False


def test_mount_is_a_no_op_without_a_build(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "frontend_dist_dir", tmp_path / "missing")
    assert mount_frontend(FastAPI()) is False


def test_root_serves_the_spa_shell(bundled: TestClient) -> None:
    response = bundled.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "NNM" in response.text


def test_client_side_routes_fall_back_to_the_shell(bundled: TestClient) -> None:
    """Deep links must work on a hard refresh, not 404."""
    for route in ("/dashboard", "/nodes", "/nodes/42", "/users", "/a/deep/unknown/route"):
        response = bundled.get(route)
        assert response.status_code == 200, route
        assert "NNM" in response.text, route


def test_api_routes_still_win(bundled: TestClient) -> None:
    response = bundled.get("/api/ping")
    assert response.status_code == 200
    assert response.json() == {"pong": "yes"}


def test_unknown_api_routes_return_json_not_html(bundled: TestClient) -> None:
    """The fallback must not swallow a mistyped API path."""
    response = bundled.get("/api/does-not-exist")
    assert response.status_code == 404
    assert "text/html" not in response.headers.get("content-type", "")


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_reserved_prefixes_are_never_answered_with_html(
    bundled: TestClient, prefix: str
) -> None:
    response = bundled.get(f"/{prefix}/definitely-not-a-page")
    assert "text/html" not in response.headers.get("content-type", "")


def test_health_is_not_shadowed(bundled: TestClient) -> None:
    assert bundled.get("/health").json()["status"] == "healthy"


def test_static_files_are_served(bundled: TestClient) -> None:
    response = bundled.get("/assets/index-abc123.js")
    assert response.status_code == 200
    assert "console.log" in response.text


def test_hashed_assets_are_cached_but_the_shell_is_not(bundled: TestClient) -> None:
    asset = bundled.get("/assets/index-abc123.js")
    assert "immutable" in asset.headers.get("cache-control", "")

    shell = bundled.get("/dashboard")
    assert shell.headers.get("cache-control") == "no-cache"


def test_root_level_files_are_served(bundled: TestClient) -> None:
    response = bundled.get("/favicon.svg")
    assert response.status_code == 200
    assert "svg" in response.text


def test_path_traversal_cannot_escape_the_build(bundled: TestClient, dist: Path) -> None:
    secret = dist.parent / "secret.txt"
    secret.write_text("do not serve me", encoding="utf-8")

    for attempt in ("/../secret.txt", "/assets/../../secret.txt", "/%2e%2e/secret.txt"):
        response = bundled.get(attempt)
        assert "do not serve me" not in response.text, attempt
