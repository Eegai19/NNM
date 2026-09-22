"""Node CRUD, validation and assignment endpoints."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.models import Node


def _create(client: TestClient, headers, product, circle, name="TN-NOK-3000", **extra):
    payload = {"node_name": name, "product_id": product.id, "circle_id": circle.id}
    payload.update(extra)
    return client.post("/api/nodes", headers=headers, json=payload)


def test_create_node(client: TestClient, tpm_headers, product, circle) -> None:
    response = _create(client, tpm_headers, product, circle)
    assert response.status_code == 201
    body = response.json()
    assert body["node_name"] == "TN-NOK-3000"
    assert body["deployment_state"] == "PLANNED"
    assert body["overall_status"] == "NOT_STARTED"
    assert body["product"]["product_name"] == "AirScale 5G"


def test_duplicate_node_name_is_rejected(client: TestClient, tpm_headers, product, circle) -> None:
    assert _create(client, tpm_headers, product, circle).status_code == 201
    duplicate = _create(client, tpm_headers, product, circle)
    assert duplicate.status_code == 409
    assert "already exists" in duplicate.json()["detail"]


def test_duplicate_node_name_is_case_insensitive(
    client: TestClient, tpm_headers, product, circle
) -> None:
    _create(client, tpm_headers, product, circle, name="TN-NOK-4000")
    assert _create(client, tpm_headers, product, circle, name="tn-nok-4000").status_code == 409


def test_unknown_product_is_rejected(client: TestClient, tpm_headers, circle) -> None:
    response = client.post(
        "/api/nodes",
        headers=tpm_headers,
        json={"node_name": "TN-NOK-5000", "product_id": 999, "circle_id": circle.id},
    )
    assert response.status_code == 404


def test_inactive_circle_is_rejected(
    client: TestClient, db_session, tpm_headers, product, circle
) -> None:
    circle.is_active = False
    db_session.commit()
    response = _create(client, tpm_headers, product, circle, name="TN-NOK-5001")
    assert response.status_code == 400
    assert "inactive" in response.json()["detail"]


def test_blank_node_name_fails_validation(client: TestClient, tpm_headers, product, circle) -> None:
    response = client.post(
        "/api/nodes",
        headers=tpm_headers,
        json={"node_name": "  ", "product_id": product.id, "circle_id": circle.id},
    )
    assert response.status_code == 422


def test_list_nodes_paginates(client: TestClient, tpm_headers, product, circle) -> None:
    for index in range(7):
        _create(client, tpm_headers, product, circle, name=f"TN-NOK-60{index}")

    page = client.get("/api/nodes?page=1&page_size=5", headers=tpm_headers).json()
    assert page["total"] == 7
    assert page["pages"] == 2
    assert len(page["items"]) == 5

    second = client.get("/api/nodes?page=2&page_size=5", headers=tpm_headers).json()
    assert len(second["items"]) == 2


def test_list_nodes_search_and_filter(client: TestClient, tpm_headers, product, circle) -> None:
    _create(client, tpm_headers, product, circle, name="KA-NOK-7001")
    _create(client, tpm_headers, product, circle, name="TN-NOK-7002")

    hits = client.get("/api/nodes?search=KA-NOK", headers=tpm_headers).json()
    assert hits["total"] == 1
    assert hits["items"][0]["node_name"] == "KA-NOK-7001"

    by_circle = client.get(f"/api/nodes?circle_id={circle.id}", headers=tpm_headers).json()
    assert by_circle["total"] == 2

    by_state = client.get("/api/nodes?deployment_state=LIVE", headers=tpm_headers).json()
    assert by_state["total"] == 0


def test_read_node_includes_activity_counters(
    client: TestClient, tpm_headers, node: Node, activity_master
) -> None:
    client.post(
        f"/api/nodes/{node.id}/activities",
        headers=tpm_headers,
        json={"activity_master_id": activity_master.id},
    )
    body = client.get(f"/api/nodes/{node.id}", headers=tpm_headers).json()
    assert body["total_activities"] == 1
    assert body["pending_activities"] == 1


def test_read_missing_node_returns_404(client: TestClient, tpm_headers) -> None:
    assert client.get("/api/nodes/4242", headers=tpm_headers).status_code == 404


def test_update_node(client: TestClient, tpm_headers, node: Node) -> None:
    response = client.put(
        f"/api/nodes/{node.id}",
        headers=tpm_headers,
        json={"deployment_state": "INTEGRATION", "node_name": "TN-NOK-1001-A"},
    )
    assert response.status_code == 200
    assert response.json()["deployment_state"] == "INTEGRATION"
    assert response.json()["node_name"] == "TN-NOK-1001-A"


def test_delete_node_removes_it(client: TestClient, tpm_headers, node: Node) -> None:
    assert client.delete(f"/api/nodes/{node.id}", headers=tpm_headers).status_code == 200
    assert client.get(f"/api/nodes/{node.id}", headers=tpm_headers).status_code == 404


# --- Assignments -----------------------------------------------------------
def test_assign_engineer(client: TestClient, tpm_headers, node: Node, engineer_user) -> None:
    response = client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "PRIMARY_OWNER"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "PRIMARY_OWNER"
    assert body["user"]["username"] == "eegai"


def test_duplicate_assignment_is_rejected(
    client: TestClient, tpm_headers, node: Node, engineer_user
) -> None:
    client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "PRIMARY_OWNER"},
    )
    duplicate = client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "SUPPORT_ENGINEER"},
    )
    assert duplicate.status_code == 409
    assert "already assigned" in duplicate.json()["detail"]


def test_second_primary_owner_is_rejected(
    client: TestClient, tpm_headers, node: Node, engineer_user, other_engineer
) -> None:
    client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "PRIMARY_OWNER"},
    )
    response = client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": other_engineer.id, "role": "PRIMARY_OWNER"},
    )
    assert response.status_code == 409


def test_multiple_support_engineers_are_allowed(
    client: TestClient, tpm_headers, node: Node, engineer_user, other_engineer
) -> None:
    first = client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "SUPPORT_ENGINEER"},
    )
    second = client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": other_engineer.id, "role": "SUPPORT_ENGINEER"},
    )
    assert (first.status_code, second.status_code) == (201, 201)


def test_remove_assignment(client: TestClient, tpm_headers, node: Node, engineer_user) -> None:
    created = client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "SUPPORT_ENGINEER"},
    ).json()

    assert (
        client.delete(
            f"/api/nodes/{node.id}/assignments/{created['id']}", headers=tpm_headers
        ).status_code
        == 200
    )
    remaining = client.get(f"/api/nodes/{node.id}/assignments", headers=tpm_headers).json()
    assert remaining == []


def test_assigning_a_deactivated_user_is_rejected(
    client: TestClient, db_session, tpm_headers, node: Node, engineer_user
) -> None:
    engineer_user.is_active = False
    db_session.commit()
    response = client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "SUPPORT_ENGINEER"},
    )
    assert response.status_code == 400


def test_mine_filter_returns_only_assigned_nodes(
    client: TestClient, tpm_headers, engineer_headers, node: Node, engineer_user, product, circle
) -> None:
    _create(client, tpm_headers, product, circle, name="TN-NOK-8888")
    client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "SUPPORT_ENGINEER"},
    )
    mine = client.get("/api/nodes?mine=true", headers=engineer_headers).json()
    assert mine["total"] == 1
    assert mine["items"][0]["id"] == node.id
