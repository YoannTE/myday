"""Branche Agenda : fetch incremental (syncToken) puis apply transactionnel.

- `fetch_calendar_changes` (HTTP, hors transaction) : events.list incremental ;
  premier sync ou 410 → resync complet borne a `calendar_window_days`. Ne pose
  PAS le curseur (c'est apply qui l'ecrit avec les donnees).
- `apply_calendar_changes` (UNE transaction scoped_connection) : upsert par
  (user_id, google_event_id), Google gagne SAUF sur les rows `sync_pending` ;
  reconciliation par `client_uuid` (anti-doublon apres crash push→pull) ;
  suppression des `cancelled` ; ecriture du syncToken dans la MEME transaction.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.config import settings
from app.db.client import scoped_connection
from app.db.google_connection import read_tokens
from app.services.google.calendar_client import CalendarClient
from app.services.google.errors import SyncTokenExpired


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def _parse_bound(node: dict | None) -> datetime | None:
    """Convertit un start/end Google (dateTime ISO ou date all-day) en datetime."""
    if not node:
        return None
    raw = node.get("dateTime") or node.get("date")
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value


def _client_uuid(item: dict) -> str | None:
    return (
        item.get("extendedProperties", {})
        .get("private", {})
        .get("mydayClientUuid")
    )


async def fetch_calendar_changes(
    client: CalendarClient, sync_token: str | None, window_days: int
) -> dict:
    """Recupere les changements d'agenda (incremental) ou une fenetre complete."""
    if sync_token:
        try:
            return await _fetch_incremental(client, sync_token)
        except SyncTokenExpired:
            pass  # curseur expire : bascule en resync borne
    return await _fetch_window(client, window_days)


async def _fetch_incremental(client: CalendarClient, sync_token: str) -> dict:
    items: list[dict] = []
    next_token: str | None = None
    page_token: str | None = None
    while True:
        data = await client.list_events(sync_token=sync_token, page_token=page_token)
        items.extend(data.get("items", []))
        next_token = data.get("nextSyncToken") or next_token
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return {"items": items, "next_sync_token": next_token, "resync": False}


async def _fetch_window(client: CalendarClient, window_days: int) -> dict:
    now = datetime.now(timezone.utc)
    time_min = _iso(now - timedelta(days=7))
    time_max = _iso(now + timedelta(days=window_days))
    items: list[dict] = []
    next_token: str | None = None
    page_token: str | None = None
    while True:
        data = await client.list_events(
            time_min=time_min, time_max=time_max, page_token=page_token
        )
        items.extend(data.get("items", []))
        next_token = data.get("nextSyncToken") or next_token
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return {"items": items, "next_sync_token": next_token, "resync": True}


async def apply_calendar_changes(user_id: str, changes: dict) -> dict:
    """Applique les changements + ecrit le syncToken dans UNE seule transaction."""
    created = updated = deleted = 0
    async with scoped_connection(user_id) as conn:
        for item in changes.get("items", []):
            gid = item.get("id")
            if not gid:
                continue
            if item.get("status") == "cancelled":
                res = await conn.execute(
                    "DELETE FROM events WHERE user_id = $1 AND google_event_id = $2",
                    user_id,
                    gid,
                )
                deleted += 1 if res.endswith(" 1") else 0
                continue

            debut = _parse_bound(item.get("start"))
            fin = _parse_bound(item.get("end"))
            if debut is None or fin is None:
                continue
            titre = item.get("summary") or "(sans titre)"
            lieu = item.get("location")
            desc = item.get("description")

            # Reconciliation par client_uuid : un evenement pousse dont l'UPDATE
            # local avait echoue (crash) est rattache ici sans creer de doublon.
            cu = _client_uuid(item)
            if cu:
                row = await conn.fetchrow(
                    """
                    UPDATE events SET google_event_id = $2, source = 'google',
                        sync_status = 'synced', titre = $3, debut = $4, fin = $5,
                        lieu = $6, description = $7, updated_at = now()
                    WHERE user_id = $1 AND client_uuid = $8
                      AND (google_event_id IS NULL OR google_event_id = $2)
                    RETURNING id
                    """,
                    user_id, gid, titre, debut, fin, lieu, desc, cu,
                )
                if row is not None:
                    updated += 1
                    continue

            # Upsert (user_id, google_event_id). Google gagne SAUF si la row
            # locale est encore `sync_pending` (edition locale non remontee).
            row = await conn.fetchrow(
                """
                INSERT INTO events
                    (user_id, titre, debut, fin, lieu, description,
                     google_event_id, source, sync_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'google', 'synced')
                ON CONFLICT (user_id, google_event_id)
                    WHERE google_event_id IS NOT NULL
                DO UPDATE SET titre = EXCLUDED.titre, debut = EXCLUDED.debut,
                    fin = EXCLUDED.fin, lieu = EXCLUDED.lieu,
                    description = EXCLUDED.description, source = 'google',
                    sync_status = 'synced', updated_at = now()
                    WHERE events.sync_status <> 'sync_pending'
                RETURNING (xmax = 0) AS inserted
                """,
                user_id, titre, debut, fin, lieu, desc, gid,
            )
            if row is not None:
                created += 1 if row["inserted"] else 0
                updated += 0 if row["inserted"] else 1

        # Curseur ecrit dans la meme transaction (jamais avance sans donnees).
        await conn.execute(
            "UPDATE google_connections SET calendar_sync_token = COALESCE($2, "
            "calendar_sync_token), calendar_synced_at = now(), updated_at = now() "
            "WHERE user_id = $1",
            user_id,
            changes.get("next_sync_token"),
        )
    return {"created": created, "updated": updated, "deleted": deleted}


async def run_calendar_branch(user_id: str, state: dict) -> dict:
    """Orchestre la branche agenda (sa propre connexion, son propre client)."""
    tokens = await read_tokens(user_id)
    if tokens is None or not tokens.get("access_token"):
        raise RuntimeError("Jetons Google indisponibles pour la branche agenda.")
    client = CalendarClient(tokens["access_token"])
    try:
        changes = await fetch_calendar_changes(
            client, state.get("calendar_sync_token"), settings.calendar_window_days
        )
    finally:
        await client.aclose()
    result = await apply_calendar_changes(user_id, changes)
    result["resync"] = changes["resync"]
    return result
