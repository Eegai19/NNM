"""The node inventory and the rules that derive circle and product from a name."""
from __future__ import annotations

from collections import Counter

from scripts.seed_data import (
    ACTIVITIES,
    CIRCLES,
    DEMO_USERS,
    PRIMARY_CIRCLES,
    PRODUCTS,
    circle_for,
    product_for,
    unique_node_names,
)
from app.models import UserRole


def test_products_are_the_three_product_lines() -> None:
    assert PRODUCTS == ["CMM", "CMD", "NRD"]


def test_primary_circles_are_the_five_in_scope() -> None:
    assert PRIMARY_CIRCLES == ["PB", "HR", "KL", "UPE", "UPW"]
    assert set(PRIMARY_CIRCLES) <= set(CIRCLES)


def test_activity_workflow_is_in_execution_order() -> None:
    assert [name for name, _ in ACTIVITIES] == [
        "Onboarding",
        "FCT Config",
        "Full Config Day 0",
        "Full Config Day 1",
        "Reachability",
        "UAT",
        "Go Live",
    ]
    assert all(description for _, description in ACTIVITIES)


def test_demo_users_cover_every_role() -> None:
    by_role = Counter(role for _, _, role, _ in DEMO_USERS)
    assert by_role[UserRole.TPM] == 1
    assert by_role[UserRole.LEAD] == 2
    assert by_role[UserRole.ENGINEER] == 3

    names = {name for name, _, _, _ in DEMO_USERS}
    assert names == {"Rohit", "Daljit", "Ravi", "Gopi", "Eegai", "Buran"}

    usernames = [username for _, username, _, _ in DEMO_USERS]
    assert len(usernames) == len(set(usernames))


def test_node_names_are_upper_cased_and_deduplicated() -> None:
    names = unique_node_names()
    assert all(name == name.upper() for name in names)
    assert len(names) == len(set(names))
    # JKSRICK02NCMM04 appears twice in the source list, in different cases.
    assert names.count("JKSRICK02NCMM04") == 1
    assert len(names) == 28


def test_every_node_maps_to_a_known_circle() -> None:
    circles = {circle_for(name) for name in unique_node_names()}
    assert circles <= set(CIRCLES), f"unmapped circles: {circles - set(CIRCLES)}"


def test_circle_prefix_aliases() -> None:
    assert circle_for("UWMORCK02NCMM03") == "UPW"
    assert circle_for("UEGANCK03NCMM06") == "UPE"
    assert circle_for("PBLUDCK04NCMM05") == "PB"
    assert circle_for("hrsahck01ncmm03") == "HR"


def test_product_is_derived_from_the_name() -> None:
    assert product_for("UWMORCK02NCMM03") == "CMM"
    assert product_for("HRMANLK03LABCMM02") == "CMM"
    assert product_for("PBLUDCK04NCMD05") == "CMD"
    assert product_for("PBLUDCK04NRD05") == "NRD"


def test_every_node_maps_to_a_known_product() -> None:
    products = {product_for(name) for name in unique_node_names()}
    assert products <= set(PRODUCTS)
