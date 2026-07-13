"""Tests d'intégration des catégories d'événements (miroir des catégories de
tâches/notes, Round 015).

Exigent Postgres migré (RLS active sur `event_categories`, colonne
`events.categorie_id`).
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.cookie import COOKIE_NAME
from conftest import create_user, delete_user, make_session_for, sign_token


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"ecatg-{uuid.uuid4().hex}@test.local")
    token = "ecatg-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


@pytest.fixture
def other_user(client):
    uid = create_user(f"ecatg-other-{uuid.uuid4().hex}@test.local")
    token = "ecatg-other-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


def _creer_event(client, headers, categorie_id=None) -> dict:
    debut = datetime.now(timezone.utc) + timedelta(hours=1)
    body = {
        "titre": "Réunion",
        "debut": debut.isoformat(),
        "fin": (debut + timedelta(hours=1)).isoformat(),
    }
    if categorie_id is not None:
        body["categorie_id"] = categorie_id
    return client.post("/api/events", json=body, headers=headers).json()["data"]


def test_create_category_couleur_auto_et_conflit(client, auth_user):
    _, headers = auth_user
    r = client.post("/api/event-categories", json={"nom": "Perso"}, headers=headers)
    assert r.status_code == 201
    assert r.json()["data"]["couleur"] == "#2350E6"
    conflit = client.post(
        "/api/event-categories", json={"nom": "Perso"}, headers=headers
    )
    assert conflit.status_code == 409


def test_create_category_nom_vide_rejete(client, auth_user):
    _, headers = auth_user
    resp = client.post("/api/event-categories", json={"nom": "   "}, headers=headers)
    assert resp.status_code == 422


def test_list_categories_cloisonnement(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    client.post("/api/event-categories", json={"nom": "Pro"}, headers=headers_owner)
    autres = client.get("/api/event-categories", headers=headers_other).json()["data"]
    assert autres == []


def test_event_avec_categorie(client, auth_user):
    _, headers = auth_user
    cat = client.post(
        "/api/event-categories", json={"nom": "Sport"}, headers=headers
    ).json()["data"]
    event = _creer_event(client, headers, categorie_id=cat["id"])
    assert event["categorie_id"] == cat["id"]
    assert event["categorie"] == {
        "id": cat["id"],
        "nom": "Sport",
        "couleur": cat["couleur"],
    }


def test_event_avec_categorie_d_un_autre_user_rejetee(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    cat = client.post(
        "/api/event-categories", json={"nom": "Sport"}, headers=headers_owner
    ).json()["data"]
    debut = datetime.now(timezone.utc) + timedelta(hours=1)
    resp = client.post(
        "/api/events",
        json={
            "titre": "Intrusion",
            "debut": debut.isoformat(),
            "fin": (debut + timedelta(hours=1)).isoformat(),
            "categorie_id": cat["id"],
        },
        headers=headers_other,
    )
    assert resp.status_code == 400


def test_update_event_categorie_et_retrait(client, auth_user):
    _, headers = auth_user
    cat = client.post(
        "/api/event-categories", json={"nom": "Sport"}, headers=headers
    ).json()["data"]
    event = _creer_event(client, headers)
    assert event["categorie"] is None

    modifie = client.patch(
        f"/api/events/{event['id']}",
        json={"categorie_id": cat["id"]},
        headers=headers,
    ).json()["data"]
    assert modifie["categorie"]["nom"] == "Sport"

    retire = client.patch(
        f"/api/events/{event['id']}", json={"categorie_id": None}, headers=headers
    ).json()["data"]
    assert retire["categorie_id"] is None
    assert retire["categorie"] is None


def test_delete_category_events_conserves(client, auth_user):
    _, headers = auth_user
    cat = client.post(
        "/api/event-categories", json={"nom": "Sport"}, headers=headers
    ).json()["data"]
    event = _creer_event(client, headers, categorie_id=cat["id"])

    resp = client.delete(f"/api/event-categories/{cat['id']}", headers=headers)
    assert resp.status_code == 204

    debut = datetime.now(timezone.utc)
    events = client.get(
        "/api/events",
        params={
            "from": (debut - timedelta(hours=1)).isoformat(),
            "to": (debut + timedelta(days=1)).isoformat(),
        },
        headers=headers,
    ).json()["data"]
    retrouve = next(e for e in events if e["id"] == event["id"])
    assert retrouve["categorie_id"] is None
