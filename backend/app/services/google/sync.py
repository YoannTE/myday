"""Service de synchronisation Google (transposition fidele de google_sync.md).

Sequence (sans plateforme Core, service FastAPI classique, memes garanties) :

    load_connection (verrou + refresh single-flight + statut reauth)
        -> push_local_events (remontee des events sync_pending, AVANT le pull)
        -> asyncio.gather(branche_calendar, branche_gmail)   # 2 connexions distinctes
        -> finalize (last_sync par branche, liberation du verrou)

Invariants : jetons jamais dans le resultat ni les logs ; curseurs ecrits dans
la meme transaction que les donnees (dans les branches) ; une branche en echec
n'echoue pas l'autre (resultat `partial`) ; verrou BDD = garde anti-double-run.
"""

from __future__ import annotations

import asyncio
import logging
import uuid

from app.db.client import scoped_connection
from app.db.google_connection import (
    acquire_sync_lock,
    get_connection,
    read_tokens,
    release_sync_lock,
)
from app.services.google.calendar_branch import run_calendar_branch
from app.services.google.calendar_client import CalendarClient
from app.services.google.errors import DuplicateEvent, GoogleApiError
from app.services.google.gmail_branch import run_gmail_branch
from app.services.google.oauth import needs_refresh, refresh_access_token

logger = logging.getLogger("myday.google.sync")

_PUSH_BATCH = 10


async def load_connection(user_id: str) -> dict:
    """Verifie/prepare la connexion : verrou, refresh single-flight, statut reauth."""
    meta = await get_connection(user_id)
    if meta is None:
        return {"status": "not_connected"}
    if not await acquire_sync_lock(user_id):
        return {"status": "locked"}
    # Verrou pose a partir d'ici : l'appelant DOIT liberer (run_sync le fait).
    if meta["status"] == "reauth_required":
        return {"status": "reauth_required"}
    tokens = await read_tokens(user_id)
    if tokens is None:
        return {"status": "not_connected"}
    if needs_refresh(tokens.get("token_expiry")):
        if not await refresh_access_token(user_id):
            return {"status": "reauth_required"}
    return {
        "status": "ok",
        "calendar_sync_token": meta["calendar_sync_token"],
        "gmail_history_id": meta["gmail_history_id"],
    }


async def push_local_events(user_id: str) -> dict:
    """Remonte vers Google les evenements locaux `sync_pending` (id client idempotent)."""
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            """
            SELECT id::text, titre, debut, fin, lieu, description, client_uuid
            FROM events
            WHERE user_id = $1 AND source = 'myday' AND sync_status = 'sync_pending'
            ORDER BY created_at ASC LIMIT $2
            """,
            user_id, _PUSH_BATCH,
        )
    if not rows:
        return {"pushed": 0, "failed": 0}

    tokens = await read_tokens(user_id)
    if tokens is None or not tokens.get("access_token"):
        return {"pushed": 0, "failed": 0}
    client = CalendarClient(tokens["access_token"])
    pushed = failed = 0
    try:
        for row in rows:
            try:
                await _push_one(user_id, client, row)
                pushed += 1
            except GoogleApiError:
                failed += 1  # laisse la row `sync_pending` : nouvel essai au run suivant
    finally:
        await client.aclose()
    return {"pushed": pushed, "failed": failed}


