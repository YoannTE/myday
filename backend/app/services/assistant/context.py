"""`load_context` — charge l'historique récent, le fuseau utilisateur et la
donnée référencée (`context_ref`) avant de planifier la demande.

Sécurité : `conversation_id` doit appartenir à `user_id` (sinon 404 propre,
jamais de fuite). `context_ref.mail_id`/`event_id` sont vérifiés appartenir à
`user_id` ; un id invalide (mauvais UUID) ou étranger est simplement ignoré
(jamais de crash, jamais d'accès croisé) - validé en Python AVANT toute
requête SQL pour ne pas faire échouer la transaction en cours.
"""

from __future__ import annotations

import logging
from uuid import UUID

from app.config import settings
from app.db.client import scoped_connection
from app.utils.errors import not_found

logger = logging.getLogger("myday.assistant.context")

_HISTORY_LIMIT = 10


def _valid_uuid(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(UUID(value))
    except (ValueError, AttributeError, TypeError):
        return None


async def load_context(
    user_id: str, conversation_id: str, context_ref: dict | None
) -> dict:
    context_ref = context_ref or {}
    mail_id = _valid_uuid(context_ref.get("mail_id"))
    event_id = _valid_uuid(context_ref.get("event_id"))

    async with scoped_connection(user_id) as conn:
        conversation_exists = await conn.fetchval(
            "SELECT 1 FROM assistant_conversations WHERE id = $1::uuid AND user_id = $2",
            conversation_id,
            user_id,
        )
        if not conversation_exists:
            raise not_found("Conversation introuvable.")

        rows = await conn.fetch(
            """
            SELECT role, contenu, created_at FROM assistant_conversation_turns
            WHERE conversation_id = $1::uuid
            ORDER BY created_at DESC LIMIT $2
            """,
            conversation_id,
            _HISTORY_LIMIT,
        )
        history = [
            {"role": r["role"], "content": r["contenu"]} for r in reversed(rows)
        ]

        prefs = await conn.fetchrow(
            "SELECT timezone FROM user_preferences WHERE user_id = $1", user_id
        )
        timezone_str = prefs["timezone"] if prefs else settings.app_timezone

        ref_data: dict = {}
        if mail_id:
            mail_row = await conn.fetchrow(
                "SELECT id::text, expediteur, sujet, extrait FROM mails "
                "WHERE id = $1::uuid AND user_id = $2",
                mail_id,
                user_id,
            )
            if mail_row is not None:
                ref_data["mail"] = dict(mail_row)
            else:
                logger.info("assistant context_ref mail_id ignoré (étranger ou absent)")
        if event_id:
            event_row = await conn.fetchrow(
                "SELECT id::text, titre, debut, fin, lieu FROM events "
                "WHERE id = $1::uuid AND user_id = $2",
                event_id,
                user_id,
            )
            if event_row is not None:
                ref_data["event"] = dict(event_row)
            else:
                logger.info("assistant context_ref event_id ignoré (étranger ou absent)")

    return {"history": history, "ref_data": ref_data, "timezone": timezone_str}
