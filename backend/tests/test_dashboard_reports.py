"""Dashboard aggregations, global search, exports and the audit trail."""
from __future__ import annotations

import io
from zipfile import ZipFile

from fastapi.testclient import TestClient

from app.models import AssignmentRole, Node, NodeAssignment


def _seed(client: TestClient, tpm_headers, node, activity_master) -> dict:
    return client.post(
        f"/api/nodes/{node.id}/activities",
        headers=tpm_headers,
        json={"activity_master_id": activity_master.id},
    ).json()


# --- Dashboard -------------------------------------------------------------
def test_dashboard_summary_shape(client: TestClient, tpm_headers) -> None:
    body = client.get("/api/dashboard/summary", headers=tpm_headers).json()
    for key in (
        "total_nodes",
        "pending_activities",
        "in_progress_activities",
        "completed_activities",
    ):
        assert key in body
        assert body[key] == 0


def test_dashboard_summary_counts(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _seed(client, tpm_headers, node, activity_master)
    body = client.get("/api/dashboard/summary", headers=tpm_headers).json()
    assert body["total_nodes"] == 1
    assert body["pending_activities"] == 1

    client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "In Progress"}
    )
    body = client.get("/api/dashboard/summary", headers=tpm_headers).json()
    assert body["in_progress_activities"] == 1
    assert body["pending_activities"] == 0


def test_circle_summary(client: TestClient, tpm_headers, node, circle) -> None:
    body = client.get("/api/dashboard/circle-summary", headers=tpm_headers).json()
    assert {"circle": "TN", "count": 1} in body


def test_engineer_workload(
    client: TestClient, db_session, tpm_headers, node: Node, engineer_user
) -> None:
    db_session.add(
        NodeAssignment(
            node_id=node.id, user_id=engineer_user.id, role=AssignmentRole.PRIMARY_OWNER
        )
    )
    db_session.commit()

    body = client.get("/api/dashboard/engineer-workload", headers=tpm_headers).json()
    entry = next(row for row in body if row["engineer"] == "Eegai Engineer")
    assert entry["assigned_nodes"] == 1
    assert entry["activities"] == 0


def test_status_breakdown(client: TestClient, tpm_headers, node) -> None:
    body = client.get("/api/dashboard/status-breakdown", headers=tpm_headers).json()
    assert {"status": "PLANNED", "count": 1} in body


def test_dashboard_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/dashboard/summary").status_code == 401


def test_engineer_may_read_the_dashboard(client: TestClient, engineer_headers) -> None:
    assert client.get("/api/dashboard/summary", headers=engineer_headers).status_code == 200


# --- Search ----------------------------------------------------------------
def test_search_finds_nodes_activities_and_people(
    client: TestClient, tpm_headers, node, activity_master, engineer_user
) -> None:
    _seed(client, tpm_headers, node, activity_master)

    nodes = client.get("/api/search?q=TN-NOK", headers=tpm_headers).json()
    assert nodes["nodes"]["total"] == 1
    assert nodes["nodes"]["items"][0]["url"] == f"/nodes/{node.id}"

    activities = client.get("/api/search?q=integration", headers=tpm_headers).json()
    assert activities["activities"]["total"] == 1

    people = client.get("/api/search?q=eegai", headers=tpm_headers).json()
    assert people["engineers"]["total"] == 1

    circles = client.get("/api/search?q=TN", headers=tpm_headers).json()
    assert circles["circles"]["total"] == 1

    products = client.get("/api/search?q=airscale", headers=tpm_headers).json()
    assert products["products"]["total"] == 1


def test_search_paginates(client: TestClient, tpm_headers, product, circle) -> None:
    for index in range(5):
        client.post(
            "/api/nodes",
            headers=tpm_headers,
            json={
                "node_name": f"PAG-NOK-{index}",
                "product_id": product.id,
                "circle_id": circle.id,
            },
        )
    body = client.get("/api/search?q=PAG-NOK&page=1&page_size=2", headers=tpm_headers).json()
    assert body["nodes"]["total"] == 5
    assert body["nodes"]["pages"] == 3
    assert len(body["nodes"]["items"]) == 2


def test_empty_search_returns_nothing(client: TestClient, tpm_headers, node) -> None:
    body = client.get("/api/search?q=", headers=tpm_headers).json()
    assert body["total"] == 0


# --- Exports ---------------------------------------------------------------
def _is_xlsx(content: bytes) -> bool:
    with ZipFile(io.BytesIO(content)) as archive:
        return "xl/workbook.xml" in archive.namelist()


def test_export_nodes_xlsx(client: TestClient, tpm_headers, node) -> None:
    response = client.get("/api/exports/nodes.xlsx", headers=tpm_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument"
    )
    assert "nnm_nodes" in response.headers["content-disposition"]
    assert _is_xlsx(response.content)


def test_export_activities_xlsx(client: TestClient, tpm_headers, node, activity_master) -> None:
    _seed(client, tpm_headers, node, activity_master)
    response = client.get("/api/exports/activities.xlsx", headers=tpm_headers)
    assert response.status_code == 200
    assert _is_xlsx(response.content)


def test_export_respects_filters(client: TestClient, tpm_headers, node) -> None:
    response = client.get("/api/exports/nodes.xlsx?search=nothing-matches", headers=tpm_headers)
    assert response.status_code == 200
    assert _is_xlsx(response.content)


def test_export_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/exports/nodes.xlsx").status_code == 401


# --- Audit trail -----------------------------------------------------------
def test_audit_trail_records_node_lifecycle(
    client: TestClient, tpm_headers, product, circle
) -> None:
    created = client.post(
        "/api/nodes",
        headers=tpm_headers,
        json={"node_name": "AUD-NOK-1", "product_id": product.id, "circle_id": circle.id},
    ).json()
    client.put(
        f"/api/nodes/{created['id']}", headers=tpm_headers, json={"deployment_state": "LIVE"}
    )

    trail = client.get(f"/api/audit?node_id={created['id']}", headers=tpm_headers).json()
    actions = [row["action"] for row in trail["items"]]
    assert "CREATE" in actions
    assert "UPDATE" in actions
    assert all(row["performed_by_name"] == "Tina TPM" for row in trail["items"])


def test_audit_trail_records_assignment_and_upload(
    client: TestClient, tpm_headers, node, activity_master, engineer_user
) -> None:
    client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "PRIMARY_OWNER"},
    )
    activity = _seed(client, tpm_headers, node, activity_master)
    client.post(
        f"/api/activities/{activity['id']}/logs",
        headers=tpm_headers,
        files={"file": ("evidence.pdf", io.BytesIO(b"data"), "application/pdf")},
    )
    client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "Completed"}
    )

    trail = client.get(f"/api/audit?node_id={node.id}", headers=tpm_headers).json()
    actions = {row["action"] for row in trail["items"]}
    assert {"ASSIGN", "UPLOAD", "STATUS_CHANGE"} <= actions


def test_node_timeline_endpoint(client: TestClient, tpm_headers, node) -> None:
    client.put(f"/api/nodes/{node.id}", headers=tpm_headers, json={"overall_status": "BLOCKED"})
    timeline = client.get(f"/api/nodes/{node.id}/timeline", headers=tpm_headers).json()
    assert len(timeline) >= 1
    assert timeline[0]["node_id"] == node.id


def test_login_is_audited(client: TestClient, tpm_headers) -> None:
    trail = client.get("/api/audit?action=LOGIN", headers=tpm_headers).json()
    assert trail["total"] >= 1
