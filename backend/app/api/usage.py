"""Endpoint du journal d'usage : émission d'évènements produit légers.

Protégé par `get_current_user`. Réponse `{"data": {id}}`. `task_completed`
est refusé (400) : émis uniquement côté serveur par le PATCH tâche atomique.
"""

from fastapi import APIRouter, Depends, status

from app.auth.session import AuthUser, get_current_user
from app.models.usage import UsageEventCreate, UsageEventResponse
from app.services import usage as usage_service

router = APIRouter(prefix="/usage-events", tags=["usage"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_usage_event(
    payload: UsageEventCreate, user: AuthUser = Depends(get_current_user)
):
    event = await usage_service.create_usage_event(user["id"], payload)
    return {"data": UsageEventResponse(**event).model_dump()}
