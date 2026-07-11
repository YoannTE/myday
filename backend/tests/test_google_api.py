"""Tests des endpoints Google : status non connecte, anti-spam sync, deconnexion.

TestClient (cookie de session Better-auth) ; la connexion Google de test est
posee via le repository (pool app_rls dedie). Aucun appel Google reel.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

import app.db.client as dbclient
from app.auth.cookie import COOKIE_NAME
from app.config import settings
from app.db import google_connection as repo
from app.services.google import oauth

from conftest import create_user, delete_user, make_session_for, sign_token


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


def run_in_loop(coro_factory):
    async def _runner():
        saved = dbclient._pool
        dbclient._pool = await asyncpg.create_pool(
            settings.backend_database_url, min_size=1, max_size=3
        )
        try:
            return await coro_factory()
        finally:
            await dbclient._pool.close()
            dbclient._pool = saved

    return asyncio.new_event_loop().run_until_complete(_runner())


def connection_exists(user_id: str) -> bool:
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            return bool(
                await conn.fetchval(
                    "SELECT 1 FROM google_connections WHERE user_id=$1", user_id
                )
            )
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


@pytest.fixture
def auth_user(client):
    uid = create_user(f"gapi-{uuid.uuid4().hex}@test.local")
    token = "gapi-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, sign_token(token)
    delete_user(uid)


def test_status_non_connecte_renvoie_connected_false(client, auth_user):
    uid, cookie = auth_user
    resp = client.get("/api/google/status", headers=_cookie(cookie))
    assert resp.status_code == 200
    assert resp.json()["data"]["connected"] is False


def test_status_connecte_expose_scopes_et_reauth(client, auth_user):
    uid, cookie = auth_user
    run_in_loop(
        lambda: repo.upsert_tokens(
            uid, access_token="at", refresh_token="rt",
            token_expiry=datetime.now(timezone.utc) + timedelta(hours=1),
            scopes=["https://www.googleapis.com/auth/calendar.events"],
        )
    )
    resp = client.get("/api/google/status", headers=_cookie(cookie))
    data = resp.json()["data"]
    assert data["connected"] is True
    assert data["reauth_required"] is False
    assert data["scopes"] == ["https://www.googleapis.com/auth/calendar.events"]


def test_sync_anti_spam_429(client, auth_user):
    uid, cookie = auth_user
    run_in_loop(
        lambda: repo.upsert_tokens(
            uid, access_token="at", refresh_token="rt",
            token_expiry=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    run_in_loop(lambda: repo.touch_manual_sync(uid))  # sync tout juste effectue
    resp = client.post("/api/google/sync", headers=_cookie(cookie))
    assert resp.status_code == 429


def test_sync_sans_connexion_400(client, auth_user):
    uid, cookie = auth_user
    resp = client.post("/api/google/sync", headers=_cookie(cookie))
    assert resp.status_code == 400


def test_delete_google_supprime_connexion(client, auth_user, monkeypatch):
    uid, cookie = auth_user
    run_in_loop(
        lambda: repo.upsert_tokens(
            uid, access_token="at", refresh_token="rt",
            token_expiry=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )

    async def _noop(_user_id):  # evite tout appel reseau reel de revocation
        return None

    monkeypatch.setattr(oauth, "revoke_token", _noop)
    resp = client.delete("/api/google", headers=_cookie(cookie))
    assert resp.status_code == 204
    assert connection_exists(uid) is False


def test_revoke_token_best_effort_ne_leve_jamais(monkeypatch):
    """Meme si la revocation Google echoue (reseau), revoke_token ne leve pas."""
    uid = create_user(f"revoke-{uuid.uuid4().hex}@test.local")
    try:
        run_in_loop(
            lambda: repo.upsert_tokens(
                uid, access_token="at", refresh_token="rt",
                token_expiry=datetime.now(timezone.utc),
            )
        )

        class _Boom:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, *a, **k):
                raise httpx_timeout()

        def httpx_timeout():
            import httpx

            return httpx.ConnectTimeout("boom")

        monkeypatch.setattr(oauth.httpx, "AsyncClient", _Boom)
        # Ne doit PAS lever malgre l'echec reseau.
        run_in_loop(lambda: oauth.revoke_token(uid))
    finally:
        delete_user(uid)
