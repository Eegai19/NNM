"""Node activity endpoints and the activity log (file evidence) module."""
from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import FileResponse

from app.core.deps import CurrentUser, DbSession, Pagination
from app.core.permissions import require_node_modify_access
from app.crud import activity as activity_crud
from app.crud import node as node_crud
from app.crud.base import count_query
from app.models.enums import ActivityStatus, AuditAction, AuditEntity
from app.schemas.activity import (
    ActivityLogRead,
    NodeActivityCreate,
    NodeActivityListItem,
    NodeActivityRead,
    NodeActivityUpdate,
)
from app.schemas.common import Message, Page
from app.services import activity_service, audit_service, storage_service
from app.utils.errors import bad_request, conflict, not_found
from app.utils.validators import ensure_activity_master, ensure_node, ensure_user

router = APIRouter(tags=["Activities"])


def _load_activity(db, activity_id: int):
    activity = activity_crud.get(db, activity_id)
    if activity is None:
        not_found("Activity", activity_id)
    return activity


# --- Node-scoped activities -----------------------------------------------
@router.get(
    "/nodes/{node_id}/activities",
    response_model=list[NodeActivityRead],
    summary="List a node's activities",
)
def list_node_activities(
    node_id: int, db: DbSession, current_user: CurrentUser
) -> list[NodeActivityRead]:
    ensure_node(db, node_id)
    return [
        NodeActivityRead.model_validate(row)
        for row in activity_crud.list_for_node(db, node_id)
    ]


@router.post(
    "/nodes/{node_id}/activities",
    response_model=NodeActivityRead,
    status_code=201,
    summary="Attach a catalogue activity to a node",
)
def create_node_activity(
    node_id: int, payload: NodeActivityCreate, db: DbSession, current_user: CurrentUser
) -> NodeActivityRead:
    node = ensure_node(db, node_id)
    require_node_modify_access(db, current_user, node_id)

    master = ensure_activity_master(db, payload.activity_master_id)
    if activity_crud.get_for_node_master(db, node_id, master.id) is not None:
        conflict(f"'{master.activity_name}' is already attached to this node")
    if payload.assigned_to is not None:
        ensure_user(db, payload.assigned_to, label="Engineer")
    if payload.status == ActivityStatus.COMPLETED:
        bad_request(
            "A new activity cannot start as Completed -- upload an activity log first"
        )

    from app.models.activity import NodeActivity

    activity = NodeActivity(
        node_id=node_id,
        activity_master_id=master.id,
        assigned_to=payload.assigned_to,
        status=payload.status,
        start_date=payload.start_date,
        remarks=payload.remarks,
    )
    db.add(activity)
    db.flush()

    node_crud.recalculate_overall_status(db, node)
    audit_service.record(
        db,
        entity_type=AuditEntity.NODE_ACTIVITY,
        action=AuditAction.CREATE,
        entity_id=activity.id,
        node_id=node_id,
        description=f"Added activity '{master.activity_name}' to '{node.node_name}'",
        actor=current_user,
        changes={"status": str(activity.status), "assigned_to": activity.assigned_to},
    )
    db.commit()
    db.refresh(activity)
    return NodeActivityRead.model_validate(activity)


@router.get(
    "/activities",
    response_model=Page[NodeActivityListItem],
    summary="Global activity list with filters and pagination",
)
def list_activities(
    db: DbSession,
    current_user: CurrentUser,
    pagination: Pagination,
    search: str | None = Query(None),
    node_id: int | None = None,
    status: ActivityStatus | None = None,
    assigned_to: int | None = None,
    circle_id: int | None = None,
    product_id: int | None = None,
    mine: bool = Query(False, description="Only activities assigned to the caller"),
) -> Page[NodeActivityListItem]:
    stmt = activity_crud.build_list_query(
        search=search,
        node_id=node_id,
        status=status,
        assigned_to=current_user.id if mine else assigned_to,
        circle_id=circle_id,
        product_id=product_id,
    )
    total = count_query(db, stmt)
    rows = db.execute(stmt.offset(pagination.offset).limit(pagination.page_size)).all()
    items = [NodeActivityListItem(**row._mapping) for row in rows]
    return Page.build(items, total, pagination.page, pagination.page_size)


@router.get(
    "/activities/{activity_id}", response_model=NodeActivityRead, summary="Read an activity"
)
def read_activity(
    activity_id: int, db: DbSession, current_user: CurrentUser
) -> NodeActivityRead:
    return NodeActivityRead.model_validate(_load_activity(db, activity_id))


