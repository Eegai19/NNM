"""Shared pytest fixtures.

Each test module gets a fresh, file-backed SQLite database and its own storage
directory so uploads from one test never leak into another.
"""
from __future__ import annotations

import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    ActivityMaster,
    Circle,
    Node,
    Product,
    User,
    UserRole,
)


@pytest.fixture()
def db_session(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Session]:
    storage = tmp_path / "storage"
    storage.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "storage_dir", storage)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# --- Data fixtures ---------------------------------------------------------
def _make_user(db: Session, name: str, username: str, role: UserRole, active: bool = True) -> User:
    user = User(
        name=name,
        username=username,
        password_hash=hash_password("Password@123"),
        mobile_number="9000000000",
        role=role,
        is_active=active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def tpm_user(db_session: Session) -> User:
    return _make_user(db_session, "Tina TPM", "tina.tpm", UserRole.TPM)


@pytest.fixture()
def lead_user(db_session: Session) -> User:
    return _make_user(db_session, "Leo Lead", "leo.lead", UserRole.LEAD)


@pytest.fixture()
def engineer_user(db_session: Session) -> User:
    return _make_user(db_session, "Eegai Engineer", "eegai", UserRole.ENGINEER)


@pytest.fixture()
def other_engineer(db_session: Session) -> User:
    return _make_user(db_session, "Otto Outsider", "otto", UserRole.ENGINEER)


@pytest.fixture()
def product(db_session: Session) -> Product:
    item = Product(product_name="AirScale 5G", is_active=True)
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def circle(db_session: Session) -> Circle:
    item = Circle(circle_name="TN", is_active=True)
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def activity_master(db_session: Session) -> ActivityMaster:
    item = ActivityMaster(
        activity_name="Integration", description="Integrate the node", is_active=True
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def node(db_session: Session, product: Product, circle: Circle) -> Node:
    item = Node(node_name="TN-NOK-1001", product_id=product.id, circle_id=circle.id)
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


# --- Auth helpers ----------------------------------------------------------
def login(client: TestClient, username: str, password: str = "Password@123") -> str:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth_headers(client: TestClient, user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client, user.username)}"}


@pytest.fixture()
def tpm_headers(client: TestClient, tpm_user: User) -> dict[str, str]:
    return auth_headers(client, tpm_user)


@pytest.fixture()
def lead_headers(client: TestClient, lead_user: User) -> dict[str, str]:
    return auth_headers(client, lead_user)


@pytest.fixture()
def engineer_headers(client: TestClient, engineer_user: User) -> dict[str, str]:
    return auth_headers(client, engineer_user)


@pytest.fixture()
def other_engineer_headers(client: TestClient, other_engineer: User) -> dict[str, str]:
    return auth_headers(client, other_engineer)
