"""Endpoints des notifications (liste, marquage lu, compteur non-lues).

Protégés par `get_current_user`. Réponses `{"data": ...}` (SOP
`api-response-casing-contract`).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.auth.session import AuthUser, get_current_user
from app.models.notifications import NotificationResponse, NotificationsReadRequest
from app.services import notifications as notifications_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications_endpoint(
    lue: bool | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
):
    rows = await notifications_service.list_notifications(user["id"], lue)
    return {"data": [NotificationResponse(**r).model_dump() for r in rows]}


@router.post("/read")
async def mark_read_endpoint(
    payload: NotificationsReadRequest | None = None,
    user: AuthUser = Depends(get_current_user),
):
    # Corps absent = tout marquer lu (contrat figé du plan).
    ids = payload.ids if payload is not None else None
    marked = await notifications_service.mark_read(user["id"], ids)
    return {"data": {"marked": marked}}


@router.get("/unread-count")
async def unread_count_endpoint(user: AuthUser = Depends(get_current_user)):
    count = await notifications_service.unread_count(user["id"])
    return {"data": {"count": count}}
