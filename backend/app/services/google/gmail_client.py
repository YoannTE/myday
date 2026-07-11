"""Client Gmail (httpx). Lecture (history.list, messages.list/get, profile) +
envoi (messages.send, ajouté Round 008).

MyDay ne supprime ni ne modifie JAMAIS un message Gmail existant : ce client
n'expose aucune méthode de suppression. L'envoi est un effet externe
IRRÉVERSIBLE : `send_message` ne fait JAMAIS de retry (`max_retries=0`) - un
retry automatique sur un timeout/5xx pourrait doubler l'envoi d'un mail. La
classification pré-transmission/ambiguë d'un échec est à la charge de
l'appelant (`app.services.assistant.send_mail`), via les exceptions distinctes
`GmailSendRejected` (4xx, rien n'est parti) et `GmailSendAmbiguous` (5xx,
peut-être parti - jamais de renvoi automatique).
"""

from __future__ import annotations

import base64
from email.message import EmailMessage

import httpx

from app.services.google.constants import GMAIL_BASE
from app.services.google.errors import GoogleApiError, HistoryIdExpired, ReauthRequired
from app.services.google.http import google_request

_TIMEOUT = 30.0
_HISTORY_TYPES = ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"]
# Message-ID est nécessaire à la réconciliation d'un envoi ambigu (recherche
# `rfc822msgid:...`) ET au threading `In-Reply-To`/`References` d'une réponse
# (correction #5 review Round 008).
_METADATA_HEADERS = ["From", "Subject", "Date", "Message-ID"]


class GmailSendRejected(GoogleApiError):
    """Envoi refusé par Gmail (4xx) : le mail n'est PAS parti, correction possible."""


class GmailSendAmbiguous(GoogleApiError):
    """Erreur serveur Gmail (5xx) à l'envoi : le mail est PEUT-ÊTRE parti - jamais
    de renvoi automatique, seule la réconciliation par `rfc822msgid` tranche."""


def build_rfc822(
    to: str,
    subject: str,
    body: str,
    message_id: str,
    in_reply_to: str | None = None,
) -> str:
    """Construit un message RFC822 encodé en base64url (format `raw` attendu par
    Gmail `messages.send`). Pose un `Message-ID` déterministe (dérivé du
    `draft_id` par l'appelant) qui sert de marqueur d'idempotence pour la
    réconciliation d'un envoi ambigu (correction #2 review Round 008)."""
    msg = EmailMessage()
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = message_id
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    msg.set_content(body)
    return base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")


class GmailClient:
    def __init__(self, access_token: str, http_client: httpx.AsyncClient | None = None):
        self._own = http_client is None
        self._client = http_client or httpx.AsyncClient(
            base_url=GMAIL_BASE,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=_TIMEOUT,
        )

    async def aclose(self) -> None:
        if self._own:
            await self._client.aclose()

    async def list_history(
        self, start_history_id: str, *, page_token: str | None = None
    ) -> dict:
        """history.list incremental. 404 → HistoryIdExpired (curseur trop ancien)."""
        params: dict = {
            "startHistoryId": start_history_id,
            "historyTypes": _HISTORY_TYPES,
        }
        if page_token:
            params["pageToken"] = page_token
        resp = await google_request(
            self._client, "GET", "/users/me/history", params=params
        )
        if resp.status_code == 404:
            raise HistoryIdExpired("historyId Gmail expire (404).")
        self._raise_for_status(resp)
        return resp.json()

    async def list_messages(
        self, query: str, *, page_token: str | None = None, max_results: int = 100
    ) -> dict:
        """messages.list bornee par une requete (ex. newer_than:7d, rfc822msgid:...)."""
        params: dict = {"q": query, "maxResults": max_results}
        if page_token:
            params["pageToken"] = page_token
        resp = await google_request(
            self._client, "GET", "/users/me/messages", params=params
        )
        self._raise_for_status(resp)
        return resp.json()

    async def get_message(self, message_id: str) -> dict:
        """messages.get format metadata (en-tetes + snippet, pas de corps complet)."""
        params: dict = {
            "format": "metadata",
            "metadataHeaders": _METADATA_HEADERS,
        }
        resp = await google_request(
            self._client, "GET", f"/users/me/messages/{message_id}", params=params
        )
        self._raise_for_status(resp)
        return resp.json()

    async def get_profile(self) -> dict:
        """getProfile : sert a poser un historyId de depart lors d'un resync."""
        resp = await google_request(self._client, "GET", "/users/me/profile")
        self._raise_for_status(resp)
        return resp.json()

    async def send_message(self, raw_base64url: str) -> dict:
        """messages.send : envoie un message RFC822 déjà encodé en base64url.

        JAMAIS de retry (`max_retries=0`) : un retry automatique sur un
        timeout/5xx pourrait doubler l'envoi (effet externe irréversible).
        401 -> `ReauthRequired` (rien n'est parti) ; 4xx -> `GmailSendRejected`
        (rien n'est parti) ; 5xx -> `GmailSendAmbiguous` (peut-être parti,
        jamais de renvoi automatique - réconciliation par `rfc822msgid`).
        """
        resp = await google_request(
            self._client,
            "POST",
            "/users/me/messages/send",
            json={"raw": raw_base64url},
            max_retries=0,
        )
        if resp.status_code == 401:
            raise ReauthRequired("Jeton Gmail invalide (401).")
        if 400 <= resp.status_code < 500:
            raise GmailSendRejected(f"Envoi Gmail refuse ({resp.status_code}).")
        if resp.status_code >= 500:
            raise GmailSendAmbiguous(f"Erreur serveur Gmail a l'envoi ({resp.status_code}).")
        return resp.json()

    @staticmethod
    def _raise_for_status(resp: httpx.Response) -> None:
        if resp.status_code == 401:
            raise ReauthRequired("Jeton Gmail invalide (401).")
        if resp.status_code >= 400:
            raise GoogleApiError(f"Erreur Gmail ({resp.status_code}).")
