"""Logique metier des evenements (CRUD local + synchronisation Google best-effort).

Toutes les lectures/ecritures passent par `scoped_connection(user_id)` (RLS).
La remontee/mise a jour/suppression cote Google est deleguee a
`services/events_google.py`, qui reutilise le socle Round 003.
"""

from __future__ import annotations

from datetime import datetime

from app.db.client import scoped_connection
from app.db.google_connection import get_connection
from app.models.events import EventCreate, EventUpdate
from app.services import events_google
from app.utils.errors import bad_request, not_found

_COLUMNS = (
    "id::text, titre, debut, fin, lieu, description, google_event_id, "
    "source, sync_status, created_at, updated_at"
)


async def list_events(
    user_id: str, date_from: datetime | None, date_to: datetime | None
) -> list[dict]:
    conditions = []
    params: list = [user_id]
    if date_from is not None:
        params.append(date_from)
        conditions.append(f"fin > ${len(params)}")
    if date_to is not None:
        params.append(date_to)
        conditions.append(f"debut < ${len(params)}")
    where = " AND " + " AND ".join(conditions) if conditions else ""
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            f"SELECT {_COLUMNS} FROM events WHERE user_id = $1{where} "
            "ORDER BY debut ASC",
            *params,
        )
    return [dict(r) for r in rows]


async def _fetch_event(user_id: str, event_id: str) -> dict | None:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM events WHERE id = $1::uuid AND user_id = $2",
            event_id, user_id,
        )
    return dict(row) if row is not None else None


async def create_event(user_id: str, payload: EventCreate) -> dict:
    if payload.fin <= payload.debut:
        raise bad_request("La date de fin doit etre apres la date de debut.")

    connected = await get_connection(user_id) is not None
    sync_status = "sync_pending" if connected else "synced"

    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"""
            INSERT INTO events (user_id, titre, debut, fin, lieu, description,
                                 source, sync_status)
            VALUES ($1, $2, $3, $4, $5, $6, 'myday', $7)
            RETURNING {_COLUMNS}
            """,
            user_id, payload.titre, payload.debut, payload.fin,
            payload.lieu, payload.description, sync_status,
        )
    event = dict(row)

    if connected:
        # Best-effort, inline : ne fait jamais echouer la sauvegarde locale.
        await events_google.push_new_event(user_id, event["id"])
        refreshed = await _fetch_event(user_id, event["id"])
        if refreshed is not None:
            event = refreshed

    return event


async def update_event(user_id: str, event_id: str, payload: EventUpdate) -> dict:
    current = await _fetch_event(user_id, event_id)
    if current is None:
        raise not_found("Evenement introuvable.")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return current

    new_debut = updates.get("debut", current["debut"])
    new_fin = updates.get("fin", current["fin"])
    if ("debut" in updates or "fin" in updates) and new_fin <= new_debut:
        raise bad_request("La date de fin doit etre apres la date de debut.")

    set_clauses = []
    values: list = []
    for key, value in updates.items():
        values.append(value)
        set_clauses.append(f"{key} = ${len(values)}")
    idx_id = len(values) + 1
    idx_user = len(values) + 2

    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"UPDATE events SET {', '.join(set_clauses)}, updated_at = now() "
            f"WHERE id = ${idx_id}::uuid AND user_id = ${idx_user} "
            f"RETURNING {_COLUMNS}",
            *values, event_id, user_id,
        )
    if row is None:
        raise not_found("Evenement introuvable.")
    event = dict(row)

    if event["google_event_id"]:
        # Le push insert-only ne propage pas une modif : update_event best-effort.
        await events_google.push_update(user_id, event)
        refreshed = await _fetch_event(user_id, event_id)
        if refreshed is not None:
            event = refreshed

    return event


async def delete_event(user_id: str, event_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "DELETE FROM events WHERE id = $1::uuid AND user_id = $2 "
            "RETURNING google_event_id",
            event_id, user_id,
        )
    if row is None:
        raise not_found("Evenement introuvable.")
    google_event_id = row["google_event_id"]
    if google_event_id:
        await events_google.delete_remote(user_id, google_event_id)
