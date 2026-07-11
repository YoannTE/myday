"""Tests des endpoints Events : CRUD local + synchronisation best-effort Google.

Google est mocke au niveau du client (`CalendarClient.insert_event/update_event/
delete_event`) : aucun appel reseau reel. Les connexions Google de test sont
posees via le repository (pool `app_rls` dedie), comme dans test_google_api.py.
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
from app.services.google.calendar_client import CalendarClient
from app.services.google.errors import GoogleApiError

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


@pytest.fixture
def auth_user(client):
    uid = create_user(f"events-{uuid.uuid4().hex}@test.local")
    token = "events-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, sign_token(token)
    delete_user(uid)


def connect_google(user_id: str) -> None:
    run_in_loop(
        lambda: repo.upsert_tokens(
            user_id,
            access_token="at",
            refresh_token="rt",
            token_expiry=datetime.now(timezone.utc) + timedelta(hours=1),
            scopes=["https://www.googleapis.com/auth/calendar.events"],
        )
    )


def event_field(event_id: str, field: str):
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            return await conn.fetchval(
                f"SELECT {field} FROM events WHERE id = $1::uuid", event_id
            )
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


def _payload(*, hours_from_now: float = 1, duration_hours: float = 1, **extra) -> dict:
    debut = datetime.now(timezone.utc) + timedelta(hours=hours_from_now)
    fin = debut + timedelta(hours=duration_hours)
    body = {"titre": "Reunion", "debut": debut.isoformat(), "fin": fin.isoformat()}
    body.update(extra)
    return body


def _other_user_cookie(prefix: str):
    other_uid = create_user(f"{prefix}-{uuid.uuid4().hex}@test.local")
    other_token = f"{prefix}-" + uuid.uuid4().hex
    make_session_for(other_uid, other_token, datetime.now(timezone.utc) + timedelta(days=1))
    return other_uid, sign_token(other_token)


# --- Validation fin > debut ---


def test_creation_fin_avant_debut_400(client, auth_user):
    _, cookie = auth_user
    debut = datetime.now(timezone.utc) + timedelta(hours=2)
    fin = debut - timedelta(hours=1)
    resp = client.post(
        "/api/events",
        json={"titre": "x", "debut": debut.isoformat(), "fin": fin.isoformat()},
        headers=_cookie(cookie),
    )
    assert resp.status_code == 400


def test_patch_fin_avant_debut_400(client, auth_user):
    _, cookie = auth_user
    created = client.post("/api/events", json=_payload(), headers=_cookie(cookie)).json()["data"]
    debut = datetime.fromisoformat(created["debut"])
    resp = client.patch(
        f"/api/events/{created['id']}",
        json={"fin": (debut - timedelta(hours=1)).isoformat()},
        headers=_cookie(cookie),
    )
    assert resp.status_code == 400


# --- Creation sans connexion Google ---


def test_creation_sans_google_synced_sans_push(client, auth_user):
    _, cookie = auth_user
    resp = client.post("/api/events", json=_payload(), headers=_cookie(cookie))
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["sync_status"] == "synced"
    assert data["google_event_id"] is None


# --- Creation avec Google connecte ---


def test_creation_avec_google_push_reussi(client, auth_user, monkeypatch):
    uid, cookie = auth_user
    connect_google(uid)

    async def fake_insert(self, body):
        return {"id": body["id"]}

    monkeypatch.setattr(CalendarClient, "insert_event", fake_insert)

    resp = client.post("/api/events", json=_payload(), headers=_cookie(cookie))
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["sync_status"] == "synced"
    assert data["google_event_id"] is not None


def test_creation_avec_google_push_echoue_reste_pending(client, auth_user, monkeypatch):
    uid, cookie = auth_user
    connect_google(uid)

    async def fake_insert(self, body):
        raise GoogleApiError("boom")

    monkeypatch.setattr(CalendarClient, "insert_event", fake_insert)

    resp = client.post("/api/events", json=_payload(), headers=_cookie(cookie))
    assert resp.status_code == 201
    assert resp.json()["data"]["sync_status"] == "sync_pending"


def test_creation_avec_verrou_pose_reste_pending(client, auth_user):
    uid, cookie = auth_user
    connect_google(uid)
    run_in_loop(lambda: repo.acquire_sync_lock(uid))  # simule un run concurrent

    resp = client.post("/api/events", json=_payload(), headers=_cookie(cookie))
    assert resp.status_code == 201
    assert resp.json()["data"]["sync_status"] == "sync_pending"


def test_creation_avec_reauth_required_reste_pending(client, auth_user):
    uid, cookie = auth_user
    connect_google(uid)
    run_in_loop(lambda: repo.set_reauth_required(uid))

    resp = client.post("/api/events", json=_payload(), headers=_cookie(cookie))
    assert resp.status_code == 201
    assert resp.json()["data"]["sync_status"] == "sync_pending"


# --- Mise a jour ---


def test_patch_event_synced_appelle_update_event(client, auth_user, monkeypatch):
    uid, cookie = auth_user
    connect_google(uid)
    calls: list = []

    async def fake_insert(self, body):
        return {"id": body["id"]}

    async def fake_update(self, event_id, body):
        calls.append((event_id, body))
        return {"id": event_id}

    monkeypatch.setattr(CalendarClient, "insert_event", fake_insert)
    monkeypatch.setattr(CalendarClient, "update_event", fake_update)

    created = client.post("/api/events", json=_payload(), headers=_cookie(cookie)).json()["data"]
    assert created["sync_status"] == "synced"

    resp = client.patch(
        f"/api/events/{created['id']}",
        json={"titre": "Titre modifie"},
        headers=_cookie(cookie),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["titre"] == "Titre modifie"
    assert len(calls) == 1


def test_patch_event_non_synchronise_ne_touche_pas_google(client, auth_user, monkeypatch):
    _, cookie = auth_user

    def boom(*a, **k):
        raise AssertionError("update_event ne doit pas etre appele")

    monkeypatch.setattr(CalendarClient, "update_event", boom)

    created = client.post("/api/events", json=_payload(), headers=_cookie(cookie)).json()["data"]
    resp = client.patch(
        f"/api/events/{created['id']}",
        json={"titre": "Renomme"},
        headers=_cookie(cookie),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["titre"] == "Renomme"


def test_patch_event_cross_user_404(client, auth_user):
    _, cookie = auth_user
    other_uid, other_cookie = _other_user_cookie("events-other")
    try:
        created = client.post("/api/events", json=_payload(), headers=_cookie(cookie)).json()["data"]
        resp = client.patch(
            f"/api/events/{created['id']}",
            json={"titre": "hack"},
            headers=_cookie(other_cookie),
        )
        assert resp.status_code == 404
    finally:
        delete_user(other_uid)


# --- Suppression ---


def test_delete_event_best_effort_google_down(client, auth_user, monkeypatch):
    uid, cookie = auth_user
    connect_google(uid)

    async def fake_insert(self, body):
        return {"id": body["id"]}

    async def fake_delete(self, event_id):
        raise GoogleApiError("google down")

    monkeypatch.setattr(CalendarClient, "insert_event", fake_insert)
    monkeypatch.setattr(CalendarClient, "delete_event", fake_delete)

    created = client.post("/api/events", json=_payload(), headers=_cookie(cookie)).json()["data"]
    resp = client.delete(f"/api/events/{created['id']}", headers=_cookie(cookie))
    assert resp.status_code == 204
    assert event_field(created["id"], "id") is None  # supprime localement malgre Google down


def test_delete_event_cross_user_404(client, auth_user):
    _, cookie = auth_user
    other_uid, other_cookie = _other_user_cookie("events-del")
    try:
        created = client.post("/api/events", json=_payload(), headers=_cookie(cookie)).json()["data"]
        resp = client.delete(f"/api/events/{created['id']}", headers=_cookie(other_cookie))
        assert resp.status_code == 404
    finally:
        delete_user(other_uid)


# --- Idempotence du push (double push meme client_uuid => zero doublon) ---


def test_push_local_events_ne_repousse_pas_un_event_deja_synced(client, auth_user, monkeypatch):
    uid, cookie = auth_user
    connect_google(uid)

    async def fake_insert(self, body):
        return {"id": body["id"]}

    monkeypatch.setattr(CalendarClient, "insert_event", fake_insert)

    created = client.post("/api/events", json=_payload(), headers=_cookie(cookie)).json()["data"]
    assert created["sync_status"] == "synced"

    from app.services.google.sync import push_local_events

    result = run_in_loop(lambda: push_local_events(uid))
    assert result == {"pushed": 0, "failed": 0}


# --- Liste + RLS ---


def test_list_events_filtre_par_plage_et_rls(client, auth_user):
    _, cookie = auth_user
    other_uid, other_cookie = _other_user_cookie("events-list")
    try:
        near = client.post(
            "/api/events", json=_payload(hours_from_now=1), headers=_cookie(cookie)
        ).json()["data"]
        far = client.post(
            "/api/events", json=_payload(hours_from_now=100), headers=_cookie(cookie)
        ).json()["data"]
        client.post(
            "/api/events", json=_payload(hours_from_now=1), headers=_cookie(other_cookie)
        )

        window_from = datetime.now(timezone.utc)
        window_to = window_from + timedelta(hours=10)
        resp = client.get(
            "/api/events",
            params={"from": window_from.isoformat(), "to": window_to.isoformat()},
            headers=_cookie(cookie),
        )
        assert resp.status_code == 200
        ids = [e["id"] for e in resp.json()["data"]]
        assert near["id"] in ids
        assert far["id"] not in ids
    finally:
        delete_user(other_uid)
