"""Push best-effort vers Google Agenda pour les mutations d'evenements MyDay.

Reutilise integralement le socle Round 003 (`app.services.google.sync`) :
verrou anti-chevauchement (`load_connection`/`release_sync_lock`), refresh
single-flight, et `_push_one` (idempotence par `client_uuid`, reconciliation
`DuplicateEvent`). Aucune mutation locale ne doit jamais echouer a cause de
Google : chaque fonction ici est best-effort et avale les `GoogleApiError`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.db.client import scoped_connection
from app.db.google_connection import read_tokens, release_sync_lock
from app.services.google.calendar_client import CalendarClient
from app.services.google.errors import GoogleApiError
from app.services.google.sync import _push_one, load_connection


@asynccontextmanager
async def _connected_client(user_id: str) -> AsyncIterator[CalendarClient | None]:
    """Cede un client Google pret a l'emploi, ou None si aucun push n'est possible.

    Le verrou pose par `load_connection` est libere automatiquement, SAUF quand
    le statut est `locked` : ce verrou appartient alors a un run concurrent
    (scheduler ou sync manuelle) et ne doit surtout pas etre touche.
    """
    state = await load_connection(user_id)
    status = state["status"]
    if status == "locked":
        yield None
        return
    if status != "ok":
        # reauth_required / not_connected (race) : le verrou a ete pose par
        # load_connection, aucune operation ne suivra dans cette requete.
        try:
            yield None
        finally:
            await release_sync_lock(user_id)
        return
    tokens = await read_tokens(user_id)
    if tokens is None or not tokens.get("access_token"):
        try:
            yield None
        finally:
            await release_sync_lock(user_id)
        return
    client = CalendarClient(tokens["access_token"])
    try:
        yield client
    finally:
        await client.aclose()
        await release_sync_lock(user_id)


async def push_new_event(user_id: str, event_id: str) -> None:
    """Pousse un evenement `myday` fraichement cree (best-effort).

    En cas d'echec/verrou/reauth, la row reste `sync_pending` (jamais
    `sync_error`) : le scheduler periodique la repoussera au run suivant.
    """
    async with _connected_client(user_id) as client:
        if client is None:
            return
        async with scoped_connection(user_id) as conn:
            row = await conn.fetchrow(
                "SELECT id::text, titre, debut, fin, lieu, description, client_uuid "
                "FROM events WHERE id = $1::uuid AND user_id = $2",
                event_id, user_id,
            )
        if row is None:
            return
        try:
            await _push_one(user_id, client, row)
        except GoogleApiError:
            pass  # reste sync_pending ; le scheduler periodique reessaiera


async def push_update(user_id: str, event: dict) -> None:
    """Propage une modification locale vers un evenement deja synchronise."""
    async with _connected_client(user_id) as client:
        if client is None:
            return
        body = {
            "summary": event["titre"],
            "location": event["lieu"],
            "description": event["description"],
            "start": {"dateTime": event["debut"].isoformat()},
            "end": {"dateTime": event["fin"].isoformat()},
        }
        new_status = "synced"
        try:
            await client.update_event(event["google_event_id"], body)
        except GoogleApiError:
            new_status = "sync_pending"
        async with scoped_connection(user_id) as conn:
            await conn.execute(
                "UPDATE events SET sync_status = $3, updated_at = now() "
                "WHERE id = $1::uuid AND user_id = $2",
                event["id"], user_id, new_status,
            )


async def delete_remote(user_id: str, google_event_id: str) -> None:
    """Supprime cote Google un evenement deja supprime localement (best-effort)."""
    async with _connected_client(user_id) as client:
        if client is None:
            return
        try:
            await client.delete_event(google_event_id)
        except GoogleApiError:
            pass  # suppression locale deja faite ; best-effort cote Google
