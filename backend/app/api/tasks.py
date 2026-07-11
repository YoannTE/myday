"""Endpoints des tâches : liste, création, mise à jour, suppression.

Protégés par `get_current_user`. Réponses `{"data": ...}` ; erreurs via
HTTPException (messages français). Toute logique métier vit dans
`app.services.tasks` (dont l'atomicité du passage à `faite`).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.tasks import STATUTS, TaskCreate, TaskResponse, TaskUpdate
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


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, user: AuthUser = Depends(get_current_user)):
    task = await tasks_service.create_task(user["id"], payload)
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
