"""Tests des endpoints notifications (Round 009) : liste filtrée par `lue`,
marquage lu (tous / ids ciblés), compteur non-lues, isolation RLS
cross-utilisateur, 401 sans cookie.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from app.auth.cookie import COOKIE_NAME
from app.config import settings

from conftest import create_user, delete_user, make_session_for, run_async, sign_token


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"notif-{uuid.uuid4().hex}@test.local")
    token = "notif-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


async def _insert_notification(user_id: str, type_notif: str, contenu: str, lue: bool) -> str:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "INSERT INTO notifications (user_id, type, contenu, ref_id, lue) "
            "VALUES ($1, $2, $3, gen_random_uuid(), $4) RETURNING id::text",
            user_id, type_notif, contenu, lue,
        )
    finally:
        await conn.close()


def insert_notification(user_id: str, type_notif="brief_pret", contenu="Test", lue=False) -> str:
    return run_async(_insert_notification(user_id, type_notif, contenu, lue))


async def _notification_lue(notif_id: str) -> bool:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "SELECT lue FROM notifications WHERE id = $1::uuid", notif_id
        )
    finally:
        await conn.close()


def notification_lue(notif_id: str) -> bool:
    return run_async(_notification_lue(notif_id))


# --- 401 sans cookie ---


def test_list_notifications_sans_cookie_401(client):
    assert client.get("/api/notifications").status_code == 401


def test_mark_read_sans_cookie_401(client):
    assert client.post("/api/notifications/read").status_code == 401


def test_unread_count_sans_cookie_401(client):
    assert client.get("/api/notifications/unread-count").status_code == 401


# --- Liste filtrée ---


def test_list_notifications_filtre_lue(client, auth_user):
    uid, headers = auth_user
    insert_notification(uid, "brief_pret", "Brief pret", lue=False)
    insert_notification(uid, "mail_important", "Mail important", lue=False)
    insert_notification(uid, "rappel_evenement", "Rappel", lue=True)

    resp_toutes = client.get("/api/notifications", headers=headers)
    assert resp_toutes.status_code == 200
    assert len(resp_toutes.json()["data"]) == 3

    resp_non_lues = client.get("/api/notifications?lue=false", headers=headers)
    assert resp_non_lues.status_code == 200
    assert len(resp_non_lues.json()["data"]) == 2
    assert all(n["lue"] is False for n in resp_non_lues.json()["data"])

    resp_lues = client.get("/api/notifications?lue=true", headers=headers)
    assert len(resp_lues.json()["data"]) == 1


# --- Compteur non-lues ---


def test_unread_count(client, auth_user):
    uid, headers = auth_user
    insert_notification(uid, lue=False)
    insert_notification(uid, lue=False)
    insert_notification(uid, lue=True)

    resp = client.get("/api/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["count"] == 2


# --- Marquage lu ---


def test_mark_read_tous(client, auth_user):
    uid, headers = auth_user
    insert_notification(uid, lue=False)
    insert_notification(uid, lue=False)

    resp = client.post("/api/notifications/read", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["marked"] == 2

    assert client.get("/api/notifications/unread-count", headers=headers).json()["data"]["count"] == 0


def test_mark_read_ids_cibles(client, auth_user):
    uid, headers = auth_user
    id1 = insert_notification(uid, lue=False)
    id2 = insert_notification(uid, lue=False)

    resp = client.post("/api/notifications/read", json={"ids": [id1]}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["marked"] == 1
    assert notification_lue(id1) is True
    assert notification_lue(id2) is False


# --- Isolation RLS cross-utilisateur ---


def test_notifications_isolation_cross_user(client, auth_user):
    uid, headers = auth_user
    insert_notification(uid, lue=False)

    other = create_user(f"notif-other-{uuid.uuid4().hex}@test.local")
    try:
        other_notif = insert_notification(other, lue=False)
        resp = client.get("/api/notifications", headers=headers)
        ids = [n["id"] for n in resp.json()["data"]]
        assert other_notif not in ids
    finally:
        delete_user(other)
