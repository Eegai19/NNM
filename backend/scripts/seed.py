"""Create the database schema and load demo/reference data.

Usage
-----
    python -m scripts.seed              # schema + bootstrap TPM + master data
    python -m scripts.seed --demo       # also generate demo nodes and activities
    python -m scripts.seed --reset      # drop everything first (destructive)
"""
from __future__ import annotations

import argparse
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import Base, SessionLocal, engine, init_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    ActivityMaster,
    ActivityStatus,
    AssignmentRole,
    Circle,
    DeploymentState,
    Node,
    NodeActivity,
    NodeAssignment,
    NodeStatus,
    Product,
    User,
    UserRole,
)

PRODUCTS = [
    "AirScale 5G",
    "AirScale 4G",
    "SRAN Controller",
    "Nokia Core NSA",
    "Microwave Backhaul",
]

CIRCLES = [
    "TN", "KA", "AP", "KL", "MH", "GJ", "DL", "UPE", "UPW", "WB", "PB", "RJ",
]

ACTIVITIES = [
    ("Site Survey", "Physical inspection and readiness confirmation of the site"),
    ("Hardware Installation", "Rack, stack and cable the node hardware"),
    ("Software Commissioning", "Load the approved software baseline onto the node"),
    ("Parameter Configuration", "Apply the circle-specific radio parameter plan"),
    ("Integration", "Integrate the node into the live network and controller"),
    ("Drive Test", "Field drive test to verify coverage and throughput"),
    ("Alarm Clearance", "Clear all outstanding alarms raised after integration"),
    ("Acceptance Testing", "Customer acceptance test execution and sign-off"),
    ("Documentation Handover", "Upload as-built documents and handover pack"),
]

DEMO_USERS = [
    ("Priya Raman", "priya.lead", UserRole.LEAD, "9840012001"),
    ("Arun Kumar", "arun.lead", UserRole.LEAD, "9840012002"),
    ("Eegai", "eegai", UserRole.ENGINEER, "9840012003"),
    ("Karthik Subramanian", "karthik", UserRole.ENGINEER, "9840012004"),
    ("Divya Nair", "divya", UserRole.ENGINEER, "9840012005"),
    ("Sanjay Mehta", "sanjay", UserRole.ENGINEER, "9840012006"),
    ("Reshma Pillai", "reshma", UserRole.ENGINEER, "9840012007"),
    ("Vikram Shah", "vikram", UserRole.TPM, "9840012008"),
]

DEMO_PASSWORD = "Nokia@123"


def _get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.execute(select(model).filter_by(**lookup)).scalar_one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def seed_master_data(db: Session) -> None:
    for name in PRODUCTS:
        _get_or_create(db, Product, {"is_active": True}, product_name=name)
    for name in CIRCLES:
        _get_or_create(db, Circle, {"is_active": True}, circle_name=name)
    for name, description in ACTIVITIES:
        _get_or_create(
            db,
            ActivityMaster,
            {"description": description, "is_active": True},
            activity_name=name,
        )
    print(
        f"  master data: {len(PRODUCTS)} products, {len(CIRCLES)} circles, "
        f"{len(ACTIVITIES)} activities"
    )


def seed_bootstrap_user(db: Session) -> User:
    admin, created = _get_or_create(
        db,
        User,
        {
            "name": settings.first_tpm_name,
            "password_hash": hash_password(settings.first_tpm_password),
            "mobile_number": settings.first_tpm_mobile,
            "role": UserRole.TPM,
            "is_active": True,
        },
        username=settings.first_tpm_username,
    )
    print(
        f"  bootstrap TPM: {admin.username} "
        f"({'created' if created else 'already present'})"
    )
    return admin


def seed_demo_users(db: Session) -> list[User]:
    users = []
    for name, username, role, mobile in DEMO_USERS:
        user, _ = _get_or_create(
            db,
            User,
            {
                "name": name,
                "password_hash": hash_password(DEMO_PASSWORD),
                "mobile_number": mobile,
                "role": role,
                "is_active": True,
            },
            username=username,
        )
        users.append(user)
    print(f"  demo users: {len(users)} (password '{DEMO_PASSWORD}')")
    return users


