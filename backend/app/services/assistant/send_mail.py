"""Envoi effectif d'un brouillon approuvé + réconciliation d'un envoi ambigu.

Classification stricte des échecs (corrections #1-#4 review Round 008) :
- échec PRÉ-TRANSMISSION (connexion refusée/DNS, jeton invalide, 4xx) -> le
  brouillon retourne en `pending_review` (rien n'est parti, l'utilisateur
  corrige et re-approuve) ;
- échec AMBIGU (timeout, 5xx, erreur inattendue) -> `sending_unconfirmed`,
  JAMAIS `pending_review` (le mail est peut-être parti). Par prudence, toute
  exception non identifiée est classée AMBIGUË (le pire cas est un renvoi
  bloqué en attente de réconciliation, jamais un double envoi).
"""

from __future__ import annotations

import logging

import httpx

from app.services.assistant.google_token import GoogleSendUnavailable, get_send_access_token
from app.services.google.errors import ReauthRequired
from app.services.google.gmail_client import (
    GmailClient,
    GmailSendAmbiguous,
    GmailSendRejected,
    build_rfc822,
)

logger = logging.getLogger("myday.assistant.send_mail")

_AMBIGUOUS_MESSAGE = (
    "L'envoi n'a pas pu être confirmé, nous vérifions avant d'autoriser un nouvel envoi."
)


def message_id_for(draft_id: str) -> str:
    """Marqueur d'idempotence déterministe (correction #2 review Round 008)."""
    return f"<myday-{draft_id}@myday>"


async def _fetch_in_reply_to(client: GmailClient, gmail_id: str | None) -> str | None:
    """Récupère le `Message-ID` du mail d'origine pour le threading (best-effort)."""
    if not gmail_id:
        return None
    try:
        detail = await client.get_message(gmail_id)
        headers = detail.get("payload", {}).get("headers", [])
        for header in headers:
            if header.get("name") == "Message-ID":
                return header.get("value")
    except Exception:
        logger.info("assistant_send: Message-ID d'origine introuvable, réponse non threadée")
    return None


async def attempt_send(
    user_id: str,
    draft_id: str,
    to: str,
    subject: str,
    body: str,
    origin_gmail_id: str | None,
) -> dict:
    """Tente l'envoi. Renvoie `{"ok", "ambiguous", "gmail_id", "message"}`."""
    try:
        access_token = await get_send_access_token(user_id)
    except GoogleSendUnavailable as exc:
        return {"ok": False, "ambiguous": False, "gmail_id": None, "message": str(exc)}

    client = GmailClient(access_token)
    try:
        in_reply_to = await _fetch_in_reply_to(client, origin_gmail_id)
        raw = build_rfc822(to, subject, body, message_id_for(draft_id), in_reply_to=in_reply_to)
        result = await client.send_message(raw)
        return {"ok": True, "ambiguous": False, "gmail_id": result.get("id"), "message": None}
    except ReauthRequired:
        return {
            "ok": False, "ambiguous": False, "gmail_id": None,
            "message": "Ta connexion Google a expiré, reconnecte-toi pour envoyer ce mail.",
        }
    except GmailSendRejected as exc:
        return {"ok": False, "ambiguous": False, "gmail_id": None, "message": str(exc)}
    except httpx.ConnectError:
        return {
            "ok": False, "ambiguous": False, "gmail_id": None,
            "message": "Impossible de joindre Gmail, rien n'a été envoyé. Réessaie.",
        }
    except (GmailSendAmbiguous, httpx.TimeoutException):
        return {"ok": False, "ambiguous": True, "gmail_id": None, "message": _AMBIGUOUS_MESSAGE}
    except Exception:
        logger.warning("assistant_send: échec inattendu à l'envoi, classé ambigu par prudence")
        return {"ok": False, "ambiguous": True, "gmail_id": None, "message": _AMBIGUOUS_MESSAGE}
    finally:
        await client.aclose()


async def reconcile_sent(user_id: str, draft_id: str) -> str | None:
    """Cherche le mail dans Envoyés via `rfc822msgid`. Renvoie le `gmail_id` si trouvé.

    Ne lève jamais : une erreur de réconciliation laisse le brouillon en
    `sending_unconfirmed` (l'utilisateur peut réessayer plus tard).
    """
    try:
        access_token = await get_send_access_token(user_id)
    except GoogleSendUnavailable:
        return None
    client = GmailClient(access_token)
    try:
        result = await client.list_messages(f"rfc822msgid:{message_id_for(draft_id)} in:sent")
        messages = result.get("messages") or []
        return messages[0]["id"] if messages else None
    except Exception:
        logger.info("assistant_send: réconciliation impossible pour draft=%s", draft_id)
        return None
    finally:
        await client.aclose()
