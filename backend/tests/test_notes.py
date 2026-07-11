"""Tests d'integration des endpoints Notes (Round 004).

Exigent Postgres migre (RLS active sur `notes`). Chaque test cree son propre
utilisateur de test pour rester isole.
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
    uid = create_user(f"note-{uuid.uuid4().hex}@test.local")
    token = "note-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


# --- Creation ---


def test_create_note_minimal(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/notes", json={"titre": "Idees cadeaux"}, headers=headers
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["titre"] == "Idees cadeaux"
    assert data["contenu"] is None
    assert data["epinglee"] is False
    assert data["archivee"] is False
    assert data["origine"] == "manuelle"


def test_create_note_titre_vide_rejete(client, auth_user):
    _, headers = auth_user
    resp = client.post("/api/notes", json={"titre": "  "}, headers=headers)
    assert resp.status_code == 422


# --- Filtre archivee + tri epinglees ---


def test_list_notes_filtre_archivee_par_defaut_false(client, auth_user):
    _, headers = auth_user
    active = client.post(
        "/api/notes", json={"titre": "Note active"}, headers=headers
    ).json()["data"]
    archivee = client.post(
        "/api/notes", json={"titre": "Note archivee"}, headers=headers
    ).json()["data"]
    client.patch(
        f"/api/notes/{archivee['id']}", json={"archivee": True}, headers=headers
    )

    resp = client.get("/api/notes", headers=headers)
    ids = [n["id"] for n in resp.json()["data"]]
    assert active["id"] in ids
    assert archivee["id"] not in ids

    resp_archivees = client.get("/api/notes?archivee=true", headers=headers)
    ids_archivees = [n["id"] for n in resp_archivees.json()["data"]]
    assert archivee["id"] in ids_archivees
    assert active["id"] not in ids_archivees


def test_list_notes_epinglees_en_premier(client, auth_user):
    _, headers = auth_user
    note_normale = client.post(
        "/api/notes", json={"titre": "Normale"}, headers=headers
    ).json()["data"]
    note_epinglee = client.post(
        "/api/notes", json={"titre": "Epinglee"}, headers=headers
    ).json()["data"]
    client.patch(
        f"/api/notes/{note_epinglee['id']}", json={"epinglee": True}, headers=headers
    )

    resp = client.get("/api/notes", headers=headers)
    titres = [n["titre"] for n in resp.json()["data"]]
    idx_epinglee = titres.index("Epinglee")
    idx_normale = titres.index("Normale")
    assert idx_epinglee < idx_normale
    assert note_normale["id"] != note_epinglee["id"]


# --- Recherche q ---


def test_list_notes_recherche_q_titre_et_contenu(client, auth_user):
    _, headers = auth_user
    client.post(
        "/api/notes",
        json={"titre": "Liste de courses", "contenu": "pain, lait"},
        headers=headers,
    )
    client.post(
        "/api/notes",
        json={"titre": "Reunion", "contenu": "acheter des croissants"},
        headers=headers,
    )
    client.post(
        "/api/notes", json={"titre": "Sans rapport", "contenu": "rien ici"},
        headers=headers,
    )

    resp = client.get("/api/notes?q=acheter", headers=headers)
    titres = {n["titre"] for n in resp.json()["data"]}
    assert titres == {"Reunion"}

    resp2 = client.get("/api/notes?q=courses", headers=headers)
    titres2 = {n["titre"] for n in resp2.json()["data"]}
    assert titres2 == {"Liste de courses"}


# --- Suppression ---


def test_delete_note(client, auth_user):
    _, headers = auth_user
    note = client.post(
        "/api/notes", json={"titre": "A supprimer"}, headers=headers
    ).json()["data"]
    resp = client.delete(f"/api/notes/{note['id']}", headers=headers)
    assert resp.status_code == 204
    remaining = client.get("/api/notes", headers=headers).json()["data"]
    assert all(n["id"] != note["id"] for n in remaining)


# --- Isolation RLS cross-utilisateur ---


def test_patch_note_cross_user_404(client, auth_user):
    _, headers_owner = auth_user
    note = client.post(
        "/api/notes", json={"titre": "Privee"}, headers=headers_owner
    ).json()["data"]

    other_uid = create_user(f"othernote-{uuid.uuid4().hex}@test.local")
    other_token = "othernote-" + uuid.uuid4().hex
    make_session_for(
        other_uid, other_token, datetime.now(timezone.utc) + timedelta(days=1)
    )
    try:
        resp = client.patch(
            f"/api/notes/{note['id']}",
            json={"titre": "Vol"},
            headers=_cookie(sign_token(other_token)),
        )
        assert resp.status_code == 404
    finally:
        delete_user(other_uid)


def test_delete_note_cross_user_404(client, auth_user):
    _, headers_owner = auth_user
    note = client.post(
        "/api/notes", json={"titre": "Privee 2"}, headers=headers_owner
    ).json()["data"]

    other_uid = create_user(f"othernote2-{uuid.uuid4().hex}@test.local")
    other_token = "othernote2-" + uuid.uuid4().hex
    make_session_for(
        other_uid, other_token, datetime.now(timezone.utc) + timedelta(days=1)
    )
    try:
        resp = client.delete(
            f"/api/notes/{note['id']}",
            headers=_cookie(sign_token(other_token)),
        )
        assert resp.status_code == 404
    finally:
        delete_user(other_uid)
