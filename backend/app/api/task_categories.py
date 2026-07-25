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
    TaskCategoryDeplacer,
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


@router.post("/{category_id}/deplacer")
async def deplacer_task_category(
    category_id: UUID,
    payload: TaskCategoryDeplacer,
    user: AuthUser = Depends(get_current_user),
):
    """Déplace une catégorie vers le haut/bas dans l'ordre manuel. Renvoie la
    liste complète des catégories de l'utilisateur re-triée."""
    categories = await task_categories_service.deplacer_task_category(
        user["id"], str(category_id), payload.direction
    )
    return {"data": [TaskCategoryResponse(**c).model_dump() for c in categories]}


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
