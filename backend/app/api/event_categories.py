"""Endpoints des catégories d'événements (miroir des catégories de tâches/notes).

Protégés par `get_current_user`. Réponses `{"data": ...}` ; erreurs via
HTTPException (messages français). Logique métier dans
`app.services.event_categories`.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.event_categories import (
    EventCategoryCreate,
    EventCategoryResponse,
    EventCategoryUpdate,
)
from app.services import event_categories as event_categories_service

router = APIRouter(prefix="/event-categories", tags=["event-categories"])


@router.get("")
async def list_event_categories(user: AuthUser = Depends(get_current_user)):
    categories = await event_categories_service.list_categories(user["id"])
    return {"data": [EventCategoryResponse(**c).model_dump() for c in categories]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_event_category(
    payload: EventCategoryCreate, user: AuthUser = Depends(get_current_user)
):
    category = await event_categories_service.create_category(user["id"], payload)
    return {"data": EventCategoryResponse(**category).model_dump()}


@router.patch("/{category_id}")
async def update_event_category(
    category_id: UUID,
    payload: EventCategoryUpdate,
    user: AuthUser = Depends(get_current_user),
):
    category = await event_categories_service.update_category(
        user["id"], str(category_id), payload
    )
    return {"data": EventCategoryResponse(**category).model_dump()}


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_category(
    category_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    await event_categories_service.delete_category(user["id"], str(category_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
