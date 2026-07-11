"""Décision hors-ligne sur un brouillon de mail : approuver (envoie) ou
refuser. Règle métier absolue : aucun mail ne part sans un `decision=approve`
explicite passé par ce service - JAMAIS depuis le moteur de conversation.

Garantie « au plus un envoi » : transition atomique
`UPDATE ... WHERE statut = 'pending_review'` (0 ligne affectée = déjà traité,
409) + réconciliation `sending_unconfirmed` par `rfc822msgid` avant tout
renvoi (corrections #3/#4 review Round 008). RLS via `scoped_connection` :
un brouillon d'un autre utilisateur n'est jamais visible (404).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.config import settings
from app.db.client import scoped_connection
from app.services.assistant.send_mail import attempt_send, reconcile_sent
from app.utils.errors import conflict, forbidden, not_found

_COLUMNS = (
    "id::text, destinataire, objet, corps, statut, sent_gmail_id, "
    "mail_origine_id::text, created_at, updated_at"
)


async def _fetch_draft(user_id: str, draft_id: str) -> dict | None:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM mail_drafts WHERE id = $1::uuid AND user_id = $2",
            draft_id, user_id,
        )
    return dict(row) if row is not None else None


async def _expire_if_needed(user_id: str, draft: dict) -> dict:
    """Marque `expired` un brouillon `pending_review` trop ancien (correction #12)."""
    if draft["statut"] != "pending_review":
        return draft
    limite = timedelta(hours=settings.assistant_hitl_timeout_hours)
    created_at = draft["created_at"]
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created_at <= limite:
        return draft
    updated = await _transition(user_id, draft["id"], "pending_review", "expired")
    return updated if updated is not None else draft


async def _transition(user_id: str, draft_id: str, frm: str, to: str) -> dict | None:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"UPDATE mail_drafts SET statut = $3, updated_at = now() "
            f"WHERE id = $1::uuid AND user_id = $2 AND statut = $4 "
            f"RETURNING {_COLUMNS}",
            draft_id, user_id, to, frm,
        )
    return dict(row) if row is not None else None


async def get_draft(user_id: str, draft_id: str) -> dict | None:
    draft = await _fetch_draft(user_id, draft_id)
    if draft is None:
        return None
    return await _expire_if_needed(user_id, draft)


async def reject_draft(user_id: str, draft_id: str) -> dict:
    draft = await get_draft(user_id, draft_id)
    if draft is None:
        raise not_found("Brouillon introuvable.")
    if draft["statut"] == "rejected":
        return {"statut": "rejected"}
    updated = await _transition(user_id, draft_id, "pending_review", "rejected")
    if updated is None:
        raise conflict("Ce brouillon a déjà été traité, il ne peut plus être refusé.")
    return {"statut": "rejected"}


async def approve_draft(user_id: str, draft_id: str, edited: dict | None) -> dict:
    if not settings.assistant_allow_email_send:
        raise forbidden("L'envoi de mails est désactivé pour le moment.")

    draft = await get_draft(user_id, draft_id)
    if draft is None:
        raise not_found("Brouillon introuvable.")

    if draft["statut"] == "sending_unconfirmed":
        return await _handle_reconciliation(user_id, draft, edited)

    if draft["statut"] != "pending_review":
        raise conflict(_already_treated_message(draft["statut"]))

    locked = await _transition(user_id, draft_id, "pending_review", "sending")
    if locked is None:
        raise conflict("Ce brouillon vient d'être traité par ailleurs.")

    return await _send_and_persist(user_id, locked, edited)


async def _handle_reconciliation(user_id: str, draft: dict, edited: dict | None) -> dict:
    """Un envoi précédent est ambigu : vérifie dans Envoyés avant tout renvoi
    (correction #4 review Round 008) - JAMAIS de renvoi si déjà parti."""
    found_id = await reconcile_sent(user_id, draft["id"])
    if found_id is not None:
        await _mark_sent(user_id, draft, found_id)
        return {"statut": "sent", "sent_gmail_id": found_id}

    resent = await _transition(user_id, draft["id"], "sending_unconfirmed", "sending")
    if resent is None:
        raise conflict("Ce brouillon vient d'être traité par ailleurs.")
    return await _send_and_persist(user_id, resent, edited)


async def _send_and_persist(user_id: str, draft: dict, edited: dict | None) -> dict:
    edited = edited or {}
    to = edited.get("to") or draft["destinataire"]
    subject = edited.get("subject") or draft["objet"] or ""
    body = edited.get("body") or draft["corps"]

    origin_gmail_id = await _origin_gmail_id(user_id, draft.get("mail_origine_id"))
    result = await attempt_send(user_id, draft["id"], to, subject, body, origin_gmail_id)

    if result["ok"]:
        await _mark_sent(user_id, draft, result["gmail_id"])
        return {"statut": "sent", "sent_gmail_id": result["gmail_id"]}

    if result["ambiguous"]:
        await _transition(user_id, draft["id"], "sending", "sending_unconfirmed")
        return {"statut": "sending_unconfirmed", "message": result["message"]}

    await _transition(user_id, draft["id"], "sending", "pending_review")
    return {"statut": "pending_review", "message": result["message"]}


async def _mark_sent(user_id: str, draft: dict, gmail_id: str | None) -> None:
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            "UPDATE mail_drafts SET statut = 'sent', sent_gmail_id = $3, "
            "updated_at = now() WHERE id = $1::uuid AND user_id = $2",
            draft["id"], user_id, gmail_id,
        )
        if draft.get("mail_origine_id"):
            await conn.execute(
                "UPDATE mails SET repondu = true, updated_at = now() "
                "WHERE id = $1::uuid AND user_id = $2",
                draft["mail_origine_id"], user_id,
            )
            await conn.execute(
                "INSERT INTO usage_events (user_id, type) VALUES ($1, 'mail_replied')",
                user_id,
            )


async def _origin_gmail_id(user_id: str, mail_origine_id: str | None) -> str | None:
    if not mail_origine_id:
        return None
    async with scoped_connection(user_id) as conn:
        return await conn.fetchval(
            "SELECT gmail_id FROM mails WHERE id = $1::uuid AND user_id = $2",
            mail_origine_id, user_id,
        )


def _already_treated_message(statut: str) -> str:
    if statut == "expired":
        return "Ce brouillon a expiré, il ne peut plus être envoyé."
    return "Ce brouillon a déjà été traité."
