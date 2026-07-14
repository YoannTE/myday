"""Endpoints Evenements (CRUD local + synchronisation best-effort Google Agenda).

Reponses `{"data": ...}` en snake_case ; erreurs via HTTPException (messages
francais). La logique de synchronisation Google est entierement deleguee au
service, qui reutilise le socle Round 003.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.events import EventCountResponse, EventCreate, EventResponse, EventUpdate
from app.services import events as events_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
async def list_events(
    user: AuthUser = Depends(get_current_user),
    date_from: Annotated[datetime | None, Query(alias="from")] = None,
    date_to: Annotated[datetime | None, Query(alias="to")] = None,
):
    """Liste les evenements de l'utilisateur, filtres par chevauchement avec [from, to]."""
    events = await events_service.list_events(user["id"], date_from, date_to)
    return {"data": [EventResponse(**e).model_dump() for e in events]}


@router.get("/counts")
async def get_events_counts(
    date_from: Annotated[datetime, Query(alias="from")],
    date_to: Annotated[datetime, Query(alias="to")],
    user: AuthUser = Depends(get_current_user),
):
    """Nombre d'evenements par jour (fuseau applicatif) sur la fenetre [from, to].

    Reserve aux vues mois/annee du planning : ne charge jamais les evenements
    complets (perf), seulement un agregat par jour civil.
    """
    counts = await events_service.get_event_counts(user["id"], date_from, date_to)
    return {"data": [EventCountResponse(**c).model_dump() for c in counts]}


@router.get("/{event_id}")
async def get_event(event_id: UUID, user: AuthUser = Depends(get_current_user)):
    """Retourne un evenement par id (le sien ou partage avec lui), sinon 404.

    Permet d'ouvrir directement un evenement depuis une notification, meme
    s'il n'est pas dans la fenetre affichee du planning."""
    event = await events_service.get_event(user["id"], str(event_id))
    return {"data": EventResponse(**event).model_dump()}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate, user: AuthUser = Depends(get_current_user)
):
    """Cree un evenement local ; remonte vers Google Agenda si connecte (best-effort)."""
    event = await events_service.create_event(user["id"], payload)
    return {"data": EventResponse(**event).model_dump()}


@router.patch("/{event_id}")
async def update_event(
    event_id: UUID, payload: EventUpdate, user: AuthUser = Depends(get_current_user)
):
    """Met a jour un evenement local ; propage vers Google si deja synchronise."""
    event = await events_service.update_event(user["id"], str(event_id), payload)
    return {"data": EventResponse(**event).model_dump()}


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    """Supprime un evenement local ; supprime cote Google si synchronise (best-effort)."""
    await events_service.delete_event(user["id"], str(event_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
