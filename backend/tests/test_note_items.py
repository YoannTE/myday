"""Tests d'intégration des éléments (cases à cocher) d'une note.

Exigent Postgres migré (RLS active sur `note_items`). Chaque test crée son
propre utilisateur pour rester isolé.
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
    uid = create_user(f"nitem-{uuid.uuid4().hex}@test.local")
    token = "nitem-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


@pytest.fixture
def other_user(client):
    uid = create_user(f"nitem-other-{uuid.uuid4().hex}@test.local")
    token = "nitem-other-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


def _creer_note(client, headers, titre="Liste de courses") -> dict:
    return client.post("/api/notes", json={"titre": titre}, headers=headers).json()[
        "data"
    ]


def test_create_item_positions_incrementales(client, auth_user):
    _, headers = auth_user
    note = _creer_note(client, headers)
    r1 = client.post(f"/api/notes/{note['id']}/items", json={"contenu": "Oeufs"}, headers=headers)
    r2 = client.post(f"/api/notes/{note['id']}/items", json={"contenu": "Lait"}, headers=headers)
    assert r1.status_code == 201
    assert r1.json()["data"]["position"] == 0
    assert r1.json()["data"]["coche"] is False
    assert r2.json()["data"]["position"] == 1


def test_item_vide_rejete(client, auth_user):
    _, headers = auth_user
    note = _creer_note(client, headers)
    resp = client.post(
        f"/api/notes/{note['id']}/items", json={"contenu": "   "}, headers=headers
    )
    assert resp.status_code == 422


def test_items_apparaissent_dans_la_note(client, auth_user):
    _, headers = auth_user
    note = _creer_note(client, headers)
    client.post(f"/api/notes/{note['id']}/items", json={"contenu": "Oeufs"}, headers=headers)
    client.post(f"/api/notes/{note['id']}/items", json={"contenu": "Lait"}, headers=headers)

    notes = client.get("/api/notes", headers=headers).json()["data"]
    retrouvee = next(n for n in notes if n["id"] == note["id"])
    contenus = [i["contenu"] for i in retrouvee["items"]]
    assert contenus == ["Oeufs", "Lait"]


def test_cocher_item_le_relegue_en_bas(client, auth_user):
    _, headers = auth_user
    note = _creer_note(client, headers)
    a = client.post(f"/api/notes/{note['id']}/items", json={"contenu": "A"}, headers=headers).json()["data"]
    client.post(f"/api/notes/{note['id']}/items", json={"contenu": "B"}, headers=headers)

    # Coche A -> il doit passer après B (les cochés en bas).
    resp = client.patch(f"/api/note-items/{a['id']}", json={"coche": True}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["coche"] is True

    notes = client.get("/api/notes", headers=headers).json()["data"]
    items = next(n for n in notes if n["id"] == note["id"])["items"]
    assert [i["contenu"] for i in items] == ["B", "A"]


def test_renommer_et_supprimer_item(client, auth_user):
    _, headers = auth_user
    note = _creer_note(client, headers)
    item = client.post(
        f"/api/notes/{note['id']}/items", json={"contenu": "Oeuf"}, headers=headers
    ).json()["data"]

    renomme = client.patch(
        f"/api/note-items/{item['id']}", json={"contenu": "Oeufs"}, headers=headers
    )
    assert renomme.json()["data"]["contenu"] == "Oeufs"

    supprime = client.delete(f"/api/note-items/{item['id']}", headers=headers)
    assert supprime.status_code == 204

    notes = client.get("/api/notes", headers=headers).json()["data"]
    assert next(n for n in notes if n["id"] == note["id"])["items"] == []


def test_ajout_item_sur_note_d_un_autre_user_404(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    note = _creer_note(client, headers_owner)
    resp = client.post(
        f"/api/notes/{note['id']}/items", json={"contenu": "Intrusion"}, headers=headers_other
    )
    assert resp.status_code == 404


def test_modifier_item_d_un_autre_user_404(client, auth_user, other_user):
    _, headers_owner = auth_user
    _, headers_other = other_user
    note = _creer_note(client, headers_owner)
    item = client.post(
        f"/api/notes/{note['id']}/items", json={"contenu": "Privé"}, headers=headers_owner
    ).json()["data"]
    resp = client.patch(
        f"/api/note-items/{item['id']}", json={"coche": True}, headers=headers_other
    )
    assert resp.status_code == 404


def test_supprimer_note_supprime_ses_items(client, auth_user):
    """La cascade `ON DELETE cascade` retire les items quand la note part."""
    uid, headers = auth_user
    note = _creer_note(client, headers)
    item = client.post(
        f"/api/notes/{note['id']}/items", json={"contenu": "Oeufs"}, headers=headers
    ).json()["data"]
    client.delete(f"/api/notes/{note['id']}", headers=headers)
    # L'item n'existe plus : le modifier renvoie 404.
    resp = client.patch(
        f"/api/note-items/{item['id']}", json={"coche": True}, headers=headers
    )
    assert resp.status_code == 404