async def _push_one(user_id: str, client: CalendarClient, row) -> None:
    # client_uuid = clef d'idempotence, persistee AVANT l'insert Google (hex 32 :
    # aussi utilisable tel quel comme id d'evenement Google, base32hex valide).
    client_uuid = row["client_uuid"] or uuid.uuid4().hex
    if row["client_uuid"] is None:
        async with scoped_connection(user_id) as conn:
            await conn.execute(
                "UPDATE events SET client_uuid = $2, updated_at = now() "
                "WHERE id = $1::uuid",
                row["id"], client_uuid,
            )
    body = {
        "id": client_uuid,
        "summary": row["titre"],
        "location": row["lieu"],
        "description": row["description"],
        "start": {"dateTime": row["debut"].isoformat()},
        "end": {"dateTime": row["fin"].isoformat()},
        "extendedProperties": {"private": {"mydayClientUuid": client_uuid}},
    }
    try:
        created = await client.insert_event(body)
        google_event_id = created.get("id", client_uuid)
    except DuplicateEvent:
        # Deja insere lors d'un run precedent (crash avant l'UPDATE local) :
        # l'id est deterministe, on reconcilie sans creer de doublon Google.
        google_event_id = client_uuid
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            "UPDATE events SET google_event_id = $2, sync_status = 'synced', "
            "updated_at = now() WHERE id = $1::uuid",
            row["id"], google_event_id,
        )


async def finalize_sync(
    user_id: str, calendar_result: dict | None, gmail_result: dict | None, pushed: dict
) -> dict:
    """Agrege les resultats, avance last_sync par branche reussie, libere le verrou."""
    partial = calendar_result is None or gmail_result is None
    calendar = {**(calendar_result or {"created": 0, "updated": 0, "deleted": 0}),
                "pushed": pushed["pushed"]}
    gmail = gmail_result or {"new_mails": 0, "updated": 0, "new_mail_ids": []}
    # mail_triage est déclenché par `run_sync` APRES ce retour (verrou libéré
    # ci-dessous) - PAS ici, cf. correction #1 review Round 006.
    await release_sync_lock(user_id)
    if partial:
        failed = "agenda" if calendar_result is None else "mails"
        logger.info("google_sync partial user=%s branche_echec=%s", user_id, failed)
    return {
        "calendar": calendar,
        "gmail": {k: gmail[k] for k in ("new_mails", "updated") if k in gmail},
        "partial": partial,
        "triage_started": False,
        "connection_status": "ok",
    }


async def run_sync(user_id: str, trigger: str = "scheduled") -> dict:
    """Point d'entree : execute un run complet pour un utilisateur."""
    state = await load_connection(user_id)
    status = state["status"]
    if status in ("not_connected", "locked"):
        return {"status": "skipped" if status == "locked" else "not_connected"}
    try:
        if status == "reauth_required":
            return {"status": "reauth_required"}
        pushed = await _safe_push(user_id)
        results = await asyncio.gather(
            run_calendar_branch(user_id, state),
            run_gmail_branch(user_id, state),
            return_exceptions=True,
        )
        calendar_result = results[0] if not isinstance(results[0], Exception) else None
        gmail_result = results[1] if not isinstance(results[1], Exception) else None
        for branch, res in zip(("agenda", "mails"), results):
            if isinstance(res, Exception):
                logger.warning("google_sync branche %s en echec: %r", branch, res)
        outcome = await finalize_sync(user_id, calendar_result, gmail_result, pushed)
        outcome["status"] = "completed"
        new_mail_ids = (gmail_result or {}).get("new_mail_ids") or []
        if new_mail_ids:
            # Déclenché APRES finalize_sync (verrou déjà libéré - correction #1
            # review Round 006). Best-effort : une exception du tri ne casse
            # jamais la sync. Import local pour éviter tout couplage au boot.
            try:
                from app.services.mail_triage.orchestrator import run_mail_triage

                await run_mail_triage(user_id, new_mail_ids, "sync")
                outcome["triage_started"] = True
            except Exception as exc:
                logger.warning("mail_triage déclenché par sync en échec: %r", exc)
        return outcome
    finally:
        # Filet de securite : garantit la liberation meme si finalize a echoue.
        await release_sync_lock(user_id)


async def _safe_push(user_id: str) -> dict:
    try:
        return await push_local_events(user_id)
    except GoogleApiError as exc:
        logger.warning("google_sync push_local_events en echec: %r", exc)
        return {"pushed": 0, "failed": 0}
