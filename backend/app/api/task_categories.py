"""Endpoints des catégories de tâches (Round 012).

Protégés par `get_current_user`. Réponses `{"data": ...}` ; erreurs via
HTTPException (messages français). Toute logique métier vit dans
`app.services.task_categories` (dont la couleur auto-assignée depuis la
palette et le contrôle d'unicité `UNIQUE(user_id, nom)`).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.task_categories import (
    TaskCategoryCreate,
    TaskCategoryResponse,
    TaskCategoryUpdate,
)
from app.services import task_categories as task_categories_service

router = APIRouter(prefix="/task-categories", tags=["task-categories"])


@router.get("")
async def list_task_categories(user: AuthUser = Depends(get_current_user)):
    categories = await task_categories_service.list_categories(user["id"])
    return {"data": [TaskCategoryResponse(**c).model_dump() for c in categories]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task_category(
    payload: TaskCategoryCreate, user: AuthUser = Depends(get_current_user)
):
    category = await task_categories_service.create_category(user["id"], payload)
    return {"data": TaskCategoryResponse(**category).model_dump()}


@router.patch("/{category_id}")
async def update_task_category(
    category_id: UUID,
    payload: TaskCategoryUpdate,
    user: AuthUser = Depends(get_current_user),
):
    category = await task_categories_service.update_category(
        user["id"], str(category_id), payload
    )
    return {"data": TaskCategoryResponse(**category).model_dump()}


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_category(
    category_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    await task_categories_service.delete_category(user["id"], str(category_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
