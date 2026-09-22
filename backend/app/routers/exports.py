"""Excel export endpoints."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query, Response

from app.core.deps import CurrentUser, DbSession
from app.crud import activity as activity_crud
from app.crud import node as node_crud
from app.models.enums import ActivityStatus, DeploymentState, NodeStatus
from app.services import export_service

router = APIRouter(prefix="/exports", tags=["Reports"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

#: Rows are capped so a stray export cannot exhaust server memory.
MAX_EXPORT_ROWS = 20_000


def _xlsx_response(content: bytes, filename: str) -> Response:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}_{stamp}.xlsx"'},
    )


@router.get("/nodes.xlsx", summary="Export nodes to Excel")
def export_nodes(
    db: DbSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    circle_id: int | None = None,
    product_id: int | None = None,
    deployment_state: DeploymentState | None = None,
    overall_status: NodeStatus | None = None,
    assigned_user_id: int | None = None,
    mine: bool = Query(False, description="Only nodes the caller works on"),
) -> Response:
    """The filters mirror ``GET /nodes`` so an export matches what is on screen."""
    stmt = node_crud.build_query(
        search=search,
        circle_id=circle_id,
        product_id=product_id,
        deployment_state=deployment_state,
        overall_status=overall_status,
        assigned_user_id=current_user.id if mine else assigned_user_id,
        sort_by="node_name",
        sort_dir="asc",
    ).limit(MAX_EXPORT_ROWS)

    nodes = db.execute(stmt).unique().scalars().all()
    counters = node_crud.activity_counts(db, [node.id for node in nodes])

    rows = []
    for node in nodes:
        counts = counters.get(node.id, {})
        rows.append(
            [
                node.id,
                node.node_name,
                node.product.product_name if node.product else "",
                node.circle.circle_name if node.circle else "",
                str(node.deployment_state),
                str(node.overall_status),
                node.owner.name if node.owner else "",
                node.lead.name if node.lead else "",
                node.tpm.name if node.tpm else "",
                counts.get("total_activities", 0),
                counts.get("pending_activities", 0),
                counts.get("in_progress_activities", 0),
                counts.get("completed_activities", 0),
                node.created_at,
                node.updated_at,
            ]
        )

    content = export_service.build_workbook({"Nodes": (export_service.NODE_HEADERS, rows)})
    return _xlsx_response(content, "nnm_nodes")


@router.get("/activities.xlsx", summary="Export activities to Excel")
def export_activities(
    db: DbSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    node_id: int | None = None,
    status: ActivityStatus | None = None,
    assigned_to: int | None = None,
    circle_id: int | None = None,
    product_id: int | None = None,
    mine: bool = Query(False, description="Only activities assigned to the caller"),
) -> Response:
    """The filters mirror ``GET /activities`` so an export matches what is on screen."""
    stmt = activity_crud.build_list_query(
        search=search,
        node_id=node_id,
        status=status,
        assigned_to=current_user.id if mine else assigned_to,
        circle_id=circle_id,
        product_id=product_id,
    ).limit(MAX_EXPORT_ROWS)

    rows = [
        [
            row.id,
            row.node_name,
            row.circle_name,
            row.product_name,
            row.activity_name,
            row.assignee_name or "Unassigned",
            str(row.status),
            row.start_date,
            row.completed_date,
            row.log_count,
            row.remarks or "",
        ]
        for row in db.execute(stmt).all()
    ]

    content = export_service.build_workbook(
        {"Activities": (export_service.ACTIVITY_HEADERS, rows)}
    )
    return _xlsx_response(content, "nnm_activities")
