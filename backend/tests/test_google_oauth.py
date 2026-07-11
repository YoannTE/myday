"""Tests OAuth Google : echange, refresh single-flight, invalid_grant -> reauth.

httpx est mocke via `MockTransport` (aucun appel reseau reel). La BDD est reelle
(pool app_rls dedie a une loop neuve, comme test_google_connection).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import asyncpg
import httpx
import pytest

import app.db.client as dbclient
from app.config import settings
from app.db import google_connection as repo
from app.services.google import oauth

from conftest import create_user, delete_user


def run_in_loop(coro_factory):
    """Execute une coroutine avec un pool app_rls dedie a UNE loop (single-flight)."""

    async def _runner():
        saved = dbclient._pool
        dbclient._pool = await asyncpg.create_pool(
            settings.backend_database_url, min_size=1, max_size=4
        )
        try:
            return await coro_factory()
        finally:
            await dbclient._pool.close()
            dbclient._pool = saved

    return asyncio.new_event_loop().run_until_complete(_runner())


def mock_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture
def user_id():
    uid = create_user(f"oauth-{datetime.now().timestamp()}@test.local")
    yield uid
    delete_user(uid)


def test_exchange_code_stocke_les_jetons(user_id):
    """Un echange reussi stocke les jetons chiffres + expiry + scopes."""

    def handler(request: httpx.Request) -> httpx.Response:
        assert "code" in request.content.decode()
        return httpx.Response(
            200,
            json={
                "access_token": "at-1",
                "refresh_token": "rt-1",
                "expires_in": 3600,
                "scope": "https://www.googleapis.com/auth/calendar.events "
                "https://www.googleapis.com/auth/gmail.readonly",
            },
        )

    async def scenario():
        async with mock_client(handler) as hc:
            return await oauth.exchange_code(user_id, "code-x", "verifier-x", http_client=hc)

    result = run_in_loop(scenario)
    assert result["status"] == "connected"
    tokens = run_in_loop(lambda: repo.read_tokens(user_id))
    assert tokens["access_token"] == "at-1"
    assert tokens["refresh_token"] == "rt-1"
    assert tokens["token_expiry"] > datetime.now(timezone.utc)


def test_exchange_code_erreur_google_leve_valueerror(user_id):
    """Google refuse l'echange -> ValueError (mappe en 400 par l'endpoint)."""

    def handler(request):
        return httpx.Response(400, json={"error": "invalid_grant",
                                         "error_description": "Bad code"})

    async def scenario():
        async with mock_client(handler) as hc:
            return await oauth.exchange_code(user_id, "c", "v", http_client=hc)

    with pytest.raises(ValueError):
        run_in_loop(scenario)


def test_refresh_single_flight_un_seul_appel_http(user_id):
    """Deux refresh concurrents -> un seul echange reseau (single-flight)."""
    past = datetime.now(timezone.utc) - timedelta(minutes=10)
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(200, json={"access_token": "at-new", "expires_in": 3600})

    async def scenario():
        await repo.upsert_tokens(
            user_id, access_token="at-old", refresh_token="rt-1", token_expiry=past
        )
        async with mock_client(handler) as hc:
            a, b = await asyncio.gather(
                oauth.refresh_access_token(user_id, http_client=hc),
                oauth.refresh_access_token(user_id, http_client=hc),
            )
        return a, b

    a, b = run_in_loop(scenario)
    assert a is True and b is True
    assert calls["n"] == 1  # le second appel reutilise le jeton rafraichi


def test_refresh_invalid_grant_marque_reauth_une_fois(user_id):
    """invalid_grant -> reauth_required ; concurrent -> un seul appel HTTP."""
    past = datetime.now(timezone.utc) - timedelta(minutes=10)
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(400, json={"error": "invalid_grant"})

    async def scenario():
        await repo.upsert_tokens(
            user_id, access_token="at", refresh_token="rt", token_expiry=past
        )
        async with mock_client(handler) as hc:
            a, b = await asyncio.gather(
                oauth.refresh_access_token(user_id, http_client=hc),
                oauth.refresh_access_token(user_id, http_client=hc),
            )
        return a, b

    a, b = run_in_loop(scenario)
    assert a is False and b is False
    assert calls["n"] == 1  # le second voit reauth_required et court-circuite
    meta = run_in_loop(lambda: repo.get_connection(user_id))
    assert meta["status"] == "reauth_required"


def test_refresh_sans_refresh_token_marque_reauth(user_id):
    """Absence de refresh_token -> reauth_required, aucun appel reseau."""

    async def scenario():
        await repo.upsert_tokens(
            user_id,
            access_token="at",
            refresh_token=None,
            token_expiry=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        return await oauth.refresh_access_token(user_id)

    assert run_in_loop(scenario) is False
    meta = run_in_loop(lambda: repo.get_connection(user_id))
    assert meta["status"] == "reauth_required"