def seed_demo_nodes(db: Session, admin: User, users: list[User], count: int = 40) -> None:
    if db.execute(select(Node).limit(1)).scalar_one_or_none() is not None:
        print("  demo nodes: skipped (nodes already exist)")
        return

    rng = random.Random(20240501)
    products = list(db.execute(select(Product)).scalars().all())
    circles = list(db.execute(select(Circle)).scalars().all())
    masters = list(db.execute(select(ActivityMaster)).scalars().all())
    leads = [u for u in users if u.role == UserRole.LEAD] or [admin]
    tpms = [u for u in users if u.role == UserRole.TPM] or [admin]
    engineers = [u for u in users if u.role == UserRole.ENGINEER]

    now = datetime.now(timezone.utc)
    created_activities = 0

    for index in range(1, count + 1):
        circle = rng.choice(circles)
        product = rng.choice(products)
        owner = rng.choice(engineers) if engineers else admin
        node = Node(
            node_name=f"{circle.circle_name}-NOK-{1000 + index}",
            product_id=product.id,
            circle_id=circle.id,
            owner_id=owner.id,
            lead_id=rng.choice(leads).id,
            tpm_id=rng.choice(tpms).id,
            deployment_state=rng.choice(list(DeploymentState)),
            overall_status=NodeStatus.NOT_STARTED,
            created_at=now - timedelta(days=rng.randint(1, 120)),
        )
        db.add(node)
        db.flush()

        # Assignments -----------------------------------------------------
        if engineers:
            pool = rng.sample(engineers, k=min(3, len(engineers)))
            roles = [
                AssignmentRole.PRIMARY_OWNER,
                AssignmentRole.SECONDARY_OWNER,
                AssignmentRole.SUPPORT_ENGINEER,
            ]
            for engineer, role in zip(pool, roles):
                db.add(
                    NodeAssignment(
                        node_id=node.id,
                        user_id=engineer.id,
                        role=role,
                        assigned_by=admin.id,
                    )
                )

        # Activities ------------------------------------------------------
        selected = rng.sample(masters, k=rng.randint(3, min(6, len(masters))))
        statuses = [ActivityStatus.PENDING, ActivityStatus.IN_PROGRESS]
        for master in selected:
            status = rng.choice(statuses)
            started = now - timedelta(days=rng.randint(0, 60))
            db.add(
                NodeActivity(
                    node_id=node.id,
                    activity_master_id=master.id,
                    assigned_to=rng.choice(engineers).id if engineers else None,
                    status=status,
                    start_date=started if status != ActivityStatus.PENDING else None,
                    remarks=None,
                )
            )
            created_activities += 1

        node.overall_status = (
            NodeStatus.IN_PROGRESS
            if any(s == ActivityStatus.IN_PROGRESS for s in statuses)
            else NodeStatus.NOT_STARTED
        )

    db.flush()
    print(f"  demo data: {count} nodes, {created_activities} activities")
    print(
        "  note: demo activities stay Pending/In Progress -- completing one "
        "requires uploading an activity log, exactly as the rule demands."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the NNM database")
    parser.add_argument("--demo", action="store_true", help="also create demo users and nodes")
    parser.add_argument(
        "--reset", action="store_true", help="DROP every table before seeding (destructive)"
    )
    args = parser.parse_args()

    if args.reset:
        confirm = input("This deletes all NNM data. Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return
        Base.metadata.drop_all(bind=engine)
        print("Dropped all tables.")

    print(f"Seeding {settings.database_url}")
    init_db()

    with SessionLocal() as db:
        seed_master_data(db)
        admin = seed_bootstrap_user(db)
        if args.demo:
            users = seed_demo_users(db)
            seed_demo_nodes(db, admin, users)
        db.commit()

    print("Seeding complete.")
    print(
        f"Sign in as '{settings.first_tpm_username}' / "
        f"'{settings.first_tpm_password}' and change the password immediately."
    )


if __name__ == "__main__":
    main()