@router.put(
    "/activities/{activity_id}",
    response_model=NodeActivityRead,
    summary="Update an activity (status, assignee, remarks)",
)
def update_activity(
    activity_id: int,
    payload: NodeActivityUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> NodeActivityRead:
    activity = _load_activity(db, activity_id)
    require_node_modify_access(db, current_user, activity.node_id)

    data = payload.model_dump(exclude_unset=True)
    if "assigned_to" in data and data["assigned_to"] is not None:
        ensure_user(db, data["assigned_to"], label="Engineer")

    before = audit_service.snapshot(
        activity, ["assigned_to", "status", "start_date", "completed_date", "remarks"]
    )

    new_status = data.pop("status", None)
    for field, value in data.items():
        setattr(activity, field, value)
    db.flush()

    if new_status is not None:
        activity_service.apply_status_change(db, activity, ActivityStatus(new_status))

    after = audit_service.snapshot(
        activity, ["assigned_to", "status", "start_date", "completed_date", "remarks"]
    )
    changes = audit_service.diff(before, after)

    node = node_crud.get(db, activity.node_id)
    if node is not None:
        node_crud.recalculate_overall_status(db, node)

    action = (
        AuditAction.STATUS_CHANGE
        if new_status is not None and before["status"] != after["status"]
        else AuditAction.UPDATE
    )
    audit_service.record(
        db,
        entity_type=AuditEntity.NODE_ACTIVITY,
        action=action,
        entity_id=activity.id,
        node_id=activity.node_id,
        description=(
            f"Activity '{activity.activity_master.activity_name}' "
            + (
                f"moved from {before['status']} to {after['status']}"
                if action == AuditAction.STATUS_CHANGE
                else "updated"
            )
        ),
        actor=current_user,
        changes=changes,
    )
    db.commit()
    db.refresh(activity)
    return NodeActivityRead.model_validate(activity)


@router.delete(
    "/activities/{activity_id}", response_model=Message, summary="Remove an activity from a node"
)
def delete_activity(activity_id: int, db: DbSession, current_user: CurrentUser) -> Message:
    activity = _load_activity(db, activity_id)
    require_node_modify_access(db, current_user, activity.node_id)

    name = activity.activity_master.activity_name
    node_id = activity.node_id
    activity_crud.delete(db, activity)

    node = node_crud.get(db, node_id)
    if node is not None:
        node_crud.recalculate_overall_status(db, node)

    audit_service.record(
        db,
        entity_type=AuditEntity.NODE_ACTIVITY,
        action=AuditAction.DELETE,
        entity_id=activity_id,
        node_id=node_id,
        description=f"Removed activity '{name}' from the node",
        actor=current_user,
    )
    db.commit()
    storage_service.purge_activity_files(activity_id)
    return Message(detail=f"Activity {name} removed")


# --- Activity logs ---------------------------------------------------------
@router.get(
    "/activities/{activity_id}/logs",
    response_model=list[ActivityLogRead],
    summary="List the evidence files for an activity",
)
def list_logs(
    activity_id: int, db: DbSession, current_user: CurrentUser
) -> list[ActivityLogRead]:
    _load_activity(db, activity_id)
    return [
        ActivityLogRead.model_validate(row) for row in activity_crud.list_logs(db, activity_id)
    ]


@router.post(
    "/activities/{activity_id}/logs",
    response_model=ActivityLogRead,
    status_code=201,
    summary="Upload an evidence file",
)
def upload_log(
    activity_id: int,
    db: DbSession,
    current_user: CurrentUser,
    file: UploadFile = File(..., description="pdf, zip, txt, xlsx, csv, png, jpg or jpeg"),
) -> ActivityLogRead:
    activity = _load_activity(db, activity_id)
    require_node_modify_access(db, current_user, activity.node_id)

    file_name, relative_path, size = storage_service.save_upload(file, activity_id)
    try:
        log = activity_crud.create_log(
            db,
            activity_id=activity_id,
            file_name=file_name,
            file_path=relative_path,
            content_type=file.content_type,
            file_size=size,
            uploaded_by=current_user.id,
        )
        audit_service.record(
            db,
            entity_type=AuditEntity.ACTIVITY_LOG,
            action=AuditAction.UPLOAD,
            entity_id=log.id,
            node_id=activity.node_id,
            description=(
                f"Uploaded '{file_name}' to activity "
                f"'{activity.activity_master.activity_name}'"
            ),
            actor=current_user,
            changes={"file_name": file_name, "file_size": size},
        )
        db.commit()
    except Exception:
        db.rollback()
        storage_service.delete_file(relative_path)
        raise

    db.refresh(log)
    return ActivityLogRead.model_validate(log)


@router.get(
    "/activity-logs/{log_id}/download",
    summary="Download an evidence file",
    response_class=FileResponse,
)
def download_log(log_id: int, db: DbSession, current_user: CurrentUser) -> FileResponse:
    log = activity_crud.get_log(db, log_id)
    if log is None:
        not_found("Activity log", log_id)

    path = storage_service.absolute_path(log.file_path)
    if not path.exists():
        not_found("Stored file for activity log", log_id)

    return FileResponse(
        path=path,
        filename=log.file_name,
        media_type=log.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(log.file_name)}"
        },
    )


@router.delete(
    "/activity-logs/{log_id}", response_model=Message, summary="Delete an evidence file"
)
def delete_log(log_id: int, db: DbSession, current_user: CurrentUser) -> Message:
    log = activity_crud.get_log(db, log_id)
    if log is None:
        not_found("Activity log", log_id)

    activity = log.node_activity
    require_node_modify_access(db, current_user, activity.node_id)
    activity_service.guard_log_deletion(db, activity)

    file_name = log.file_name
    relative_path = log.file_path
    activity_crud.delete_log(db, log)

    audit_service.record(
        db,
        entity_type=AuditEntity.ACTIVITY_LOG,
        action=AuditAction.DELETE,
        entity_id=log_id,
        node_id=activity.node_id,
        description=f"Deleted activity log '{file_name}'",
        actor=current_user,
    )
    db.commit()
    storage_service.delete_file(relative_path)
    return Message(detail=f"{file_name} deleted")
