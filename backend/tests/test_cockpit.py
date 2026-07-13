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

    # Round 014 (F8) : "prochains" liste les 10 prochains rendez-vous a
    # venir (pas seulement ceux du jour courant) - les deux evenements
    # futurs doivent donc apparaitre, tries par debut croissant.
    today_event_id = insert_event(
        uid, "RDV aujourd'hui", now + timedelta(hours=1), now + timedelta(hours=2)
    )
    dans_3_jours_id = insert_event(
        uid, "RDV dans 3 jours", now + timedelta(days=3), now + timedelta(days=3, hours=1)
    )
    insert_event(
        uid, "RDV hier (passe)", now - timedelta(days=1, hours=2), now - timedelta(days=1)
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

    event_ids = [e["id"] for e in data["prochains"]]
    assert today_event_id in event_ids
    assert dans_3_jours_id in event_ids
    assert len(event_ids) == 2  # le RDV passe n'apparait pas
    # tri par debut croissant : le RDV d'aujourd'hui vient avant celui dans 3 jours.
    assert event_ids.index(today_event_id) < event_ids.index(dans_3_jours_id)

    task_ids = [t["id"] for t in data["taches"]]
    assert haute_id in task_ids
    assert sans_echeance_id in task_ids
    assert all(t["statut"] == "a_faire" for t in data["taches"])
    # echeance ASC NULLS LAST : la tache sans echeance arrive apres celle datee.
    assert task_ids.index(haute_id) < task_ids.index(sans_echeance_id)

    assert data["mails_importants"] == {"placeholder": True}


def test_cockpit_tache_expose_categorie(client, auth_user):
    """Round 012 : la tache du cockpit porte sa categorie (id, nom, couleur)."""
    uid, cookie = auth_user

    async def _seed(conn):
        cat_id = await conn.fetchval(
            "INSERT INTO task_categories (user_id, nom, couleur) "
            "VALUES ($1, 'Pro', '#2350E6') RETURNING id::text",
            uid,
        )
        task_id = await conn.fetchval(
            "INSERT INTO tasks (user_id, titre, statut, priorite, categorie_id) "
            "VALUES ($1, 'Tache categorisee', 'a_faire', 'normale', $2) "
            "RETURNING id::text",
            uid, cat_id,
        )
        return cat_id, task_id

    cat_id, task_id = admin(_seed)

    resp = client.get("/api/cockpit", headers=_cookie(cookie))
    assert resp.status_code == 200
    taches = {t["id"]: t for t in resp.json()["data"]["taches"]}
    assert task_id in taches
    assert taches[task_id]["categorie_id"] == cat_id
    assert taches[task_id]["categorie"] == {
        "id": cat_id,
        "nom": "Pro",
        "couleur": "#2350E6",
    }


def test_cockpit_rls_isolation(client, auth_user):
    _, cookie = auth_user
    other_uid = create_user(f"cockpit-other-{uuid.uuid4().hex}@test.local")
    try:
        insert_note(other_uid, "Note d'un autre utilisateur")
        resp = client.get("/api/cockpit", headers=_cookie(cookie))
        assert resp.status_code == 200
        assert resp.json()["data"]["notes_epinglees"] == []
        assert resp.json()["data"]["prochains"] == []
        assert resp.json()["data"]["taches"] == []
    finally:
        delete_user(other_uid)


def test_cockpit_prochains_dix_a_venir_tries(client, auth_user):
    """Round 014 (F8) : "prochains" = les 10 prochains rendez-vous a venir
    (debut >= now()), tries par debut croissant, limites a 10 - un
    evenement deja passe n'apparait jamais."""
    uid, cookie = auth_user
    now = datetime.now(timezone.utc)

    insert_event(uid, "RDV passe", now - timedelta(hours=2), now - timedelta(hours=1))
    futurs_ids = [
        insert_event(
            uid, f"RDV futur {i}", now + timedelta(hours=i), now + timedelta(hours=i, minutes=30)
        )
        for i in range(1, 13)  # 12 evenements futurs, tries par debut croissant
    ]

    resp = client.get("/api/cockpit", headers=_cookie(cookie))
    assert resp.status_code == 200
    prochains = resp.json()["data"]["prochains"]

    assert len(prochains) == 10
    assert [e["id"] for e in prochains] == futurs_ids[:10]


def test_cockpit_prochains_vide_si_aucun_evenement_a_venir(client, auth_user):
    uid, cookie = auth_user
    now = datetime.now(timezone.utc)
    insert_event(uid, "RDV passe", now - timedelta(hours=2), now - timedelta(hours=1))

    resp = client.get("/api/cockpit", headers=_cookie(cookie))
    assert resp.status_code == 200
    assert resp.json()["data"]["prochains"] == []


def test_cockpit_evenement_expose_categorie(client, auth_user):
    """Round 015 : les prochains evenements du cockpit portent leur categorie."""
    uid, cookie = auth_user
    now = datetime.now(timezone.utc)

    async def _seed(conn):
        cat_id = await conn.fetchval(
            "INSERT INTO event_categories (user_id, nom, couleur) "
            "VALUES ($1, 'Sport', '#0EA5E9') RETURNING id::text",
            uid,
        )
        event_id = await conn.fetchval(
            "INSERT INTO events (user_id, titre, debut, fin, categorie_id) "
            "VALUES ($1, 'Padel', $2, $3, $4) RETURNING id::text",
            uid, now + timedelta(hours=2), now + timedelta(hours=3), cat_id,
        )
        return cat_id, event_id

    cat_id, event_id = admin(_seed)

    resp = client.get("/api/cockpit", headers=_cookie(cookie))
    assert resp.status_code == 200
    prochains = {e["id"]: e for e in resp.json()["data"]["prochains"]}
    assert event_id in prochains
    assert prochains[event_id]["categorie"] == {
        "id": cat_id,
        "nom": "Sport",
        "couleur": "#0EA5E9",
    }
