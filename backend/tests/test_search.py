"""Tests de la recherche globale (Round 009) : résultats groupés par type,
isolation RLS cross-utilisateur, requêtes paramétrées robustes aux
caractères spéciaux du motif ILIKE (`%`, `'`), 401 sans cookie.
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
    uid = create_user(f"search-{uuid.uuid4().hex}@test.local")
    token = "search-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


async def _exec(query: str, *args) -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute(query, *args)
    finally:
        await conn.close()


def insert_note(user_id: str, titre: str, contenu: str = "") -> None:
    run_async(
        _exec(
            "INSERT INTO notes (user_id, titre, contenu) VALUES ($1, $2, $3)",
            user_id, titre, contenu,
        )
    )


def insert_task(user_id: str, titre: str) -> None:
    run_async(
        _exec(
            "INSERT INTO tasks (user_id, titre) VALUES ($1, $2)", user_id, titre
        )
    )


def insert_event(user_id: str, titre: str, lieu: str = "") -> None:
    now = datetime.now(timezone.utc)
    run_async(
        _exec(
            "INSERT INTO events (user_id, titre, lieu, debut, fin) "
            "VALUES ($1, $2, $3, $4, $5)",
            user_id, titre, lieu, now, now + timedelta(hours=1),
        )
    )


def insert_mail(user_id: str, sujet: str, statut: str = "triaged") -> None:
    run_async(
        _exec(
            "INSERT INTO mails (user_id, gmail_id, expediteur, sujet, extrait, statut) "
            "VALUES ($1, $2, 'expediteur@test.local', $3, 'extrait', $4)",
            user_id, f"gmail-{uuid.uuid4().hex}", sujet, statut,
        )
    )


# --- 401 sans cookie ---


def test_search_sans_cookie_401(client):
    assert client.get("/api/search?q=padel").status_code == 401


# --- Requête vide ---


def test_search_query_vide_resultats_vides(client, auth_user):
    _, headers = auth_user
    resp = client.get("/api/search?q=", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data == {"notes": [], "taches": [], "events": [], "mails": []}


# --- Résultats groupés par type ---


def test_search_resultats_groupes(client, auth_user):
    uid, headers = auth_user
    terme = f"padel{uuid.uuid4().hex[:8]}"
    insert_note(uid, f"Liste courses {terme}", "raquette de padel")
    insert_task(uid, f"Réserver le terrain {terme}")
    insert_event(uid, f"Partie de {terme}", lieu="Club")
    insert_mail(uid, f"Confirmation réservation {terme}")

    resp = client.get(f"/api/search?q={terme}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["notes"]) == 1
    assert len(data["taches"]) == 1
    assert len(data["events"]) == 1
    assert len(data["mails"]) == 1


def test_search_mails_non_tries_exclus(client, auth_user):
    uid, headers = auth_user
    terme = f"pendingmail{uuid.uuid4().hex[:8]}"
    insert_mail(uid, f"Sujet {terme}", statut="pending_triage")

    resp = client.get(f"/api/search?q={terme}", headers=headers)
    assert resp.json()["data"]["mails"] == []


# --- Isolation RLS cross-utilisateur ---


def test_search_isolation_cross_user(client, auth_user):
    uid, headers = auth_user
    terme = f"secret{uuid.uuid4().hex[:8]}"

    other = create_user(f"search-other-{uuid.uuid4().hex}@test.local")
    try:
        insert_note(other, f"Note confidentielle {terme}")
        resp = client.get(f"/api/search?q={terme}", headers=headers)
        assert resp.json()["data"]["notes"] == []
    finally:
        delete_user(other)


# --- Requêtes paramétrées : robustesse aux caractères spéciaux ILIKE -------


def test_search_injection_pourcentage(client, auth_user):
    uid, headers = auth_user
    insert_note(uid, "Note normale", "contenu normal")

    resp = client.get("/api/search?q=%25", headers=headers)  # q="%"
    assert resp.status_code == 200  # ne doit jamais lever d'erreur serveur


def test_search_injection_quote(client, auth_user):
    _, headers = auth_user
    resp = client.get("/api/search?q=%27%20OR%20%271%27%3D%271", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data == {"notes": [], "taches": [], "events": [], "mails": []}
