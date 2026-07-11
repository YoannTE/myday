"""Tests du endpoint Cockpit (GET /api/cockpit) : agregation, bornes du jour,
tri des notes/taches, placeholder mails, RLS (isolation stricte entre
utilisateurs).
"""

from __future__ import annotations

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
    uid = create_user(f"cockpit-{uuid.uuid4().hex}@test.local")
    token = "cockpit-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, sign_token(token)
    delete_user(uid)


async def _admin(fn):
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await fn(conn)
    finally:
        await conn.close()


def admin(fn):
    return asyncio.new_event_loop().run_until_complete(_admin(fn))


def insert_note(user_id: str, titre: str, *, epinglee: bool = True, archivee: bool = False) -> str:
    async def _do(conn):
        return await conn.fetchval(
            "INSERT INTO notes (user_id, titre, epinglee, archivee) "
            "VALUES ($1, $2, $3, $4) RETURNING id::text",
            user_id, titre, epinglee, archivee,
        )

    return admin(_do)


def insert_task(
    user_id: str,
    titre: str,
    *,
    statut: str = "a_faire",
    priorite: str = "normale",
    echeance: datetime | None = None,
) -> str:
    async def _do(conn):
        return await conn.fetchval(
            "INSERT INTO tasks (user_id, titre, statut, priorite, echeance) "
            "VALUES ($1, $2, $3, $4, $5) RETURNING id::text",
            user_id, titre, statut, priorite, echeance,
        )

    return admin(_do)


def insert_event(user_id: str, titre: str, debut: datetime, fin: datetime) -> str:
    async def _do(conn):
        return await conn.fetchval(
            "INSERT INTO events (user_id, titre, debut, fin) "
            "VALUES ($1, $2, $3, $4) RETURNING id::text",
            user_id, titre, debut, fin,
        )

    return admin(_do)


def test_cockpit_agrege_notes_events_taches(client, auth_user):
    uid, cookie = auth_user
    now = datetime.now(timezone.utc)

    insert_note(uid, "Note archivee", archivee=True)
    insert_note(uid, "Note non epinglee", epinglee=False)
    epinglee_id = insert_note(uid, "Note epinglee")

    today_event_id = insert_event(
        uid, "RDV aujourd'hui", now + timedelta(hours=1), now + timedelta(hours=2)
    )
    insert_event(
        uid, "RDV dans 3 jours", now + timedelta(days=3), now + timedelta(days=3, hours=1)
    )

    haute_id = insert_task(uid, "Urgent", priorite="haute", echeance=now + timedelta(days=1))
    sans_echeance_id = insert_task(uid, "Sans echeance", priorite="basse")
    insert_task(uid, "Deja faite", statut="faite")

    resp = client.get("/api/cockpit", headers=_cookie(cookie))
    assert resp.status_code == 200
    data = resp.json()["data"]

    note_ids = [n["id"] for n in data["notes_epinglees"]]
    assert epinglee_id in note_ids
    assert len(data["notes_epinglees"]) <= 5
    assert all(n["epinglee"] for n in data["notes_epinglees"])
    assert all(not n["archivee"] for n in data["notes_epinglees"])

    event_ids = [e["id"] for e in data["journee"]]
    assert today_event_id in event_ids
    assert len(event_ids) == 1  # le RDV dans 3 jours n'apparait pas

    task_ids = [t["id"] for t in data["taches"]]
    assert haute_id in task_ids
    assert sans_echeance_id in task_ids
    assert all(t["statut"] == "a_faire" for t in data["taches"])
    # echeance ASC NULLS LAST : la tache sans echeance arrive apres celle datee.
    assert task_ids.index(haute_id) < task_ids.index(sans_echeance_id)

    assert data["mails_importants"] == {"placeholder": True}


def test_cockpit_rls_isolation(client, auth_user):
    _, cookie = auth_user
    other_uid = create_user(f"cockpit-other-{uuid.uuid4().hex}@test.local")
    try:
        insert_note(other_uid, "Note d'un autre utilisateur")
        resp = client.get("/api/cockpit", headers=_cookie(cookie))
        assert resp.status_code == 200
        assert resp.json()["data"]["notes_epinglees"] == []
        assert resp.json()["data"]["journee"] == []
        assert resp.json()["data"]["taches"] == []
    finally:
        delete_user(other_uid)
