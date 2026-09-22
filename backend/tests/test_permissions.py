"""Role and node-level permission matrix."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.permissions import can_modify_node
from app.models import AssignmentRole, Node, NodeAssignment, User


def _assign(db, node: Node, user: User, role: AssignmentRole) -> None:
    db.add(NodeAssignment(node_id=node.id, user_id=user.id, role=role))
    db.commit()


def test_tpm_can_modify_any_node(db_session, tpm_user: User, node: Node) -> None:
    assert can_modify_node(db_session, tpm_user, node.id)


def test_lead_can_modify_any_node(db_session, lead_user: User, node: Node) -> None:
    assert can_modify_node(db_session, lead_user, node.id)


def test_unassigned_engineer_cannot_modify(db_session, engineer_user: User, node: Node) -> None:
    assert not can_modify_node(db_session, engineer_user, node.id)


def test_assigned_engineer_can_modify_for_every_assignment_role(
    db_session, engineer_user: User, node: Node
) -> None:
    for role in AssignmentRole:
        db_session.query(NodeAssignment).delete()
        db_session.commit()
        _assign(db_session, node, engineer_user, role)
        assert can_modify_node(db_session, engineer_user, node.id), role


def test_deactivated_admin_loses_modify_access(db_session, lead_user: User, node: Node) -> None:
    lead_user.is_active = False
    db_session.commit()
    assert not can_modify_node(db_session, lead_user, node.id)


def test_assignment_on_another_node_does_not_grant_access(
    db_session, engineer_user: User, node: Node, product, circle
) -> None:
    other = Node(node_name="TN-NOK-9999", product_id=product.id, circle_id=circle.id)
    db_session.add(other)
    db_session.commit()
    _assign(db_session, other, engineer_user, AssignmentRole.PRIMARY_OWNER)
    assert can_modify_node(db_session, engineer_user, other.id)
    assert not can_modify_node(db_session, engineer_user, node.id)


# --- HTTP-level checks -----------------------------------------------------
def test_engineer_cannot_create_a_node(
    client: TestClient, engineer_headers, product, circle
) -> None:
    response = client.post(
        "/api/nodes",
        headers=engineer_headers,
        json={"node_name": "TN-NOK-2000", "product_id": product.id, "circle_id": circle.id},
    )
    assert response.status_code == 403


def test_lead_can_create_a_node(client: TestClient, lead_headers, product, circle) -> None:
    response = client.post(
        "/api/nodes",
        headers=lead_headers,
        json={"node_name": "TN-NOK-2001", "product_id": product.id, "circle_id": circle.id},
    )
    assert response.status_code == 201


def test_lead_cannot_delete_a_node(client: TestClient, lead_headers, node: Node) -> None:
    assert client.delete(f"/api/nodes/{node.id}", headers=lead_headers).status_code == 403


def test_tpm_can_delete_a_node(client: TestClient, tpm_headers, node: Node) -> None:
    assert client.delete(f"/api/nodes/{node.id}", headers=tpm_headers).status_code == 200


def test_lead_cannot_create_users(client: TestClient, lead_headers) -> None:
    response = client.post(
        "/api/users",
        headers=lead_headers,
        json={
            "name": "New Person",
            "username": "newperson",
            "password": "Password@123",
            "role": "ENGINEER",
        },
    )
    assert response.status_code == 403


def test_engineer_cannot_manage_users(client: TestClient, engineer_headers) -> None:
    response = client.post(
        "/api/users",
        headers=engineer_headers,
        json={
            "name": "New Person",
            "username": "newperson2",
            "password": "Password@123",
            "role": "ENGINEER",
        },
    )
    assert response.status_code == 403


def test_engineer_reads_nodes_but_cannot_edit(
    client: TestClient, db_session, engineer_headers, engineer_user, node: Node
) -> None:
    assert client.get("/api/nodes", headers=engineer_headers).status_code == 200

    blocked = client.put(
        f"/api/nodes/{node.id}", headers=engineer_headers, json={"node_name": "RENAMED"}
    )
    assert blocked.status_code == 403

    _assign(db_session, node, engineer_user, AssignmentRole.SUPPORT_ENGINEER)
    allowed = client.put(
        f"/api/nodes/{node.id}", headers=engineer_headers, json={"node_name": "RENAMED"}
    )
    assert allowed.status_code == 200
    assert allowed.json()["node_name"] == "RENAMED"


def test_can_modify_endpoint_reflects_assignment(
    client: TestClient, db_session, engineer_headers, engineer_user, node: Node
) -> None:
    before = client.get(f"/api/nodes/{node.id}/can-modify", headers=engineer_headers).json()
    assert before["can_modify"] is False

    _assign(db_session, node, engineer_user, AssignmentRole.PRIMARY_OWNER)
    after = client.get(f"/api/nodes/{node.id}/can-modify", headers=engineer_headers).json()
    assert after["can_modify"] is True


def test_engineer_cannot_assign_engineers(
    client: TestClient, engineer_headers, engineer_user, node: Node
) -> None:
    response = client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=engineer_headers,
        json={"user_id": engineer_user.id, "role": "SUPPORT_ENGINEER"},
    )
    assert response.status_code == 403


def test_engineer_cannot_read_the_audit_trail(client: TestClient, engineer_headers) -> None:
    assert client.get("/api/audit", headers=engineer_headers).status_code == 403
