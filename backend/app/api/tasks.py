"""Endpoints des tâches : liste, création, mise à jour, suppression.

Protégés par `get_current_user`. Réponses `{"data": ...}` ; erreurs via
HTTPException (messages français). Toute logique métier vit dans
`app.services.tasks` (dont l'atomicité du passage à `faite`).
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.tasks import (
    STATUTS,
    TaskCreate,
    TaskPlanifier,
    TaskResponse,
    TaskUpdate,
)
from app.services import tasks as tasks_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
async def list_tasks(
    statut: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
):
    filtre = statut if statut in STATUTS else None
    tasks = await tasks_service.list_tasks(user["id"], filtre)
    return {"data": [TaskResponse(**t).model_dump() for t in tasks]}


@router.get("/planned")
async def list_planned_tasks(
    date_from: Annotated[datetime, Query(alias="from")],
    date_to: Annotated[datetime, Query(alias="to")],
    user: AuthUser = Depends(get_current_user),
):
    """Tâches ayant un créneau planifié dans la fenêtre [from, to] (planning)."""
    tasks = await tasks_service.list_planned_tasks(user["id"], date_from, date_to)
    return {"data": [TaskResponse(**t).model_dump() for t in tasks]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, user: AuthUser = Depends(get_current_user)):
    task = await tasks_service.create_task(user["id"], payload)
    return {"data": TaskResponse(**task).model_dump()}


@router.post("/{task_id}/planifier")
async def planifier_task(
    task_id: UUID,
    payload: TaskPlanifier,
    user: AuthUser = Depends(get_current_user),
):
    task = await tasks_service.planifier_task(user["id"], str(task_id), payload)
    return {"data": TaskResponse(**task).model_dump()}


@router.delete("/{task_id}/planifier")
async def deplanifier_task(
    task_id: UUID, user: AuthUser = Depends(get_current_user)
):
    task = await tasks_service.deplanifier_task(user["id"], str(task_id))
    return {"data": TaskResponse(**task).model_dump()}


@router.patch("/{task_id}")
async def update_task(
    task_id: UUID, payload: TaskUpdate, user: AuthUser = Depends(get_current_user)
):
    task = await tasks_service.update_task(user["id"], str(task_id), payload)
    return {"data": TaskResponse(**task).model_dump()}


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    await tasks_service.delete_task(user["id"], str(task_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
