"""Endpoints des contacts (liens de partage entre comptes, Round 016).

Protégés par `get_current_user`. Réponses `{"data": ...}`.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.contacts import ContactCreate, ContactResponse
from app.services import contacts as contacts_service

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("")
async def list_contacts(user: AuthUser = Depends(get_current_user)):
    contacts = await contacts_service.list_contacts(user["id"])
    return {"data": [ContactResponse(**c).model_dump() for c in contacts]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreate, user: AuthUser = Depends(get_current_user)
):
    contact = await contacts_service.create_contact(user["id"], payload.email)
    return {"data": ContactResponse(**contact).model_dump()}


@router.post("/{contact_id}/accepter")
async def accept_contact(
    contact_id: UUID, user: AuthUser = Depends(get_current_user)
):
    contact = await contacts_service.accept_contact(user["id"], str(contact_id))
    return {"data": ContactResponse(**contact).model_dump()}


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    await contacts_service.delete_contact(user["id"], str(contact_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
