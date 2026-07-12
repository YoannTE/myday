"""Endpoints des catégories de notes (miroir des catégories de tâches).

Protégés par `get_current_user`. Réponses `{"data": ...}` ; erreurs via
HTTPException (messages français). Toute logique métier vit dans
`app.services.note_categories` (couleur auto-assignée depuis la palette et
contrôle d'unicité `UNIQUE(user_id, nom)`).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.note_categories import (
    NoteCategoryCreate,
    NoteCategoryResponse,
    NoteCategoryUpdate,
)
from app.services import note_categories as note_categories_service

router = APIRouter(prefix="/note-categories", tags=["note-categories"])


@router.get("")
async def list_note_categories(user: AuthUser = Depends(get_current_user)):
    categories = await note_categories_service.list_categories(user["id"])
    return {"data": [NoteCategoryResponse(**c).model_dump() for c in categories]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_note_category(
    payload: NoteCategoryCreate, user: AuthUser = Depends(get_current_user)
):
    category = await note_categories_service.create_category(user["id"], payload)
    return {"data": NoteCategoryResponse(**category).model_dump()}


@router.patch("/{category_id}")
async def update_note_category(
    category_id: UUID,
    payload: NoteCategoryUpdate,
    user: AuthUser = Depends(get_current_user),
):
    category = await note_categories_service.update_category(
        user["id"], str(category_id), payload
    )
    return {"data": NoteCategoryResponse(**category).model_dump()}


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note_category(
    category_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    await note_categories_service.delete_category(user["id"], str(category_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
