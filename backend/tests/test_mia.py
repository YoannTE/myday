"""Tests de l'accès « machine » MIA (`/api/mia`) : désactivé par défaut (404),
jeton Bearer obligatoire (401), données du seul compte configuré, créations
déléguées aux services existants (mêmes validations)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest
from conftest import create_user, delete_user, run_async

from app.config import settings

JETON = "mia-" + "x" * 60


async def _admin_val(query, *args):
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(query, *args)
    finally:
        await conn.close()


def admin_val(query, *args):
    return run_async(_admin_val(query, *args))


def _bearer(jeton: str = JETON) -> dict[str, str]:
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def mia_user(monkeypatch):
    email = f"mia-{uuid.uuid4().hex}@test.local"
    uid = create_user(email)
    monkeypatch.setattr(settings, "mia_token", JETON)
    # Casse différente : la recherche du compte ignore la casse de l'email.
    monkeypatch.setattr(settings, "mia_user_email", email.upper())
    yield uid
    delete_user(uid)


@pytest.fixture
def autre_user():
    uid = create_user(f"mia-autre-{uuid.uuid4().hex}@test.local")
    yield uid
    delete_user(uid)


# --- Désactivé par défaut -----------------------------------------------------


@pytest.mark.parametrize(
    ("jeton", "email"),
    [("", ""), (JETON, ""), ("", "quelquun@test.local"), ("trop-court", "a@b.c")],
)
def test_mia_non_configure_404(client, monkeypatch, jeton, email):
    monkeypatch.setattr(settings, "mia_token", jeton)
    monkeypatch.setattr(settings, "mia_user_email", email)
    headers = _bearer(jeton or JETON)
    assert client.get("/api/mia/journee", headers=headers).status_code == 404
    assert (
        client.post("/api/mia/taches", json={"titre": "x"}, headers=headers).status_code
        == 404
    )
    # Même avec un corps invalide : la route n'« existe » pas.
    assert client.post("/api/mia/notes", json={}, headers=headers).status_code == 404


# --- Jeton ----------------------------------------------------------------------


def test_mia_sans_jeton_401(client, mia_user):
    assert client.get("/api/mia/journee").status_code == 401


@pytest.mark.parametrize(
    "entete",
    [
        f"Bearer {JETON}faux",
        "Bearer mauvais",
        f"Basic {JETON}",
        f"{JETON}",
        "Bearer ",
    ],
)
def test_mia_jeton_faux_401(client, mia_user, entete):
    resp = client.get("/api/mia/journee", headers={"Authorization": entete})
    assert resp.status_code == 401


def test_mia_compte_desactive_401(client, mia_user):
    admin_val('UPDATE "user" SET active = false WHERE id = $1', mia_user)
    assert client.get("/api/mia/journee", headers=_bearer()).status_code == 401


def test_mia_cookie_de_session_ne_suffit_pas(client, mia_user):
    """L'accès MIA n'accepte que le jeton, pas une session de navigateur."""
    resp = client.get(
        "/api/mia/journee", headers={"Cookie": "better-auth.session_token=abc"}
    )
    assert resp.status_code == 401


# --- Lecture de la journée ------------------------------------------------------


def test_mia_journee_donnees_du_compte_configure(client, mia_user, autre_user):
    now = datetime.now(timezone.utc)
    cat_tache = admin_val(
        "INSERT INTO task_categories (user_id, nom, couleur) "
        "VALUES ($1, 'Pro', '#3366ff') RETURNING id",
        mia_user,
    )
    admin_val(
        "INSERT INTO tasks (user_id, titre, statut, priorite, echeance, categorie_id) "
        "VALUES ($1, 'Rappeler le client', 'a_faire', 'haute', $2, $3) RETURNING id",
        mia_user, now + timedelta(days=1), cat_tache,
    )
    admin_val(
        "INSERT INTO tasks (user_id, titre, statut, priorite) "
        "VALUES ($1, 'Sans échéance', 'a_faire', 'basse') RETURNING id",
        mia_user,
    )
    admin_val(
        "INSERT INTO tasks (user_id, titre, statut) "
        "VALUES ($1, 'Déjà faite', 'faite') RETURNING id",
        mia_user,
    )
    admin_val(
        "INSERT INTO events (user_id, titre, debut, fin, lieu) "
        "VALUES ($1, 'Visite hôtel', $2, $3, 'Cannes') RETURNING id",
        mia_user, now + timedelta(hours=2), now + timedelta(hours=3),
    )
    admin_val(
        "INSERT INTO events (user_id, titre, debut, fin) "
        "VALUES ($1, 'Passé', $2, $3) RETURNING id",
        mia_user, now - timedelta(hours=3), now - timedelta(hours=2),
    )
    cat_note = admin_val(
        "INSERT INTO note_categories (user_id, nom, couleur) VALUES ($1, 'Courses', '#3366ff') RETURNING id",
        mia_user,
    )
    note_id = admin_val(
        "INSERT INTO notes (user_id, titre, contenu, epinglee, categorie_id) "
        "VALUES ($1, 'Liste', 'À acheter', true, $2) RETURNING id",
        mia_user, cat_note,
    )
    admin_val(
        "INSERT INTO note_items (note_id, user_id, contenu, coche, position) "
        "VALUES ($1, $2, 'Pain', true, 0) RETURNING id",
        note_id, mia_user,
    )
    admin_val(
        "INSERT INTO note_items (note_id, user_id, contenu, coche, position) "
        "VALUES ($1, $2, 'Lait', false, 1) RETURNING id",
        note_id, mia_user,
    )
    admin_val(
        "INSERT INTO notes (user_id, titre, archivee) "
        "VALUES ($1, 'Archivée', true) RETURNING id",
        mia_user,
    )
    # Données d'un autre compte : jamais renvoyées.
    admin_val(
        "INSERT INTO tasks (user_id, titre, statut) VALUES ($1, 'Secret', 'a_faire') "
        "RETURNING id",
        autre_user,
    )
    admin_val(
        "INSERT INTO notes (user_id, titre) VALUES ($1, 'Note secrète') RETURNING id",
        autre_user,
    )
    admin_val(
        "INSERT INTO events (user_id, titre, debut, fin) "
        "VALUES ($1, 'RDV secret', $2, $3) RETURNING id",
        autre_user, now + timedelta(hours=1), now + timedelta(hours=2),
    )

    resp = client.get("/api/mia/journee", headers=_bearer())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data) == {"prochains", "taches", "notes"}

    assert [e["titre"] for e in data["prochains"]] == ["Visite hôtel"]
    assert set(data["prochains"][0]) == {"id", "titre", "debut", "fin", "lieu"}
    assert data["prochains"][0]["lieu"] == "Cannes"

    assert [t["titre"] for t in data["taches"]] == ["Rappeler le client", "Sans échéance"]
    assert data["taches"][0] == {
        "id": data["taches"][0]["id"],
        "titre": "Rappeler le client",
        "priorite": "haute",
        "echeance": data["taches"][0]["echeance"],
        "categorie": "Pro",
    }
    assert data["taches"][1]["categorie"] is None
    assert data["taches"][1]["echeance"] is None

    assert data["notes"] == [
        {
            "titre": "Liste",
            "categorie": "Courses",
            "epinglee": True,
            "contenu": "À acheter",
            "items": [
                {"contenu": "Pain", "coche": True},
                {"contenu": "Lait", "coche": False},
            ],
        }
    ]
    assert "brief" not in data


# --- Créations -------------------------------------------------------------------


def test_mia_creer_tache(client, mia_user):
    resp = client.post(
        "/api/mia/taches",
        json={"titre": "  Envoyer le devis  ", "priorite": "haute"},
        headers=_bearer(),
    )
    assert resp.status_code == 201
    task = resp.json()["data"]
    assert task["titre"] == "Envoyer le devis"
    assert task["priorite"] == "haute"
    assert (
        admin_val("SELECT user_id FROM tasks WHERE id = $1::uuid", task["id"])
        == mia_user
    )


def test_mia_creer_tache_validation(client, mia_user):
    resp = client.post("/api/mia/taches", json={"titre": "   "}, headers=_bearer())
    assert resp.status_code in (400, 422)


def test_mia_creer_evenement(client, mia_user):
    debut = datetime.now(timezone.utc) + timedelta(days=2)
    resp = client.post(
        "/api/mia/evenements",
        json={
            "titre": "Rendez-vous",
            "debut": debut.isoformat(),
            "fin": (debut + timedelta(hours=1)).isoformat(),
            "lieu": "Nice",
        },
        headers=_bearer(),
    )
    assert resp.status_code == 201
    event = resp.json()["data"]
    assert event["titre"] == "Rendez-vous"
    assert event["source"] == "myday"
    assert (
        admin_val("SELECT user_id FROM events WHERE id = $1::uuid", event["id"])
        == mia_user
    )


def test_mia_creer_evenement_fin_avant_debut_400(client, mia_user):
    debut = datetime.now(timezone.utc) + timedelta(days=2)
    resp = client.post(
        "/api/mia/evenements",
        json={
            "titre": "À l'envers",
            "debut": debut.isoformat(),
            "fin": (debut - timedelta(hours=1)).isoformat(),
        },
        headers=_bearer(),
    )
    assert resp.status_code == 400


def test_mia_creer_note(client, mia_user):
    resp = client.post(
        "/api/mia/notes",
        json={"titre": "Idée", "contenu": "Proposer le leasing"},
        headers=_bearer(),
    )
    assert resp.status_code == 201
    note = resp.json()["data"]
    assert note["titre"] == "Idée"
    assert (
        admin_val("SELECT user_id FROM notes WHERE id = $1::uuid", note["id"])
        == mia_user
    )


def _tache(uid, titre="À décaler", echeance=None):
    return admin_val(
        "INSERT INTO tasks (user_id, titre, statut, echeance) "
        "VALUES ($1, $2, 'a_faire', $3) RETURNING id::text",
        uid, titre, echeance,
    )


def test_mia_decaler_et_cocher_tache(client, mia_user):
    hier = datetime.now(timezone.utc) - timedelta(days=1)
    tid = _tache(mia_user, echeance=hier)
    demain = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)
    resp = client.patch(
        f"/api/mia/taches/{tid}",
        json={"echeance": demain.isoformat(), "titre": "Décalée"},
        headers=_bearer(),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["titre"] == "Décalée"
    assert admin_val("SELECT echeance FROM tasks WHERE id = $1::uuid", tid) == demain

    resp = client.patch(
        f"/api/mia/taches/{tid}", json={"statut": "faite"}, headers=_bearer()
    )
    assert resp.status_code == 200
    assert admin_val("SELECT statut FROM tasks WHERE id = $1::uuid", tid) == "faite"


def test_mia_modifier_tache_champ_interdit_ou_invalide(client, mia_user):
    tid = _tache(mia_user)
    # Champ hors liste MIA : refusé, pas ignoré.
    resp = client.patch(
        f"/api/mia/taches/{tid}", json={"categorie_id": None}, headers=_bearer()
    )
    assert resp.status_code == 422
    resp = client.patch(
        f"/api/mia/taches/{tid}", json={"priorite": "urgente"}, headers=_bearer()
    )
    assert resp.status_code == 400
    assert "Priorité invalide" in resp.json()["detail"]


def test_mia_modifier_tache_autre_compte_404(client, mia_user, autre_user):
    tid = _tache(autre_user, titre="Secret")
    resp = client.patch(
        f"/api/mia/taches/{tid}", json={"titre": "Piraté"}, headers=_bearer()
    )
    assert resp.status_code == 404
    assert admin_val("SELECT titre FROM tasks WHERE id = $1::uuid", tid) == "Secret"


def test_mia_deplacer_evenement(client, mia_user):
    debut = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=1)
    eid = admin_val(
        "INSERT INTO events (user_id, titre, debut, fin) "
        "VALUES ($1, 'RDV', $2, $3) RETURNING id::text",
        mia_user, debut, debut + timedelta(hours=1),
    )
    nouveau = debut + timedelta(days=1)
    resp = client.patch(
        f"/api/mia/evenements/{eid}",
        json={"debut": nouveau.isoformat(), "fin": (nouveau + timedelta(hours=1)).isoformat(), "lieu": "Monaco"},
        headers=_bearer(),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["lieu"] == "Monaco"
    assert admin_val("SELECT debut FROM events WHERE id = $1::uuid", eid) == nouveau

    resp = client.patch(
        f"/api/mia/evenements/{eid}",
        json={"fin": (nouveau - timedelta(hours=1)).isoformat()},
        headers=_bearer(),
    )
    assert resp.status_code == 400


def test_mia_aucune_suppression(client, mia_user):
    tid = _tache(mia_user)
    for chemin in ("/api/mia/taches", f"/api/mia/taches/{tid}"):
        resp = client.delete(chemin, headers=_bearer())
        assert resp.status_code == 405, chemin
    assert admin_val("SELECT count(*) FROM tasks WHERE id = $1::uuid", tid) == 1
    for methode in ("patch", "put"):
        resp = getattr(client, methode)("/api/mia/taches", headers=_bearer())
        assert resp.status_code == 405, methode
