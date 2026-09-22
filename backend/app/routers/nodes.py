"""Node CRUD, assignment management and per-node timeline."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, DbSession, Pagination, require_admin, require_tpm
from app.core.permissions import require_node_modify_access
from app.crud import assignment as assignment_crud
from app.crud import node as node_crud
from app.crud.base import count_query
from app.models.enums import (
    AssignmentRole,
    AuditAction,
    AuditEntity,
    DeploymentState,
    NodeStatus,
)
from app.models.user import User
from app.schemas.assignment import AssignmentCreate, AssignmentRead, AssignmentUpdate
from app.schemas.audit import AuditTrailRead
from app.schemas.common import Message, Page
from app.schemas.node import NodeCreate, NodeRead, NodeSummary, NodeUpdate
from app.services import audit_service, storage_service
from app.utils.errors import conflict, not_found
from app.utils.validators import (
    ensure_circle,
    ensure_node,
    ensure_product,
    ensure_unique_node_name,
    ensure_user,
)

router = APIRouter(prefix="/nodes", tags=["Nodes"])

#: Roles that may hold at most one holder per node.
SINGLETON_ROLES = {AssignmentRole.PRIMARY_OWNER, AssignmentRole.SECONDARY_OWNER}

NODE_AUDIT_FIELDS = [
    "node_name",
    "product_id",
    "circle_id",
    "owner_id",
    "lead_id",
    "tpm_id",
    "deployment_state",
    "overall_status",
]


@router.get("", response_model=Page[NodeSummary], summary="List nodes")
def list_nodes(
    db: DbSession,
    current_user: CurrentUser,
    pagination: Pagination,
    search: str | None = Query(None, description="Match node, circle or product name"),
    circle_id: int | None = None,
    product_id: int | None = None,
    deployment_state: DeploymentState | None = None,
    overall_status: NodeStatus | None = None,
    assigned_user_id: int | None = Query(None, description="Only nodes this user works on"),
    mine: bool = Query(False, description="Shortcut for assigned_user_id=<me>"),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
) -> Page[NodeSummary]:
    stmt = node_crud.build_query(
        search=search,
        circle_id=circle_id,
        product_id=product_id,
        deployment_state=deployment_state,
        overall_status=overall_status,
        assigned_user_id=current_user.id if mine else assigned_user_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    total = count_query(db, stmt)
    rows = (
        db.execute(stmt.offset(pagination.offset).limit(pagination.page_size))
        .unique()
        .scalars()
        .all()
    )
    counters = node_crud.activity_counts(db, [row.id for row in rows])

    items = []
    for row in rows:
        summary = NodeSummary.model_validate(row)
        for field, value in counters.get(row.id, {}).items():
            setattr(summary, field, value)
        items.append(summary)

    return Page.build(items, total, pagination.page, pagination.page_size)


@router.post("", response_model=NodeRead, status_code=201, summary="Create a node")
def create_node(
    payload: NodeCreate, db: DbSession, admin: User = Depends(require_admin)
) -> NodeRead:
    ensure_unique_node_name(db, payload.node_name)
    ensure_product(db, payload.product_id)
    ensure_circle(db, payload.circle_id)
    for user_id, label in (
        (payload.owner_id, "Owner"),
        (payload.lead_id, "Lead"),
        (payload.tpm_id, "TPM"),
    ):
        if user_id is not None:
            ensure_user(db, user_id, label=label)

    node = node_crud.create(db, payload)
    audit_service.record(
        db,
        entity_type=AuditEntity.NODE,
        action=AuditAction.CREATE,
        entity_id=node.id,
        node_id=node.id,
        description=f"Created node '{node.node_name}'",
        actor=admin,
        changes=audit_service.snapshot(node, NODE_AUDIT_FIELDS),
    )
    db.commit()
    db.refresh(node)
    return NodeRead.model_validate(node)


@router.get("/{node_id}", response_model=NodeSummary, summary="Read a node")
def read_node(node_id: int, db: DbSession, current_user: CurrentUser) -> NodeSummary:
    node = ensure_node(db, node_id)
    summary = NodeSummary.model_validate(node)
    for field, value in node_crud.activity_counts(db, [node.id]).get(node.id, {}).items():
        setattr(summary, field, value)
    return summary


@router.get(
    "/{node_id}/can-modify",
    response_model=dict,
    summary="Whether the caller may modify this node",
)
def can_modify(node_id: int, db: DbSession, current_user: CurrentUser) -> dict:
    """Lets the UI hide controls the caller is not allowed to use."""
    from app.core.permissions import can_modify_node

    ensure_node(db, node_id)
    return {"can_modify": can_modify_node(db, current_user, node_id)}


@router.put("/{node_id}", response_model=NodeRead, summary="Update a node")
def update_node(
    node_id: int, payload: NodeUpdate, db: DbSession, current_user: CurrentUser
) -> NodeRead:
    node = ensure_node(db, node_id)
    require_node_modify_access(db, current_user, node_id)

    if payload.node_name:
        ensure_unique_node_name(db, payload.node_name, exclude_id=node_id)
    if payload.product_id is not None:
        ensure_product(db, payload.product_id)
    if payload.circle_id is not None:
        ensure_circle(db, payload.circle_id)
    for user_id, label in (
        (payload.owner_id, "Owner"),
        (payload.lead_id, "Lead"),
        (payload.tpm_id, "TPM"),
    ):
        if user_id is not None:
            ensure_user(db, user_id, label=label)

    before = audit_service.snapshot(node, NODE_AUDIT_FIELDS)
    node_crud.update(db, node, payload)
    after = audit_service.snapshot(node, NODE_AUDIT_FIELDS)

    audit_service.record(
        db,
        entity_type=AuditEntity.NODE,
        action=AuditAction.UPDATE,
        entity_id=node.id,
        node_id=node.id,
        description=f"Updated node '{node.node_name}'",
        actor=current_user,
        changes=audit_service.diff(before, after),
    )
    db.commit()
    db.refresh(node)
    return NodeRead.model_validate(node)


@router.delete("/{node_id}", response_model=Message, summary="Delete a node (TPM only)")
def delete_node(node_id: int, db: DbSession, tpm: User = Depends(require_tpm)) -> Message:
    node = ensure_node(db, node_id)
    name = node.node_name
    activity_ids = [activity.id for activity in node.activities]

    node_crud.delete(db, node)
    audit_service.record(
        db,
        entity_type=AuditEntity.NODE,
        action=AuditAction.DELETE,
        entity_id=node_id,
        node_id=node_id,
        description=f"Deleted node '{name}'",
        actor=tpm,
    )
    db.commit()

    # Only remove files once the transaction is durable.
    for activity_id in activity_ids:
        storage_service.purge_activity_files(activity_id)

    return Message(detail=f"Node {name} deleted")


@router.get(
    "/{node_id}/timeline",
    response_model=list[AuditTrailRead],
    summary="Audit timeline for a node",
)
def node_timeline(
    node_id: int,
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(100, ge=1, le=500),
) -> list[AuditTrailRead]:
    from app.crud import audit as audit_crud

    ensure_node(db, node_id)
    stmt = audit_crud.build_query(node_id=node_id).limit(limit)
    rows = db.execute(stmt).unique().scalars().all()
    return [AuditTrailRead.model_validate(row) for row in rows]


# --- Assignments -----------------------------------------------------------
@router.get(
    "/{node_id}/assignments",
    response_model=list[AssignmentRead],
    summary="List engineers assigned to a node",
)
def list_assignments(
    node_id: int, db: DbSession, current_user: CurrentUser
) -> list[AssignmentRead]:
    ensure_node(db, node_id)
    return [
        AssignmentRead.model_validate(row) for row in assignment_crud.list_for_node(db, node_id)
    ]


@router.post(
    "/{node_id}/assignments",
    response_model=AssignmentRead,
    status_code=201,
    summary="Assign an engineer to a node (TPM / LEAD only)",
)
def create_assignment(
    node_id: int,
    payload: AssignmentCreate,
    db: DbSession,
    admin: User = Depends(require_admin),
) -> AssignmentRead:
    node = ensure_node(db, node_id)
    user = ensure_user(db, payload.user_id, label="Engineer")

    if assignment_crud.get_for_node_user(db, node_id, payload.user_id) is not None:
        conflict(f"{user.name} is already assigned to this node")
    if payload.role in SINGLETON_ROLES:
        existing = assignment_crud.get_by_role(db, node_id, payload.role)
        if existing is not None:
            conflict(
                f"This node already has a {payload.role}. "
                "Remove the current holder before assigning a new one."
            )

    assignment = assignment_crud.create(
        db, node_id=node_id, user_id=payload.user_id, role=payload.role, assigned_by=admin.id
    )
    if payload.role == AssignmentRole.PRIMARY_OWNER and node.owner_id is None:
        node.owner_id = user.id

    audit_service.record(
        db,
        entity_type=AuditEntity.NODE_ASSIGNMENT,
        action=AuditAction.ASSIGN,
        entity_id=assignment.id,
        node_id=node_id,
        description=f"Assigned {user.name} to '{node.node_name}' as {payload.role}",
        actor=admin,
        changes={"user_id": user.id, "role": str(payload.role)},
    )
    db.commit()
    db.refresh(assignment)
    return AssignmentRead.model_validate(assignment)


@router.put(
    "/{node_id}/assignments/{assignment_id}",
    response_model=AssignmentRead,
    summary="Change an assignment role (TPM / LEAD only)",
)
def update_assignment(
    node_id: int,
    assignment_id: int,
    payload: AssignmentUpdate,
    db: DbSession,
    admin: User = Depends(require_admin),
) -> AssignmentRead:
    ensure_node(db, node_id)
    assignment = assignment_crud.get(db, assignment_id)
    if assignment is None or assignment.node_id != node_id:
        not_found("Assignment", assignment_id)

    if payload.role in SINGLETON_ROLES:
        existing = assignment_crud.get_by_role(db, node_id, payload.role)
        if existing is not None and existing.id != assignment_id:
            conflict(f"This node already has a {payload.role}")

    previous_role = assignment.role
    assignment.role = payload.role
    db.flush()

    audit_service.record(
        db,
        entity_type=AuditEntity.NODE_ASSIGNMENT,
        action=AuditAction.UPDATE,
        entity_id=assignment.id,
        node_id=node_id,
        description=(
            f"Changed assignment role for {assignment.user.name} "
            f"from {previous_role} to {payload.role}"
        ),
        actor=admin,
        changes={"role": {"from": str(previous_role), "to": str(payload.role)}},
    )
    db.commit()
    db.refresh(assignment)
    return AssignmentRead.model_validate(assignment)


@router.delete(
    "/{node_id}/assignments/{assignment_id}",
    response_model=Message,
    summary="Remove an assignment (TPM / LEAD only)",
)
def delete_assignment(
    node_id: int,
    assignment_id: int,
    db: DbSession,
    admin: User = Depends(require_admin),
) -> Message:
    ensure_node(db, node_id)
    assignment = assignment_crud.get(db, assignment_id)
    if assignment is None or assignment.node_id != node_id:
        not_found("Assignment", assignment_id)

    user_name = assignment.user.name
    role = assignment.role
    assignment_crud.delete(db, assignment)

    audit_service.record(
        db,
        entity_type=AuditEntity.NODE_ASSIGNMENT,
        action=AuditAction.UNASSIGN,
        entity_id=assignment_id,
        node_id=node_id,
        description=f"Removed {user_name} ({role}) from the node",
        actor=admin,
    )
    db.commit()
    return Message(detail=f"{user_name} removed from this node")
