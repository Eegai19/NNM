"""Authentication and JWT handling."""
from __future__ import annotations

from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password, verify_password
from app.models import User


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("Password@123")
    assert hashed != "Password@123"
    assert verify_password("Password@123", hashed)
    assert not verify_password("wrong-password", hashed)


def test_login_returns_token_and_user(client: TestClient, tpm_user: User) -> None:
    response = client.post(
        "/api/auth/login", json={"username": "tina.tpm", "password": "Password@123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "TPM"
    assert body["expires_in"] > 0


def test_login_with_wrong_password_is_rejected(client: TestClient, tpm_user: User) -> None:
    response = client.post(
        "/api/auth/login", json={"username": "tina.tpm", "password": "nope"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_login_with_unknown_user_gives_same_message(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "ghost", "password": "nope"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_remember_me_extends_token_lifetime(client: TestClient, tpm_user: User) -> None:
    short = client.post(
        "/api/auth/login", json={"username": "tina.tpm", "password": "Password@123"}
    ).json()["expires_in"]
    long = client.post(
        "/api/auth/login",
        json={"username": "tina.tpm", "password": "Password@123", "remember_me": True},
    ).json()["expires_in"]
    assert long > short


def test_deactivated_user_cannot_log_in(client: TestClient, db_session, tpm_user: User) -> None:
    tpm_user.is_active = False
    db_session.commit()
    response = client.post(
        "/api/auth/login", json={"username": "tina.tpm", "password": "Password@123"}
    )
    assert response.status_code == 403


def test_me_requires_a_token(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_me_returns_the_current_user(
    client: TestClient, engineer_headers: dict[str, str]
) -> None:
    response = client.get("/api/auth/me", headers=engineer_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "eegai"


def test_expired_token_is_rejected(client: TestClient, tpm_user: User) -> None:
    expired = create_access_token(tpm_user.id, expires_delta=timedelta(seconds=-10))
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_garbage_token_is_rejected(client: TestClient) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_change_password(client: TestClient, engineer_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/auth/change-password",
        headers=engineer_headers,
        json={"current_password": "Password@123", "new_password": "BrandNew@456"},
    )
    assert response.status_code == 200

    assert (
        client.post(
            "/api/auth/login", json={"username": "eegai", "password": "BrandNew@456"}
        ).status_code
        == 200
    )


def test_change_password_rejects_wrong_current(
    client: TestClient, engineer_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/auth/change-password",
        headers=engineer_headers,
        json={"current_password": "wrong", "new_password": "BrandNew@456"},
    )
    assert response.status_code == 400


def test_health_endpoint(client: TestClient) -> None:
    assert client.get("/health").json()["status"] == "healthy"
