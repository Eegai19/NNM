"""Node activities, the completion rule, and the activity log module."""
from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.models import ActivityStatus, Node, NodeActivity


def _attach(client: TestClient, headers, node: Node, master, **extra) -> dict:
    payload = {"activity_master_id": master.id}
    payload.update(extra)
    response = client.post(f"/api/nodes/{node.id}/activities", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _upload(client: TestClient, headers, activity_id: int, name="evidence.pdf") -> dict:
    return client.post(
        f"/api/activities/{activity_id}/logs",
        headers=headers,
        files={"file": (name, io.BytesIO(b"integration report contents"), "application/pdf")},
    ).json()


def test_attach_activity_to_node(client: TestClient, tpm_headers, node, activity_master) -> None:
    body = _attach(client, tpm_headers, node, activity_master)
    assert body["status"] == "Pending"
    assert body["activity_master"]["activity_name"] == "Integration"
    assert body["logs"] == []


def test_duplicate_activity_on_same_node_is_rejected(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    _attach(client, tpm_headers, node, activity_master)
    response = client.post(
        f"/api/nodes/{node.id}/activities",
        headers=tpm_headers,
        json={"activity_master_id": activity_master.id},
    )
    assert response.status_code == 409
    assert "already attached" in response.json()["detail"]


def test_activity_cannot_be_created_as_completed(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    response = client.post(
        f"/api/nodes/{node.id}/activities",
        headers=tpm_headers,
        json={"activity_master_id": activity_master.id, "status": "Completed"},
    )
    assert response.status_code == 400


# --- The completion rule ---------------------------------------------------
def test_completing_without_a_log_is_rejected(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    response = client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "Completed"}
    )
    assert response.status_code == 422
    assert "activity log" in response.json()["detail"]


def test_completing_after_uploading_a_log_succeeds(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    _upload(client, tpm_headers, activity["id"])

    response = client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "Completed"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Completed"
    assert body["completed_date"] is not None


def test_reopening_an_activity_clears_the_completed_date(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    _upload(client, tpm_headers, activity["id"])
    client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "Completed"}
    )

    reopened = client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "In Progress"}
    ).json()
    assert reopened["status"] == "In Progress"
    assert reopened["completed_date"] is None


def test_in_progress_sets_a_start_date(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    assert activity["start_date"] is None
    updated = client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "In Progress"}
    ).json()
    assert updated["start_date"] is not None


def test_node_overall_status_follows_its_activities(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    assert client.get(f"/api/nodes/{node.id}", headers=tpm_headers).json()["overall_status"] == (
        "NOT_STARTED"
    )

    _upload(client, tpm_headers, activity["id"])
    client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "Completed"}
    )
    assert client.get(f"/api/nodes/{node.id}", headers=tpm_headers).json()["overall_status"] == (
        "COMPLETED"
    )


# --- Activity logs ---------------------------------------------------------
def test_upload_and_list_logs(client: TestClient, tpm_headers, node, activity_master) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    log = _upload(client, tpm_headers, activity["id"], name="drive_test.csv")
    assert log["file_name"] == "drive_test.csv"
    assert log["file_size"] > 0
    assert log["uploader"]["username"] == "tina.tpm"

    logs = client.get(f"/api/activities/{activity['id']}/logs", headers=tpm_headers).json()
    assert len(logs) == 1


