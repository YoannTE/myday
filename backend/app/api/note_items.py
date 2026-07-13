"""Endpoints des éléments (cases à cocher) d'une note.

Protégés par `get_current_user`. Réponses `{"data": ...}`. La création est
imbriquée sous la note (`/notes/{note_id}/items`) ; la modification et la
suppression ciblent l'élément (`/note-items/{item_id}`).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.note_items import (
    NoteItemCreate,
    NoteItemResponse,
    NoteItemUpdate,
)
from app.services import note_items as note_items_service

router = APIRouter(tags=["note-items"])


@router.post("/notes/{note_id}/items", status_code=status.HTTP_201_CREATED)
async def create_note_item(
    note_id: UUID,
    payload: NoteItemCreate,
    user: AuthUser = Depends(get_current_user),
):
    item = await note_items_service.create_item(user["id"], str(note_id), payload)
    return {"data": NoteItemResponse(**item).model_dump()}


@router.patch("/note-items/{item_id}")
async def update_note_item(
    item_id: UUID,
    payload: NoteItemUpdate,
    user: AuthUser = Depends(get_current_user),
):
    item = await note_items_service.update_item(user["id"], str(item_id), payload)
    return {"data": NoteItemResponse(**item).model_dump()}


@router.delete("/note-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note_item(
    item_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    await note_items_service.delete_item(user["id"], str(item_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
