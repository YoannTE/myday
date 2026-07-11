"""Jeton d'accès Google dédié à l'envoi de mail assistant (Round 008).

Correction #8 (review) : `load_connection`/`_connected_client` (socle Round
003/`events_google`) posent le verrou de synchronisation Agenda - les
réutiliser pour l'envoi bloquerait/serait bloqué par une sync en cours pour
une raison sans rapport. `get_send_access_token` relit/rafraîchit le jeton
(single-flight via `app.services.google.oauth.refresh_access_token`) SANS
jamais toucher au verrou de sync.
"""

from __future__ import annotations

from app.db.google_connection import read_tokens
from app.services.google.oauth import needs_refresh, refresh_access_token

_NON_CONNECTE = "Connecte ton compte Google pour envoyer ce mail."
_REAUTH = "Ta connexion Google a expiré, reconnecte-toi pour envoyer ce mail."


class GoogleSendUnavailable(Exception):
    """Levée quand aucun envoi Gmail n'est possible (non connecté / reauth requise).

    Traitée comme un échec PRÉ-transmission par `app.services.assistant.send_mail`
    (le mail n'a jamais quitté MyDay) : le brouillon reste/retourne en
    `pending_review`."""


async def get_send_access_token(user_id: str) -> str:
    """Renvoie un jeton d'accès Google valide pour l'envoi d'un mail assistant."""
    tokens = await read_tokens(user_id)
    if tokens is None:
        raise GoogleSendUnavailable(_NON_CONNECTE)
    if tokens.get("status") == "reauth_required":
        raise GoogleSendUnavailable(_REAUTH)

    if needs_refresh(tokens.get("token_expiry")):
        ok = await refresh_access_token(user_id)
        if not ok:
            raise GoogleSendUnavailable(_REAUTH)
        tokens = await read_tokens(user_id)

    access_token = tokens.get("access_token") if tokens else None
    if not access_token:
        raise GoogleSendUnavailable(_NON_CONNECTE)
    return access_token