def test_unsupported_file_type_is_rejected(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    response = client.post(
        f"/api/activities/{activity['id']}/logs",
        headers=tpm_headers,
        files={"file": ("payload.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_every_supported_extension_is_accepted(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    for extension in ("pdf", "zip", "txt", "xlsx", "csv", "png", "jpg", "jpeg"):
        response = client.post(
            f"/api/activities/{activity['id']}/logs",
            headers=tpm_headers,
            files={"file": (f"evidence.{extension}", io.BytesIO(b"data"), "application/octet-stream")},
        )
        assert response.status_code == 201, extension


def test_empty_file_is_rejected(client: TestClient, tpm_headers, node, activity_master) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    response = client.post(
        f"/api/activities/{activity['id']}/logs",
        headers=tpm_headers,
        files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")},
    )
    assert response.status_code == 400


def test_download_returns_the_stored_bytes(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    log = _upload(client, tpm_headers, activity["id"])

    response = client.get(f"/api/activity-logs/{log['id']}/download", headers=tpm_headers)
    assert response.status_code == 200
    assert response.content == b"integration report contents"
    assert "attachment" in response.headers["content-disposition"]


def test_delete_log(client: TestClient, tpm_headers, node, activity_master) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    log = _upload(client, tpm_headers, activity["id"])

    assert client.delete(f"/api/activity-logs/{log['id']}", headers=tpm_headers).status_code == 200
    assert client.get(f"/api/activities/{activity['id']}/logs", headers=tpm_headers).json() == []


def test_cannot_delete_the_last_log_of_a_completed_activity(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    log = _upload(client, tpm_headers, activity["id"])
    client.put(
        f"/api/activities/{activity['id']}", headers=tpm_headers, json={"status": "Completed"}
    )

    response = client.delete(f"/api/activity-logs/{log['id']}", headers=tpm_headers)
    assert response.status_code == 422


def test_unassigned_engineer_cannot_upload(
    client: TestClient, tpm_headers, engineer_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    response = client.post(
        f"/api/activities/{activity['id']}/logs",
        headers=engineer_headers,
        files={"file": ("evidence.pdf", io.BytesIO(b"data"), "application/pdf")},
    )
    assert response.status_code == 403


def test_assigned_engineer_can_upload_and_complete(
    client: TestClient, tpm_headers, engineer_headers, node, activity_master, engineer_user
) -> None:
    client.post(
        f"/api/nodes/{node.id}/assignments",
        headers=tpm_headers,
        json={"user_id": engineer_user.id, "role": "PRIMARY_OWNER"},
    )
    activity = _attach(client, tpm_headers, node, activity_master)

    upload = client.post(
        f"/api/activities/{activity['id']}/logs",
        headers=engineer_headers,
        files={"file": ("evidence.pdf", io.BytesIO(b"data"), "application/pdf")},
    )
    assert upload.status_code == 201

    completed = client.put(
        f"/api/activities/{activity['id']}",
        headers=engineer_headers,
        json={"status": "Completed", "remarks": "Integration signed off"},
    )
    assert completed.status_code == 200
    assert completed.json()["remarks"] == "Integration signed off"


def test_global_activity_list_filters(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    _attach(client, tpm_headers, node, activity_master)

    page = client.get("/api/activities", headers=tpm_headers).json()
    assert page["total"] == 1
    item = page["items"][0]
    assert item["node_name"] == node.node_name
    assert item["activity_name"] == "Integration"
    assert item["log_count"] == 0

    filtered = client.get("/api/activities?status=Completed", headers=tpm_headers).json()
    assert filtered["total"] == 0

    searched = client.get("/api/activities?search=integr", headers=tpm_headers).json()
    assert searched["total"] == 1


def test_delete_activity_removes_its_logs(
    client: TestClient, db_session, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    _upload(client, tpm_headers, activity["id"])

    assert client.delete(f"/api/activities/{activity['id']}", headers=tpm_headers).status_code == 200
    assert db_session.query(NodeActivity).count() == 0


def test_filename_with_path_traversal_is_sanitised(
    client: TestClient, tpm_headers, node, activity_master
) -> None:
    activity = _attach(client, tpm_headers, node, activity_master)
    response = client.post(
        f"/api/activities/{activity['id']}/logs",
        headers=tpm_headers,
        files={"file": ("../../../etc/passwd.txt", io.BytesIO(b"data"), "text/plain")},
    )
    assert response.status_code == 201
    assert "/" not in response.json()["file_name"]
    assert ".." not in response.json()["file_name"]
