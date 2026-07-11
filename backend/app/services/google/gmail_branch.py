"""Branche Gmail : fetch incremental (historyId) puis store transactionnel.

- `fetch_gmail_changes` (HTTP, hors transaction) : history.list incremental ;
  premier sync ou 404 → resync borne a `gmail_lookback_days`, plafonne a
  `max_mails_per_sync` (`truncated=true` si depassement). Ne pose PAS le curseur.
- `store_new_mails` (UNE transaction) : insert `pending_triage` dedup par
  (user_id, gmail_id), maj lu / suppression distante → `archived_remote`, ecrit
  l'historyId SAUF si `truncated` (relire le reste au run suivant, dedup neutre).
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.config import settings
from app.db.client import scoped_connection
from app.db.google_connection import read_tokens
from app.services.google.errors import HistoryIdExpired
from app.services.google.gmail_client import GmailClient


def _header(message: dict, name: str) -> str | None:
    for h in message.get("payload", {}).get("headers", []):
        if h.get("name", "").lower() == name.lower():
            return h.get("value")
    return None


def _parse_message(message: dict) -> dict:
    internal = message.get("internalDate")
    date_reception = (
        datetime.fromtimestamp(int(internal) / 1000, tz=timezone.utc)
        if internal
        else None
    )
    labels = message.get("labelIds", [])
    return {
        "gmail_id": message["id"],
        "expediteur": _header(message, "From") or "",
        "sujet": _header(message, "Subject"),
        "extrait": (message.get("snippet") or "")[:2000],
        "date_reception": date_reception,
        "lu": "UNREAD" not in labels,
    }


async def fetch_gmail_changes(
    client: GmailClient, history_id: str | None, lookback_days: int, max_mails: int
) -> dict:
    """Recupere les changements Gmail (incremental) ou une fenetre bornee."""
    if history_id is None:
        return await _fetch_window(client, lookback_days, max_mails)
    try:
        return await _fetch_incremental(client, history_id, max_mails)
    except HistoryIdExpired:
        return await _fetch_window(client, lookback_days, max_mails)


async def _fetch_incremental(
    client: GmailClient, history_id: str, max_mails: int
) -> dict:
    added: list[str] = []
    deleted: set[str] = set()
    read_flags: dict[str, bool] = {}
    next_hid = history_id
    page_token: str | None = None
    while True:
        data = await client.list_history(history_id, page_token=page_token)
        next_hid = data.get("historyId") or next_hid
        for rec in data.get("history", []):
            for a in rec.get("messagesAdded", []):
                added.append(a["message"]["id"])
            for d in rec.get("messagesDeleted", []):
                deleted.add(d["message"]["id"])
            for lr in rec.get("labelsRemoved", []):
                if "UNREAD" in lr.get("labelIds", []):
                    read_flags[lr["message"]["id"]] = True
            for la in rec.get("labelsAdded", []):
                if "UNREAD" in la.get("labelIds", []):
                    read_flags[la["message"]["id"]] = False
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    new_ids = [mid for mid in dict.fromkeys(added) if mid not in deleted]
    truncated = len(new_ids) > max_mails
    new_messages = await _get_messages(client, new_ids[:max_mails])
    status_updates = [{"gmail_id": g, "deleted": True} for g in deleted]
    status_updates += [
        {"gmail_id": g, "lu": lu} for g, lu in read_flags.items() if g not in deleted
    ]
    return {
        "new_messages": new_messages,
        "status_updates": status_updates,
        "next_history_id": None if truncated else next_hid,
        "resync": False,
        "truncated": truncated,
    }


async def _fetch_window(client: GmailClient, lookback_days: int, max_mails: int) -> dict:
    ids: list[str] = []
    page_token: str | None = None
    while len(ids) < max_mails:
        data = await client.list_messages(
            f"newer_than:{lookback_days}d",
            page_token=page_token,
            max_results=min(100, max_mails - len(ids)),
        )
        ids.extend(m["id"] for m in data.get("messages", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    truncated = len(ids) > max_mails
    new_messages = await _get_messages(client, ids[:max_mails])
    # Point de reprise : historyId courant de la boite (getProfile) pour eviter
    # de resynchroniser toute la fenetre au prochain run.
    next_hid = None
    if not truncated:
        try:
            next_hid = (await client.get_profile()).get("historyId")
        except Exception:
            next_hid = None
    return {
        "new_messages": new_messages,
        "status_updates": [],
        "next_history_id": next_hid,
        "resync": True,
        "truncated": truncated,
    }


async def _get_messages(client: GmailClient, ids: list[str]) -> list[dict]:
    return [_parse_message(await client.get_message(mid)) for mid in ids]


async def store_new_mails(user_id: str, changes: dict) -> dict:
    """Insere/deduplique les mails + maj statuts + curseur, en UNE transaction."""
    new_ids: list[str] = []
    updated = 0
    async with scoped_connection(user_id) as conn:
        for m in changes.get("new_messages", []):
            row = await conn.fetchrow(
                """
                INSERT INTO mails
                    (user_id, gmail_id, expediteur, sujet, extrait, statut, lu,
                     date_reception)
                VALUES ($1, $2, $3, $4, $5, 'pending_triage', $6, $7)
                ON CONFLICT (user_id, gmail_id) DO NOTHING
                RETURNING id::text
                """,
                user_id, m["gmail_id"], m["expediteur"], m["sujet"],
                m["extrait"], m["lu"], m["date_reception"],
            )
            if row is not None:
                new_ids.append(row["id"])

        for u in changes.get("status_updates", []):
            if u.get("deleted"):
                res = await conn.execute(
                    "UPDATE mails SET statut = 'archived_remote', updated_at = now() "
                    "WHERE user_id = $1 AND gmail_id = $2 AND statut <> 'archived_remote'",
                    user_id, u["gmail_id"],
                )
            elif "lu" in u:
                res = await conn.execute(
                    "UPDATE mails SET lu = $3, updated_at = now() "
                    "WHERE user_id = $1 AND gmail_id = $2",
                    user_id, u["gmail_id"], u["lu"],
                )
            else:
                continue
            updated += 1 if res.endswith(" 1") else 0

        # Curseur avance SAUF si la reponse etait tronquee (reprise au run suivant).
        if not changes.get("truncated"):
            await conn.execute(
                "UPDATE google_connections SET gmail_history_id = COALESCE($2, "
                "gmail_history_id), gmail_synced_at = now(), updated_at = now() "
                "WHERE user_id = $1",
                user_id, changes.get("next_history_id"),
            )
        else:
            await conn.execute(
                "UPDATE google_connections SET gmail_synced_at = now(), "
                "updated_at = now() WHERE user_id = $1",
                user_id,
            )
    return {
        "new_mails": len(new_ids),
        "updated": updated,
        "new_mail_ids": new_ids,
        "resync": changes.get("resync", False),
    }


async def run_gmail_branch(user_id: str, state: dict) -> dict:
    """Orchestre la branche mails (sa propre connexion, son propre client)."""
    tokens = await read_tokens(user_id)
    if tokens is None or not tokens.get("access_token"):
        raise RuntimeError("Jetons Google indisponibles pour la branche mails.")
    client = GmailClient(tokens["access_token"])
    try:
        changes = await fetch_gmail_changes(
            client,
            state.get("gmail_history_id"),
            settings.gmail_lookback_days,
            settings.max_mails_per_sync,
        )
    finally:
        await client.aclose()
    return await store_new_mails(user_id, changes)
