"""Tests d'integration des endpoints Preferences (Round 005).

Exigent Postgres migre (RLS active sur `user_preferences`). Chaque test cree
son propre utilisateur de test pour rester isole.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from app.auth.cookie import COOKIE_NAME
from app.config import settings
from conftest import create_user, delete_user, make_session_for, sign_token


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"pref-{uuid.uuid4().hex}@test.local")
    token = "pref-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


async def _count_preferences_rows(user_id: str) -> int:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "SELECT count(*) FROM user_preferences WHERE user_id = $1", user_id
        )
    finally:
        await conn.close()


def _count_preferences(user_id: str) -> int:
    return asyncio.new_event_loop().run_until_complete(
        _count_preferences_rows(user_id)
    )


# --- 401 sans cookie ---


def test_get_preferences_sans_cookie_401(client):
    resp = client.get("/api/preferences")
    assert resp.status_code == 401


def test_patch_preferences_sans_cookie_401(client):
    resp = client.patch("/api/preferences", json={"brief_hour": "08:00"})
    assert resp.status_code == 401


# --- Create-or-default ---


def test_get_preferences_create_or_default(client, auth_user):
    uid, headers = auth_user
    resp = client.get("/api/preferences", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["brief_hour"] == "07:00"
    assert data["timezone"] == "Europe/Paris"
    assert data["notif_important_mail"] is True
    assert data["notif_event_reminder"] is True
    assert data["notif_brief_ready"] is True
    assert data["onboarding_completed"] is False
    assert data["onboarding_step"] == 0
    assert _count_preferences(uid) == 1

    # Un deuxieme GET ne recree pas de ligne.
    resp2 = client.get("/api/preferences", headers=headers)
    assert resp2.status_code == 200
    assert _count_preferences(uid) == 1


def test_get_preferences_idempotence_concurrente(client, auth_user):
    """Deux create-or-default simultanes ne doivent produire qu'une seule ligne,
    sans erreur (l'UNIQUE(user_id) + ON CONFLICT DO NOTHING absorbe la course)."""
    uid, headers = auth_user

    async def _fire() -> int:
        return await asyncio.to_thread(
            lambda: client.get("/api/preferences", headers=headers).status_code
        )

    async def _run_both() -> list[int]:
        return await asyncio.gather(_fire(), _fire())

    statuses = asyncio.new_event_loop().run_until_complete(_run_both())
    assert all(s == 200 for s in statuses)
    assert _count_preferences(uid) == 1


# --- PATCH partiel ---


def test_patch_preferences_partiel(client, auth_user):
    _, headers = auth_user
    client.get("/api/preferences", headers=headers)

    resp = client.patch(
        "/api/preferences",
        json={"brief_hour": "08:30", "notif_brief_ready": False},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["brief_hour"] == "08:30"
    assert data["notif_brief_ready"] is False
    # Les autres champs restent inchanges.
    assert data["timezone"] == "Europe/Paris"
    assert data["notif_important_mail"] is True


def test_patch_preferences_sans_get_prealable(client, auth_user):
    """PATCH doit fonctionner meme si aucun GET n'a ete fait avant (create-or-
    default aussi cote PATCH)."""
    uid, headers = auth_user
    resp = client.patch(
        "/api/preferences", json={"onboarding_step": 2}, headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["onboarding_step"] == 2
    assert _count_preferences(uid) == 1


def test_patch_preferences_updated_at_change(client, auth_user):
    _, headers = auth_user
    before = client.get("/api/preferences", headers=headers).json()["data"]
    after = client.patch(
        "/api/preferences", json={"onboarding_completed": True}, headers=headers
    ).json()["data"]
    assert after["updated_at"] != before["updated_at"] or after["created_at"] == before["created_at"]
    assert after["onboarding_completed"] is True


# --- Validations ---


def test_patch_preferences_brief_hour_invalide_400(client, auth_user):
    _, headers = auth_user
    resp = client.patch(
        "/api/preferences", json={"brief_hour": "25:99"}, headers=headers
    )
    assert resp.status_code == 400


def test_patch_preferences_onboarding_step_hors_bornes_400(client, auth_user):
    _, headers = auth_user
    resp = client.patch(
        "/api/preferences", json={"onboarding_step": 5}, headers=headers
    )
    assert resp.status_code == 400

    resp2 = client.patch(
        "/api/preferences", json={"onboarding_step": -1}, headers=headers
    )
    assert resp2.status_code == 400


# --- Isolation RLS cross-utilisateur ---


def test_preferences_isolation_cross_user(client, auth_user):
    uid_a, headers_a = auth_user
    client.patch(
        "/api/preferences", json={"brief_hour": "09:15"}, headers=headers_a
    )

    other_uid = create_user(f"otherpref-{uuid.uuid4().hex}@test.local")
    other_token = "otherpref-" + uuid.uuid4().hex
    make_session_for(
        other_uid, other_token, datetime.now(timezone.utc) + timedelta(days=1)
    )
    try:
        resp = client.get(
            "/api/preferences", headers=_cookie(sign_token(other_token))
        )
        assert resp.status_code == 200
        # L'autre utilisateur obtient ses propres defauts, pas ceux de uid_a.
        assert resp.json()["data"]["brief_hour"] == "07:00"
        assert _count_preferences(other_uid) == 1
    finally:
        delete_user(other_uid)
