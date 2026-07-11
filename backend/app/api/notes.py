"""Endpoints des notes : liste (filtre + recherche), création, mise à jour,
suppression. Protégés par `get_current_user`. Réponses `{"data": ...}`."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.notes import NoteCreate, NoteResponse, NoteUpdate
from app.services import notes as notes_service

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("")
async def list_notes(
    archivee: bool = Query(default=False),
    q: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
):
    notes = await notes_service.list_notes(user["id"], archivee, q)
    return {"data": [NoteResponse(**n).model_dump() for n in notes]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate, user: AuthUser = Depends(get_current_user)):
    note = await notes_service.create_note(user["id"], payload)
    return {"data": NoteResponse(**note).model_dump()}


@router.patch("/{note_id}")
async def update_note(
    note_id: UUID, payload: NoteUpdate, user: AuthUser = Depends(get_current_user)
):
    note = await notes_service.update_note(user["id"], str(note_id), payload)
    return {"data": NoteResponse(**note).model_dump()}


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    await notes_service.delete_note(user["id"], str(note_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
