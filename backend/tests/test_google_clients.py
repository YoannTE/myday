"""Tests des clients Google : mapping des codes HTTP + backoff 429/5xx.

httpx mocke via MockTransport, aucune BDD ni reseau reel.
"""

from __future__ import annotations

import asyncio
import base64

import httpx
import pytest

from app.services.google.calendar_client import CalendarClient
from app.services.google.errors import (
    DuplicateEvent,
    GoogleApiError,
    HistoryIdExpired,
    ReauthRequired,
    SyncTokenExpired,
)
from app.services.google.gmail_client import (
    GmailClient,
    GmailSendAmbiguous,
    GmailSendRejected,
    build_rfc822,
)


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


async def _instant_sleep(*_args, **_kwargs):
    """Remplace asyncio.sleep dans le backoff : ne dort pas (tests rapides)."""
    return None


def cal_client(handler) -> CalendarClient:
    return CalendarClient(
        "tok",
        http_client=httpx.AsyncClient(
            base_url="https://cal", transport=httpx.MockTransport(handler)
        ),
    )


def gmail_client(handler) -> GmailClient:
    return GmailClient(
        "tok",
        http_client=httpx.AsyncClient(
            base_url="https://gm", transport=httpx.MockTransport(handler)
        ),
    )


def test_calendar_list_401_leve_reauth():
    c = cal_client(lambda r: httpx.Response(401, json={}))
    with pytest.raises(ReauthRequired):
        run(c.list_events(sync_token="t"))


def test_calendar_list_410_leve_synctoken_expired():
    c = cal_client(lambda r: httpx.Response(410, json={}))
    with pytest.raises(SyncTokenExpired):
        run(c.list_events(sync_token="t"))


def test_calendar_insert_409_leve_duplicate():
    c = cal_client(lambda r: httpx.Response(409, json={}))
    with pytest.raises(DuplicateEvent):
        run(c.insert_event({"id": "abc"}))


def test_calendar_backoff_429_puis_succes(monkeypatch):
    import app.services.google.http as http_mod

    monkeypatch.setattr(http_mod.asyncio, "sleep", _instant_sleep)
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, json={})
        return httpx.Response(200, json={"items": [], "nextSyncToken": "S"})

    c = cal_client(handler)
    data = run(c.list_events(sync_token="t"))
    assert data["nextSyncToken"] == "S"
    assert calls["n"] == 3


def test_calendar_backoff_epuise_leve_erreur(monkeypatch):
    import app.services.google.http as http_mod

    monkeypatch.setattr(http_mod.asyncio, "sleep", _instant_sleep)
    c = cal_client(lambda r: httpx.Response(503, json={}))
    with pytest.raises(GoogleApiError):
        run(c.list_events(sync_token="t"))


def test_gmail_history_404_leve_history_expired():
    c = gmail_client(lambda r: httpx.Response(404, json={}))
    with pytest.raises(HistoryIdExpired):
        run(c.list_history("123"))


def test_gmail_401_leve_reauth():
    c = gmail_client(lambda r: httpx.Response(401, json={}))
    with pytest.raises(ReauthRequired):
        run(c.list_messages("newer_than:7d"))


# --- Envoi Gmail (Round 008) : send_message ne fait JAMAIS de retry ---------


def test_gmail_send_message_401_leve_reauth_sans_retry():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(401, json={})

    c = gmail_client(handler)
    with pytest.raises(ReauthRequired):
        run(c.send_message("raw"))
    assert calls["n"] == 1  # aucun retry sur un envoi


def test_gmail_send_message_4xx_leve_rejected_sans_retry():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(400, json={})

    c = gmail_client(handler)
    with pytest.raises(GmailSendRejected):
        run(c.send_message("raw"))
    assert calls["n"] == 1


def test_gmail_send_message_5xx_leve_ambiguous_sans_retry(monkeypatch):
    """Un 500 a l'envoi ne doit JAMAIS declencher le backoff automatique
    (google_request max_retries=0) : un retry pourrait doubler l'envoi."""
    import app.services.google.http as http_mod

    monkeypatch.setattr(http_mod.asyncio, "sleep", _instant_sleep)
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(500, json={})

    c = gmail_client(handler)
    with pytest.raises(GmailSendAmbiguous):
        run(c.send_message("raw"))
    assert calls["n"] == 1  # PAS de backoff/retry sur un envoi


def test_gmail_send_message_succes():
    c = gmail_client(lambda r: httpx.Response(200, json={"id": "msg-123"}))
    result = run(c.send_message("raw"))
    assert result["id"] == "msg-123"


def test_gmail_get_message_metadata_headers_inclut_message_id():
    captured = {}

    def handler(request):
        captured["headers"] = request.url.params.get_list("metadataHeaders")
        return httpx.Response(200, json={"id": "m1"})

    c = gmail_client(handler)
    run(c.get_message("m1"))
    assert "Message-ID" in captured["headers"]


def test_build_rfc822_pose_message_id_et_threading():
    raw = build_rfc822(
        "dest@ex.com", "Objet", "Corps du message",
        "<myday-abc@myday>", in_reply_to="<orig@gmail.com>",
    )
    decoded = base64.urlsafe_b64decode(raw.encode("ascii")).decode("utf-8")
    assert "Message-ID: <myday-abc@myday>" in decoded
    assert "In-Reply-To: <orig@gmail.com>" in decoded
    assert "References: <orig@gmail.com>" in decoded
    assert "To: dest@ex.com" in decoded
    assert "Corps du message" in decoded
