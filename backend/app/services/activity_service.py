"""Business rules for node activities.

The headline rule: an activity may only move to ``Completed`` once at least one
activity log (evidence file) has been uploaded against it.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import activity as activity_crud
from app.models.activity import NodeActivity
from app.models.enums import ActivityStatus


def ensure_completion_allowed(db: Session, activity: NodeActivity) -> None:
    """Raise ``422`` when an activity is completed without evidence."""
    if activity_crud.count_logs(db, activity.id) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "An activity cannot be marked as Completed until at least one "
                "activity log has been uploaded"
            ),
        )


def apply_status_change(
    db: Session, activity: NodeActivity, new_status: ActivityStatus
) -> NodeActivity:
    """Transition an activity, enforcing the completion rule and date bookkeeping."""
    if new_status == activity.status:
        return activity

    if new_status == ActivityStatus.COMPLETED:
        ensure_completion_allowed(db, activity)
        activity.completed_date = activity.completed_date or datetime.now(timezone.utc)
        if activity.start_date is None:
            activity.start_date = activity.completed_date
    else:
        # Re-opening an activity clears the completion timestamp.
        activity.completed_date = None
        if new_status == ActivityStatus.IN_PROGRESS and activity.start_date is None:
            activity.start_date = datetime.now(timezone.utc)

    activity.status = new_status
    db.flush()
    return activity


def guard_log_deletion(db: Session, activity: NodeActivity) -> None:
    """Prevent removing the last evidence file from a completed activity."""
    if (
        activity.status == ActivityStatus.COMPLETED
        and activity_crud.count_logs(db, activity.id) <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "A completed activity must keep at least one activity log. "
                "Re-open the activity before deleting its last log."
            ),
        )
