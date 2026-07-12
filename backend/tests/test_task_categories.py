"""Tests d'intégration des catégories de tâches (Round 012).

Exigent Postgres migré (RLS active sur `task_categories`, colonne
`tasks.categorie_id`). Chaque test crée son propre utilisateur pour rester
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
    uid = create_user(f"catg-{uuid.uuid4().hex}@test.local")
    token = "catg-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


@pytest.fixture
def other_user(client):
    uid = create_user(f"catg-other-{uuid.uuid4().hex}@test.local")
    token = "catg-other-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


# --- Création + couleur auto-assignée ---


def test_create_category_couleur_auto_assignee(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/task-categories", json={"nom": "Pro"}, headers=headers
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["nom"] == "Pro"
    assert data["couleur"] == "#2350E6"


def test_create_category_couleur_explicite(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/task-categories",
        json={"nom": "Perso", "couleur": "#123456"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["couleur"] == "#123456"


def test_create_category_palette_tourne(client, auth_user):
    _, headers = auth_user
    noms = ["A", "B", "C"]
    couleurs = []
    for nom in noms:
        resp = client.post(
            "/api/task-categories", json={"nom": nom}, headers=headers
        )
        couleurs.append(resp.json()["data"]["couleur"])
    assert couleurs == ["#2350E6", "#0EA5E9", "#8B5CF6"]


def test_create_category_nom_duplique_conflict(client, auth_user):
    _, headers = auth_user
    client.post("/api/task-categories", json={"nom": "Pro"}, headers=headers)
    resp = client.post("/api/task-categories", json={"nom": "Pro"}, headers=headers)
    assert resp.status_code == 409


def test_create_category_nom_vide_rejete(client, auth_user):
    _, headers = auth_user
    resp = client.post("/api/task-categories", json={"nom": "   "}, headers=headers)
    assert resp.status_code == 422


# --- Liste triée ---


def test_list_categories_triees_par_nom(client, auth_user):
    _, headers = auth_user
    client.post("/api/task-categories", json={"nom": "Zeta"}, headers=headers)
    client.post("/api/task-categories", json={"nom": "Alpha"}, headers=headers)
    resp = client.get("/api/task-categories", headers=headers)
    noms = [c["nom"] for c in resp.json()["data"]]
    assert noms == sorted(noms)
    assert "Alpha" in noms and "Zeta" in noms


# --- Mise à jour ---


def test_update_category_nom_et_couleur(client, auth_user):
    _, headers = auth_user
    created = client.post(
        "/api/task-categories", json={"nom": "Pro"}, headers=headers
    ).json()["data"]
    resp = client.patch(
        f"/api/task-categories/{created['id']}",
        json={"nom": "Travail", "couleur": "#000000"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["nom"] == "Travail"
    assert data["couleur"] == "#000000"


def test_update_category_nom_duplique_conflict(client, auth_user):
    _, headers = auth_user
    client.post("/api/task-categories", json={"nom": "Pro"}, headers=headers)
    perso = client.post(
        "/api/task-categories", json={"nom": "Perso"}, headers=headers
    ).json()["data"]
    resp = client.patch(
        f"/api/task-categories/{perso['id']}",
        json={"nom": "Pro"},
        headers=headers,
    )
    assert resp.status_code == 409


# --- Suppression : les tâches sont conservées, categorie_id repasse NULL ---


def test_delete_category_tasks_conserved(client, auth_user):
    _, headers = auth_user
    categorie = client.post(
        "/api/task-categories", json={"nom": "Pro"}, headers=headers
    ).json()["data"]
    task = client.post(
        "/api/tasks",
        json={"titre": "Rapport", "categorie_id": categorie["id"]},
        headers=headers,
    ).json()["data"]
    assert task["categorie"]["nom"] == "Pro"

    resp = client.delete(f"/api/task-categories/{categorie['id']}", headers=headers)
    assert resp.status_code == 204

    tasks = client.get("/api/tasks", headers=headers).json()["data"]
    retrouvee = next(t for t in tasks if t["id"] == task["id"])
    assert retrouvee["titre"] == "Rapport"
    assert retrouvee["categorie_id"] is None
    assert retrouvee["categorie"] is None


def test_delete_category_cross_user_404(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    categorie = client.post(
        "/api/task-categories", json={"nom": "Prive"}, headers=headers_owner
    ).json()["data"]
    resp = client.delete(
        f"/api/task-categories/{categorie['id']}", headers=headers_other
    )
    assert resp.status_code == 404


def test_patch_category_cross_user_404(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    categorie = client.post(
        "/api/task-categories", json={"nom": "Prive2"}, headers=headers_owner
    ).json()["data"]
    resp = client.patch(
        f"/api/task-categories/{categorie['id']}",
        json={"nom": "Vol"},
        headers=headers_other,
    )
    assert resp.status_code == 404


# --- Cloisonnement : liste + assignation ---


def test_list_categories_cloisonnement(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    client.post("/api/task-categories", json={"nom": "Pro"}, headers=headers_owner)
    autres = client.get("/api/task-categories", headers=headers_other).json()["data"]
    assert autres == []


def test_create_task_avec_categorie_d_un_autre_user_rejetee(
    client, auth_user, other_user
):
    _, headers_owner = auth_user
    _, headers_other = other_user
    categorie = client.post(
        "/api/task-categories", json={"nom": "Pro"}, headers=headers_owner
    ).json()["data"]

    resp = client.post(
        "/api/tasks",
        json={"titre": "Intrusion", "categorie_id": categorie["id"]},
        headers=headers_other,
    )
    assert resp.status_code == 400


def test_update_task_avec_categorie_d_un_autre_user_rejetee(
    client, auth_user, other_user
):
    _, headers_owner = auth_user
    _, headers_other = other_user
    categorie = client.post(
        "/api/task-categories", json={"nom": "Pro"}, headers=headers_owner
    ).json()["data"]
    task = client.post(
        "/api/tasks", json={"titre": "Tache B"}, headers=headers_other
    ).json()["data"]

    resp = client.patch(
        f"/api/tasks/{task['id']}",
        json={"categorie_id": categorie["id"]},
        headers=headers_other,
    )
    assert resp.status_code == 400


# --- Échéance + catégorie sur les tâches ---


def test_create_task_avec_echeance_et_categorie(client, auth_user):
    _, headers = auth_user
    categorie = client.post(
        "/api/task-categories", json={"nom": "Pro"}, headers=headers
    ).json()["data"]
    echeance = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    resp = client.post(
        "/api/tasks",
        json={
            "titre": "Preparer le CR",
            "echeance": echeance,
            "categorie_id": categorie["id"],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["echeance"] is not None
    assert data["categorie_id"] == categorie["id"]
    assert data["categorie"] == {
        "id": categorie["id"],
        "nom": "Pro",
        "couleur": categorie["couleur"],
    }


def test_update_task_retire_categorie(client, auth_user):
    _, headers = auth_user
    categorie = client.post(
        "/api/task-categories", json={"nom": "Pro"}, headers=headers
    ).json()["data"]
    task = client.post(
        "/api/tasks",
        json={"titre": "Avec categorie", "categorie_id": categorie["id"]},
        headers=headers,
    ).json()["data"]

    resp = client.patch(
        f"/api/tasks/{task['id']}", json={"categorie_id": None}, headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["categorie_id"] is None
    assert data["categorie"] is None
