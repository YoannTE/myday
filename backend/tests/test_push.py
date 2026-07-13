"""Tests des notifications push (Round 009) : upsert/suppression d'abonnement,
`dispatch_push` (préférence désactivée, plafond, abonnement mort 410 purgé,
envoi réussi), format de la clé VAPID, rappels d'événements (idempotence),
endpoints HTTP (`vapid-public-key`, `subscribe`, `unsubscribe`).

JAMAIS de vrai push réseau : `pywebpush.webpush` est TOUJOURS mocké dans ces
tests (`monkeypatch.setattr(sender, "webpush", ...)`).
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest
from pywebpush import WebPushException

import app.db.client as dbclient
import app.services.push.sender as sender
from app.auth.cookie import COOKIE_NAME
from app.config import settings
from app.services.event_reminders import run_event_reminders
from app.services.push import subscriptions as push_subscriptions
from app.services.push.sender import dispatch_push
from app.services.task_reminders import run_task_reminders

from conftest import create_user, delete_user, make_session_for, sign_token


class _FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        self.text = "gone"


def run_in_loop(coro_factory):
    """Exécute une coroutine avec des pools app_rls + app_admin dédiés à un
    loop neuf (nécessaire : `dispatch_push`/`run_event_reminders` utilisent
    les deux pools)."""

    async def _runner():
        saved_pool = dbclient._pool
        saved_admin = dbclient._admin_pool
        dbclient._pool = await asyncpg.create_pool(
            settings.backend_database_url, min_size=1, max_size=5
        )
        dbclient._admin_pool = await asyncpg.create_pool(
            settings.database_url, min_size=1, max_size=5
        )
        try:
            return await coro_factory()
        finally:
            await dbclient._pool.close()
            await dbclient._admin_pool.close()
            dbclient._pool = saved_pool
            dbclient._admin_pool = saved_admin

    return asyncio.new_event_loop().run_until_complete(_runner())


def admin_val(query, *args):
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            return await conn.fetchval(query, *args)
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


def admin_exec(query, *args):
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            await conn.execute(query, *args)
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


def insert_subscription(user_id, endpoint, p256dh="p", auth_key="a") -> None:
    admin_exec(
        "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) "
        "VALUES ($1, $2, $3, $4)",
        user_id, endpoint, p256dh, auth_key,
    )


def count_subscriptions(endpoint) -> int:
    return admin_val(
        "SELECT count(*) FROM push_subscriptions WHERE endpoint = $1", endpoint
    )


def set_notif_pref(user_id, notif_important_mail=True) -> None:
    admin_exec(
        "INSERT INTO user_preferences (user_id, notif_important_mail) VALUES ($1, $2)",
        user_id, notif_important_mail,
    )


def insert_notification(user_id, type_notif="mail_important") -> None:
    admin_exec(
        "INSERT INTO notifications (user_id, type, contenu, ref_id) "
        "VALUES ($1, $2, 'test', gen_random_uuid())",
        user_id, type_notif,
    )


def count_notifications(user_id, type_notif) -> int:
    return admin_val(
        "SELECT count(*) FROM notifications WHERE user_id = $1 AND type = $2",
        user_id, type_notif,
    )


def insert_event(user_id, titre, debut, fin) -> str:
    return admin_val(
        "INSERT INTO events (user_id, titre, debut, fin) VALUES ($1, $2, $3, $4) "
        "RETURNING id::text",
        user_id, titre, debut, fin,
    )


def insert_task_avec_rappel(user_id, titre, rappel_at, statut="a_faire") -> str:
    return admin_val(
        "INSERT INTO tasks (user_id, titre, statut, rappel_at) "
        "VALUES ($1, $2, $3, $4) RETURNING id::text",
        user_id, titre, statut, rappel_at,
    )


@pytest.fixture
def user_id():
    uid = create_user(f"push-{uuid.uuid4().hex}@test.local")
    yield uid
    delete_user(uid)


# --- Abonnements (upsert / suppression) -------------------------------------


def test_subscribe_upsert_meme_endpoint(user_id):
    endpoint = f"https://push.example.com/{uuid.uuid4().hex}"
    run_in_loop(
        lambda: push_subscriptions.upsert_subscription(user_id, endpoint, "p1", "a1")
    )
    run_in_loop(
        lambda: push_subscriptions.upsert_subscription(user_id, endpoint, "p2", "a2")
    )
    subs = run_in_loop(lambda: push_subscriptions.list_subscriptions(user_id))
    assert len(subs) == 1
    assert subs[0]["p256dh"] == "p2"
    assert subs[0]["auth"] == "a2"


def test_subscribe_upsert_transfert_proprietaire(user_id):
    """Un endpoint deja possede par un autre user est repris (appareil partage)."""
    other = create_user(f"push-other-{uuid.uuid4().hex}@test.local")
    endpoint = f"https://push.example.com/{uuid.uuid4().hex}"
    try:
        run_in_loop(
            lambda: push_subscriptions.upsert_subscription(other, endpoint, "p1", "a1")
        )
        run_in_loop(
            lambda: push_subscriptions.upsert_subscription(user_id, endpoint, "p2", "a2")
        )
        assert run_in_loop(lambda: push_subscriptions.list_subscriptions(other)) == []
        subs = run_in_loop(lambda: push_subscriptions.list_subscriptions(user_id))
        assert len(subs) == 1
    finally:
        delete_user(other)


def test_unsubscribe_supprime(user_id):
    endpoint = f"https://push.example.com/{uuid.uuid4().hex}"
    run_in_loop(
        lambda: push_subscriptions.upsert_subscription(user_id, endpoint, "p", "a")
    )
    run_in_loop(lambda: push_subscriptions.delete_subscription(user_id, endpoint))
    assert run_in_loop(lambda: push_subscriptions.list_subscriptions(user_id)) == []


# --- dispatch_push : préférence / plafond / abonnement mort -----------------


def test_dispatch_push_preference_desactivee_zero_envoi(user_id, monkeypatch):
    set_notif_pref(user_id, notif_important_mail=False)
    insert_subscription(user_id, f"https://push.example.com/{uuid.uuid4().hex}")
    appels = []
    monkeypatch.setattr(
        sender, "webpush", lambda **kwargs: appels.append(kwargs) or None
    )
    sent = run_in_loop(
        lambda: dispatch_push(user_id, "mail_important", "Titre", "Corps", "/mails")
    )
    assert sent == 0
    assert appels == []


def test_dispatch_push_plafond_respecte(user_id, monkeypatch):
    monkeypatch.setattr(settings, "push_max_per_hour", 1)
    insert_notification(user_id, "brief_pret")  # 1 notif recente -> plafond atteint
    insert_subscription(user_id, f"https://push.example.com/{uuid.uuid4().hex}")
    appels = []
    monkeypatch.setattr(
        sender, "webpush", lambda **kwargs: appels.append(kwargs) or None
    )
    sent = run_in_loop(
        lambda: dispatch_push(user_id, "mail_important", "Titre", "Corps", "/mails")
    )
    assert sent == 0
    assert appels == []


def test_dispatch_push_abonnement_mort_purge(user_id, monkeypatch):
    endpoint = f"https://push.example.com/{uuid.uuid4().hex}"
    insert_subscription(user_id, endpoint)

    def _raise(**kwargs):
        raise WebPushException("gone", response=_FakeResponse(410))

    monkeypatch.setattr(sender, "webpush", _raise)
    sent = run_in_loop(
        lambda: dispatch_push(user_id, "mail_important", "Titre", "Corps", "/mails")
    )
    assert sent == 0
    assert count_subscriptions(endpoint) == 0


def test_dispatch_push_envoi_reussi(user_id, monkeypatch):
    endpoint = f"https://push.example.com/{uuid.uuid4().hex}"
    insert_subscription(user_id, endpoint)
    appels = []
    monkeypatch.setattr(
        sender, "webpush", lambda **kwargs: appels.append(kwargs) or None
    )
    sent = run_in_loop(
        lambda: dispatch_push(user_id, "mail_important", "Titre", "Corps", "/mails")
    )
    assert sent == 1
    assert len(appels) == 1
    assert count_subscriptions(endpoint) == 1  # pas purge : envoi reussi


# --- Format de la clé VAPID --------------------------------------------------


def test_vapid_private_key_format_valide():
    """Vérifie (correction #5 du plan) que la clé privée base64url brute de
    `.env.local` est acceptée par py_vapid sans conversion supplémentaire."""
    if not settings.vapid_private_key:
        pytest.skip("VAPID_PRIVATE_KEY absente de l'environnement de test.")
    from py_vapid import Vapid02

    vapid = Vapid02.from_string(settings.vapid_private_key)
    headers = vapid.sign({"sub": settings.vapid_subject, "aud": "https://example.com"})
    assert "Authorization" in headers


# --- Rappels d'événements : idempotence --------------------------------------


def test_event_reminders_idempotent_deux_ticks_une_notif(user_id, monkeypatch):
    monkeypatch.setattr(sender, "webpush", lambda **kwargs: None)
    debut = datetime.now(timezone.utc) + timedelta(minutes=settings.event_reminder_minutes)
    insert_event(user_id, "Partie de padel", debut, debut + timedelta(hours=1))

    first = run_in_loop(
        lambda: run_event_reminders(settings.event_reminder_interval_minutes)
    )
    second = run_in_loop(
        lambda: run_event_reminders(settings.event_reminder_interval_minutes)
    )
    assert first == 1
    assert second == 0
    assert count_notifications(user_id, "rappel_evenement") == 1


# --- Rappels de tâches (Round 015) -------------------------------------------


def test_task_reminder_fire_a_l_heure_et_idempotent(user_id, monkeypatch):
    monkeypatch.setattr(sender, "webpush", lambda **kwargs: None)
    # Rappel dont l'heure vient de passer (dans la fenêtre du tick).
    rappel = datetime.now(timezone.utc) - timedelta(minutes=1)
    insert_task_avec_rappel(user_id, "Appeler le médecin", rappel)

    interval = settings.event_reminder_interval_minutes
    first = run_in_loop(lambda: run_task_reminders(interval))
    second = run_in_loop(lambda: run_task_reminders(interval))
    assert first == 1
    assert second == 0
    assert count_notifications(user_id, "rappel_tache") == 1


def test_task_reminder_futur_pas_de_notif(user_id, monkeypatch):
    monkeypatch.setattr(sender, "webpush", lambda **kwargs: None)
    rappel = datetime.now(timezone.utc) + timedelta(hours=2)
    insert_task_avec_rappel(user_id, "Plus tard", rappel)
    created = run_in_loop(
        lambda: run_task_reminders(settings.event_reminder_interval_minutes)
    )
    assert created == 0
    assert count_notifications(user_id, "rappel_tache") == 0


def test_task_reminder_tache_faite_pas_de_notif(user_id, monkeypatch):
    monkeypatch.setattr(sender, "webpush", lambda **kwargs: None)
    rappel = datetime.now(timezone.utc) - timedelta(minutes=1)
    insert_task_avec_rappel(user_id, "Déjà faite", rappel, statut="faite")
    created = run_in_loop(
        lambda: run_task_reminders(settings.event_reminder_interval_minutes)
    )
    assert created == 0
    assert count_notifications(user_id, "rappel_tache") == 0


# --- Endpoints HTTP -----------------------------------------------------------


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"push-http-{uuid.uuid4().hex}@test.local")
    token = "push-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


def test_vapid_public_key_sans_cookie_401(client):
    resp = client.get("/api/push/vapid-public-key")
    assert resp.status_code == 401


def test_vapid_public_key_ok(client, auth_user):
    _, headers = auth_user
    resp = client.get("/api/push/vapid-public-key", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["public_key"] == settings.vapid_public_key


def test_subscribe_endpoint_http(client, auth_user):
    uid, headers = auth_user
    endpoint = f"https://push.example.com/{uuid.uuid4().hex}"
    resp = client.post(
        "/api/push/subscribe",
        json={"endpoint": endpoint, "keys": {"p256dh": "p", "auth": "a"}},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["ok"] is True
    assert count_subscriptions(endpoint) == 1

    resp2 = client.request(
        "DELETE",
        "/api/push/subscribe",
        json={"endpoint": endpoint},
        headers=headers,
    )
    assert resp2.status_code == 204
    assert count_subscriptions(endpoint) == 0


def test_subscribe_sans_cookie_401(client):
    resp = client.post(
        "/api/push/subscribe",
        json={"endpoint": "https://push.example.com/x", "keys": {"p256dh": "p", "auth": "a"}},
    )
    assert resp.status_code == 401
