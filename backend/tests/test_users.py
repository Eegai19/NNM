"""User management and master data endpoints."""
from __future__ import annotations

from fastapi.testclient import TestClient


def _create_user(client: TestClient, headers, **overrides) -> dict:
    payload = {
        "name": "New Engineer",
        "username": "new.engineer",
        "password": "Password@123",
        "mobile_number": "9876543210",
        "role": "ENGINEER",
    }
    payload.update(overrides)
    return client.post("/api/users", headers=headers, json=payload)


def test_tpm_creates_a_user(client: TestClient, tpm_headers) -> None:
    response = _create_user(client, tpm_headers)
    assert response.status_code == 201
    assert response.json()["username"] == "new.engineer"
    assert "password" not in response.json()


def test_duplicate_username_is_rejected(client: TestClient, tpm_headers) -> None:
    _create_user(client, tpm_headers)
    duplicate = _create_user(client, tpm_headers)
    assert duplicate.status_code == 409


def test_username_is_normalised_to_lowercase(client: TestClient, tpm_headers) -> None:
    response = _create_user(client, tpm_headers, username="MiXeD.Case")
    assert response.json()["username"] == "mixed.case"


def test_invalid_username_is_rejected(client: TestClient, tpm_headers) -> None:
    assert _create_user(client, tpm_headers, username="has spaces").status_code == 422


def test_short_password_is_rejected(client: TestClient, tpm_headers) -> None:
    assert _create_user(client, tpm_headers, password="short").status_code == 422


def test_created_user_can_sign_in(client: TestClient, tpm_headers) -> None:
    _create_user(client, tpm_headers)
    response = client.post(
        "/api/auth/login", json={"username": "new.engineer", "password": "Password@123"}
    )
    assert response.status_code == 200


def test_list_users_filters(client: TestClient, tpm_headers, engineer_user) -> None:
    page = client.get("/api/users?role=ENGINEER", headers=tpm_headers).json()
    assert page["total"] == 1
    assert page["items"][0]["username"] == "eegai"

    searched = client.get("/api/users?search=tina", headers=tpm_headers).json()
    assert searched["total"] == 1


def test_update_user(client: TestClient, tpm_headers, engineer_user) -> None:
    response = client.put(
        f"/api/users/{engineer_user.id}",
        headers=tpm_headers,
        json={"name": "Eegai Renamed", "role": "LEAD"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Eegai Renamed"
    assert response.json()["role"] == "LEAD"


def test_deactivate_and_reactivate_user(client: TestClient, tpm_headers, engineer_user) -> None:
    off = client.patch(
        f"/api/users/{engineer_user.id}/status?is_active=false", headers=tpm_headers
    )
    assert off.status_code == 200
    assert off.json()["is_active"] is False

    assert (
        client.post(
            "/api/auth/login", json={"username": "eegai", "password": "Password@123"}
        ).status_code
        == 403
    )

    on = client.patch(
        f"/api/users/{engineer_user.id}/status?is_active=true", headers=tpm_headers
    )
    assert on.json()["is_active"] is True


def test_tpm_cannot_deactivate_themselves(client: TestClient, tpm_headers, tpm_user) -> None:
    response = client.patch(
        f"/api/users/{tpm_user.id}/status?is_active=false", headers=tpm_headers
    )
    assert response.status_code == 400


def test_tpm_cannot_delete_themselves(client: TestClient, tpm_headers, tpm_user) -> None:
    assert client.delete(f"/api/users/{tpm_user.id}", headers=tpm_headers).status_code == 400


def test_reset_password(client: TestClient, tpm_headers, engineer_user) -> None:
    response = client.post(
        f"/api/users/{engineer_user.id}/reset-password",
        headers=tpm_headers,
        json={"new_password": "Reset@12345"},
    )
    assert response.status_code == 200
    assert (
        client.post(
            "/api/auth/login", json={"username": "eegai", "password": "Reset@12345"}
        ).status_code
        == 200
    )


def test_delete_user(client: TestClient, tpm_headers, engineer_user) -> None:
    assert client.delete(f"/api/users/{engineer_user.id}", headers=tpm_headers).status_code == 200
    assert client.get(f"/api/users/{engineer_user.id}", headers=tpm_headers).status_code == 404


def test_cannot_delete_a_user_still_owning_nodes(
    client: TestClient, db_session, tpm_headers, engineer_user, node
) -> None:
    node.owner_id = engineer_user.id
    db_session.commit()
    response = client.delete(f"/api/users/{engineer_user.id}", headers=tpm_headers)
    assert response.status_code == 409


def test_assignable_users_excludes_inactive(
    client: TestClient, db_session, tpm_headers, engineer_user, other_engineer
) -> None:
    other_engineer.is_active = False
    db_session.commit()
    usernames = {
        row["username"]
        for row in client.get("/api/users/assignable", headers=tpm_headers).json()
    }
    assert "eegai" in usernames
    assert "otto" not in usernames


# --- Master data -----------------------------------------------------------
def test_create_and_list_products(client: TestClient, tpm_headers) -> None:
    created = client.post(
        "/api/products", headers=tpm_headers, json={"product_name": "AirScale 4G"}
    )
    assert created.status_code == 201

    names = [row["product_name"] for row in client.get("/api/products", headers=tpm_headers).json()]
    assert "AirScale 4G" in names


def test_duplicate_product_is_rejected(client: TestClient, tpm_headers, product) -> None:
    response = client.post(
        "/api/products", headers=tpm_headers, json={"product_name": "airscale 5g"}
    )
    assert response.status_code == 409


def test_inactive_products_are_hidden_by_default(
    client: TestClient, db_session, tpm_headers, product
) -> None:
    product.is_active = False
    db_session.commit()
    assert client.get("/api/products", headers=tpm_headers).json() == []
    assert len(client.get("/api/products?include_inactive=true", headers=tpm_headers).json()) == 1


def test_lead_can_manage_catalogue_but_not_delete(
    client: TestClient, lead_headers, circle
) -> None:
    created = client.post("/api/circles", headers=lead_headers, json={"circle_name": "KA"})
    assert created.status_code == 201
    assert (
        client.delete(f"/api/circles/{created.json()['id']}", headers=lead_headers).status_code
        == 403
    )


def test_cannot_delete_a_circle_in_use(client: TestClient, tpm_headers, node, circle) -> None:
    assert client.delete(f"/api/circles/{circle.id}", headers=tpm_headers).status_code == 409


def test_activity_master_crud(client: TestClient, tpm_headers) -> None:
    created = client.post(
        "/api/activity-masters",
        headers=tpm_headers,
        json={"activity_name": "Drive Test", "description": "Field verification"},
    )
    assert created.status_code == 201
    master_id = created.json()["id"]

    updated = client.put(
        f"/api/activity-masters/{master_id}",
        headers=tpm_headers,
        json={"description": "Updated description"},
    )
    assert updated.json()["description"] == "Updated description"

    assert (
        client.delete(f"/api/activity-masters/{master_id}", headers=tpm_headers).status_code == 200
    )


def test_cannot_delete_an_activity_already_attached(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    client.post(
        f"/api/nodes/{node.id}/activities",
        headers=tpm_headers,
        json={"activity_master_id": activity_master.id},
    )
    response = client.delete(f"/api/activity-masters/{activity_master.id}", headers=tpm_headers)
    assert response.status_code == 409
