"""Reference data for the NNM seeder.

Kept separate from the seeding logic so the inventory can be reviewed and
edited without touching the code that loads it.
"""
from __future__ import annotations

from app.models import UserRole

#: Product lines. A node's product is derived from the token in its name
#: (``...NCMM03`` -> CMM), so these must match the naming convention.
PRODUCTS: list[str] = ["CMM", "CMD", "NRD"]

#: Circles in scope today, in the order the customer listed them.
PRIMARY_CIRCLES: list[str] = ["PB", "HR", "KL", "UPE", "UPW"]

#: Further circles referenced by the current node inventory. Without these the
#: HP/JK/OD/RJ nodes below would have nowhere to live.
ADDITIONAL_CIRCLES: list[str] = ["HP", "JK", "OD", "RJ"]

CIRCLES: list[str] = PRIMARY_CIRCLES + ADDITIONAL_CIRCLES

#: Two-letter node-name prefixes that do not equal their circle name.
CIRCLE_PREFIX_ALIASES: dict[str, str] = {"UW": "UPW", "UE": "UPE"}

#: The deployment workflow, in the order it is executed. Every node receives
#: all of these, and each one is an upload point for its own artifacts.
ACTIVITIES: list[tuple[str, str]] = [
    ("Onboarding", "Register the node, confirm pre-requisites and raise the tracker"),
    ("FCT Config", "Apply the factory configuration template to the node"),
    ("Full Config Day 0", "Load the complete Day 0 configuration baseline"),
    ("Full Config Day 1", "Load the Day 1 configuration and apply site-specific parameters"),
    ("Reachability", "Verify management and signalling reachability end to end"),
    ("UAT", "Run user acceptance testing and capture the customer sign-off"),
    ("Go Live", "Cut the node over to live traffic and hand over to operations"),
]

#: Demo accounts. The bootstrap TPM from the environment is created separately.
DEMO_USERS: list[tuple[str, str, UserRole, str]] = [
    ("Rohit", "rohit", UserRole.TPM, "9840010001"),
    ("Daljit", "daljit", UserRole.LEAD, "9840010002"),
    ("Ravi", "ravi", UserRole.LEAD, "9840010003"),
    ("Gopi", "gopi", UserRole.ENGINEER, "9840010004"),
    ("Eegai", "eegai", UserRole.ENGINEER, "9840010005"),
    ("Buran", "buran", UserRole.ENGINEER, "9840010006"),
]

DEMO_PASSWORD = "Nokia@123"

#: Node inventory. Names are normalised to upper case on load, which also
#: collapses the JKSRICK02NCMM04 / jksrick02ncmm04 pair into one node.
NODE_NAMES: list[str] = [
    "uwmorck02ncmm03",
    "uwmorck03ncmm04",
    "hpludck03ncmm02",
    "ueganck03ncmm06",
    "ueganck04ncmm07",
    "hrsahck01ncmm03",
    "JKSRICK02NCMM04",
    "rjjaick04ncmm04",
    "rjudack01ncmm06",
    "klpolck02ncmm04",
    "UWGNGCK01NCMM05",
    "jksrick02ncmm04",
    "rjjodck02ncmm05",
    "odbhuck03ncmm04",
    "rjudack02ncmm07",
    "rjjodck03ncmm09",
    "PBLUDCK04NCMM05",
    "RJJAICK05NCMM08",
    "UWGNGCK02NCMM06",
    "pbmohck09ncmm06",
    "UEGMTCK04NCMM08",
    "UEGMTCK03NCMM04",
    "UEGMTCK02NCMM03",
    "HRMANLK03LABCMM02",
    "hrsahck03ncmm04",
    "KLPOLCK06NCMM05",
    "PBAMBCK05NCMM07",
    "uwmorck01ncmm07",
    "ODBHUCK09NCMM06",
]


def circle_for(node_name: str) -> str:
    """Derive a node's circle from the first two characters of its name."""
    prefix = node_name.upper()[:2]
    return CIRCLE_PREFIX_ALIASES.get(prefix, prefix)


def product_for(node_name: str) -> str:
    """Derive a node's product from the product token inside its name."""
    name = node_name.upper()
    for product in ("CMD", "NRD", "CMM"):
        if product in name:
            return product
    return PRODUCTS[0]


def unique_node_names() -> list[str]:
    """Upper-cased node names with case-insensitive duplicates removed."""
    seen: set[str] = set()
    names: list[str] = []
    for raw in NODE_NAMES:
        name = raw.strip().upper()
        if name and name not in seen:
            seen.add(name)
            names.append(name)
    return names
