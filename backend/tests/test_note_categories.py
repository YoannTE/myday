"""Tests d'intégration des catégories de notes (miroir des catégories de
tâches, Round 015).

Exigent Postgres migré (RLS active sur `note_categories`, colonne
`notes.categorie_id`). Chaque test crée son propre utilisateur pour rester
isolé.
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
    uid = create_user(f"ncatg-{uuid.uuid4().hex}@test.local")
    token = "ncatg-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


@pytest.fixture
def other_user(client):
    uid = create_user(f"ncatg-other-{uuid.uuid4().hex}@test.local")
    token = "ncatg-other-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


# --- Création + couleur auto-assignée ---


def test_create_category_couleur_auto_assignee(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/note-categories", json={"nom": "Recettes"}, headers=headers
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["nom"] == "Recettes"
    assert data["couleur"] == "#2350E6"


def test_create_category_couleur_explicite(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/note-categories",
        json={"nom": "Idées", "couleur": "#123456"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["couleur"] == "#123456"


def test_create_category_palette_tourne(client, auth_user):
    _, headers = auth_user
    couleurs = []
    for nom in ["A", "B", "C"]:
        resp = client.post(
            "/api/note-categories", json={"nom": nom}, headers=headers
        )
        couleurs.append(resp.json()["data"]["couleur"])
    assert couleurs == ["#2350E6", "#0EA5E9", "#8B5CF6"]


def test_create_category_nom_duplique_conflict(client, auth_user):
    _, headers = auth_user
    client.post("/api/note-categories", json={"nom": "Recettes"}, headers=headers)
    resp = client.post(
        "/api/note-categories", json={"nom": "Recettes"}, headers=headers
    )
    assert resp.status_code == 409


def test_create_category_nom_vide_rejete(client, auth_user):
    _, headers = auth_user
    resp = client.post("/api/note-categories", json={"nom": "   "}, headers=headers)
    assert resp.status_code == 422


# --- Liste triée + cloisonnement ---


def test_list_categories_triees_par_nom(client, auth_user):
    _, headers = auth_user
    client.post("/api/note-categories", json={"nom": "Zeta"}, headers=headers)
    client.post("/api/note-categories", json={"nom": "Alpha"}, headers=headers)
    noms = [c["nom"] for c in client.get("/api/note-categories", headers=headers).json()["data"]]
    assert noms == sorted(noms)


def test_list_categories_cloisonnement(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    client.post("/api/note-categories", json={"nom": "Perso"}, headers=headers_owner)
    autres = client.get("/api/note-categories", headers=headers_other).json()["data"]
    assert autres == []


# --- Mise à jour ---


def test_update_category_nom_et_couleur(client, auth_user):
    _, headers = auth_user
    created = client.post(
        "/api/note-categories", json={"nom": "Recettes"}, headers=headers
    ).json()["data"]
    resp = client.patch(
        f"/api/note-categories/{created['id']}",
        json={"nom": "Cuisine", "couleur": "#000000"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["nom"] == "Cuisine"
    assert data["couleur"] == "#000000"


def test_patch_category_cross_user_404(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    categorie = client.post(
        "/api/note-categories", json={"nom": "Prive"}, headers=headers_owner
    ).json()["data"]
    resp = client.patch(
        f"/api/note-categories/{categorie['id']}",
        json={"nom": "Vol"},
        headers=headers_other,
    )
    assert resp.status_code == 404


# --- Assignation sur une note + cloisonnement ---


def test_create_note_avec_categorie(client, auth_user):
    _, headers = auth_user
    categorie = client.post(
        "/api/note-categories", json={"nom": "Recettes"}, headers=headers
    ).json()["data"]
    resp = client.post(
        "/api/notes",
        json={"titre": "Tarte aux pommes", "categorie_id": categorie["id"]},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["categorie_id"] == categorie["id"]
    assert data["categorie"] == {
        "id": categorie["id"],
        "nom": "Recettes",
        "couleur": categorie["couleur"],
    }


def test_create_note_avec_categorie_d_un_autre_user_rejetee(
    client, auth_user, other_user
):
    _, headers_owner = auth_user
    _, headers_other = other_user
    categorie = client.post(
        "/api/note-categories", json={"nom": "Recettes"}, headers=headers_owner
    ).json()["data"]
    resp = client.post(
        "/api/notes",
        json={"titre": "Intrusion", "categorie_id": categorie["id"]},
        headers=headers_other,
    )
    assert resp.status_code == 400


def test_update_note_retire_categorie(client, auth_user):
    _, headers = auth_user
    categorie = client.post(
        "/api/note-categories", json={"nom": "Recettes"}, headers=headers
    ).json()["data"]
    note = client.post(
        "/api/notes",
        json={"titre": "Avec categorie", "categorie_id": categorie["id"]},
        headers=headers,
    ).json()["data"]

    resp = client.patch(
        f"/api/notes/{note['id']}", json={"categorie_id": None}, headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["categorie_id"] is None
    assert data["categorie"] is None


# --- Suppression : les notes sont conservées, categorie_id repasse NULL ---


def test_delete_category_notes_conservees(client, auth_user):
    _, headers = auth_user
    categorie = client.post(
        "/api/note-categories", json={"nom": "Recettes"}, headers=headers
    ).json()["data"]
    note = client.post(
        "/api/notes",
        json={"titre": "Gratin", "categorie_id": categorie["id"]},
        headers=headers,
    ).json()["data"]
    assert note["categorie"]["nom"] == "Recettes"

    resp = client.delete(f"/api/note-categories/{categorie['id']}", headers=headers)
    assert resp.status_code == 204

    notes = client.get("/api/notes", headers=headers).json()["data"]
    retrouvee = next(n for n in notes if n["id"] == note["id"])
    assert retrouvee["titre"] == "Gratin"
    assert retrouvee["categorie_id"] is None
    assert retrouvee["categorie"] is None
