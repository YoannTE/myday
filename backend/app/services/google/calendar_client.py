"""Client Google Agenda (httpx). Lecture (events.list) + remontee (events.insert).

Ne rafraichit JAMAIS le jeton (le refresh est fait en amont par load_connection).
Interpretation des codes : 401 → ReauthRequired ; 410 → SyncTokenExpired ;
409 → DuplicateEvent (insert d'un id deja connu) ; autre >= 400 → GoogleApiError.
Le backoff 429/5xx est gere par `google_request`.
"""

from __future__ import annotations

import httpx

from app.services.google.constants import CALENDAR_BASE
from app.services.google.errors import (
    DuplicateEvent,
    GoogleApiError,
    ReauthRequired,
    SyncTokenExpired,
)
from app.services.google.http import google_request

_TIMEOUT = 30.0
_EVENTS_PATH = "/calendars/primary/events"


class CalendarClient:
    def __init__(self, access_token: str, http_client: httpx.AsyncClient | None = None):
        self._own = http_client is None
        self._client = http_client or httpx.AsyncClient(
            base_url=CALENDAR_BASE,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=_TIMEOUT,
        )

    async def aclose(self) -> None:
        if self._own:
            await self._client.aclose()

    async def list_events(
        self,
        *,
        sync_token: str | None = None,
        time_min: str | None = None,
        time_max: str | None = None,
        page_token: str | None = None,
    ) -> dict:
        """events.list : incremental (syncToken) ou fenetre bornee (timeMin/timeMax)."""
        params: dict[str, str] = {
            "maxResults": "250",
            "singleEvents": "true",
            "showDeleted": "true",
        }
        if sync_token:
            params["syncToken"] = sync_token
        else:
            if time_min:
                params["timeMin"] = time_min
            if time_max:
                params["timeMax"] = time_max
        if page_token:
            params["pageToken"] = page_token

        resp = await google_request(self._client, "GET", _EVENTS_PATH, params=params)
        self._raise_for_status(resp, allow_conflict=False)
        return resp.json()

    async def insert_event(self, body: dict) -> dict:
        """events.insert : remontee d'un evenement local (id client deterministe)."""
        resp = await google_request(self._client, "POST", _EVENTS_PATH, json=body)
        self._raise_for_status(resp, allow_conflict=True)
        return resp.json()

    async def update_event(self, event_id: str, body: dict) -> dict:
        """events.patch : propage une modification locale vers Google Agenda."""
        resp = await google_request(
            self._client, "PATCH", f"{_EVENTS_PATH}/{event_id}", json=body
        )
        self._raise_for_status(resp, allow_conflict=False)
        return resp.json()

    async def delete_event(self, event_id: str) -> None:
        """events.delete : tolere 404/410 (evenement deja absent cote Google)."""
        resp = await google_request(self._client, "DELETE", f"{_EVENTS_PATH}/{event_id}")
        if resp.status_code in (404, 410):
            return
        if resp.status_code == 401:
            raise ReauthRequired("Jeton Google Agenda invalide (401).")
        if resp.status_code >= 400:
            raise GoogleApiError(f"Erreur Google Agenda ({resp.status_code}).")

    @staticmethod
    def _raise_for_status(resp: httpx.Response, *, allow_conflict: bool) -> None:
        if resp.status_code == 401:
            raise ReauthRequired("Jeton Google Agenda invalide (401).")
        if resp.status_code == 410:
            raise SyncTokenExpired("syncToken Agenda expire (410).")
        if resp.status_code == 409 and allow_conflict:
            raise DuplicateEvent("Evenement deja present cote Google (409).")
        if resp.status_code >= 400:
            raise GoogleApiError(f"Erreur Google Agenda ({resp.status_code}).")
