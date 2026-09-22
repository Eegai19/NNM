"""The dashboard drill-down: products, the circles inside them, and their nodes."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.models import Circle, Node, NodeStatus, Product


def _make(db, product: Product, circle: Circle, name: str, status: NodeStatus) -> Node:
    node = Node(
        node_name=name,
        product_id=product.id,
        circle_id=circle.id,
        overall_status=status,
    )
    db.add(node)
    db.commit()
    return node


def test_hierarchy_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/dashboard/hierarchy").status_code == 401


def test_every_product_is_listed_even_with_no_nodes(
    client: TestClient, db_session, tpm_headers, product: Product
) -> None:
    db_session.add(Product(product_name="NRD", is_active=True))
    db_session.commit()

    body = client.get("/api/dashboard/hierarchy", headers=tpm_headers).json()
    names = [row["product"] for row in body]
    assert "NRD" in names

    empty = next(row for row in body if row["product"] == "NRD")
    assert empty["node_count"] == 0
    assert empty["circles"] == []


def test_products_are_sorted_and_carry_their_circles(
    client: TestClient, db_session, tpm_headers, product: Product, circle: Circle
) -> None:
    other_circle = Circle(circle_name="PB", is_active=True)
    db_session.add(other_circle)
    db_session.commit()

    _make(db_session, product, circle, "UEGMTCK02NCMM03", NodeStatus.COMPLETED)
    _make(db_session, product, circle, "UEGMTCK03NCMM04", NodeStatus.IN_PROGRESS)
    _make(db_session, product, other_circle, "PBLUDCK04NCMM05", NodeStatus.NOT_STARTED)

    body = client.get("/api/dashboard/hierarchy", headers=tpm_headers).json()
    entry = next(row for row in body if row["product"] == product.product_name)

    assert entry["node_count"] == 3
    assert entry["status"]["completed"] == 1
    assert entry["status"]["in_progress"] == 1
    assert entry["status"]["not_started"] == 1

    circles = {row["circle"]: row for row in entry["circles"]}
    assert set(circles) == {"TN", "PB"}
    assert circles["TN"]["node_count"] == 2
    assert circles["PB"]["node_count"] == 1
    # Circles are alphabetical so the tree renders in a stable order.
    assert [row["circle"] for row in entry["circles"]] == ["PB", "TN"]


def test_activity_progress_rolls_up(
    client: TestClient, db_session, tpm_headers, product, circle, activity_master
) -> None:
    node = _make(db_session, product, circle, "KLPOLCK06NCMM05", NodeStatus.NOT_STARTED)
    client.post(
        f"/api/nodes/{node.id}/activities",
        headers=tpm_headers,
        json={"activity_master_id": activity_master.id},
    )

    body = client.get("/api/dashboard/hierarchy", headers=tpm_headers).json()
    entry = next(row for row in body if row["product"] == product.product_name)
    assert entry["total_activities"] == 1
    assert entry["completed_activities"] == 0
    assert entry["circles"][0]["total_activities"] == 1


def test_an_engineer_may_read_the_hierarchy(
    client: TestClient, engineer_headers, product, circle
) -> None:
    assert client.get("/api/dashboard/hierarchy", headers=engineer_headers).status_code == 200


def test_drilling_into_a_circle_returns_its_nodes(
    client: TestClient, db_session, tpm_headers, product, circle
) -> None:
    """The UI expands a circle via /nodes, so that filter pair must work."""
    other_circle = Circle(circle_name="HR", is_active=True)
    db_session.add(other_circle)
    db_session.commit()

    _make(db_session, product, circle, "KLPOLCK02NCMM04", NodeStatus.NOT_STARTED)
    _make(db_session, product, other_circle, "HRSAHCK01NCMM03", NodeStatus.NOT_STARTED)

    page = client.get(
        f"/api/nodes?product_id={product.id}&circle_id={circle.id}", headers=tpm_headers
    ).json()
    assert page["total"] == 1
    assert page["items"][0]["node_name"] == "KLPOLCK02NCMM04"
