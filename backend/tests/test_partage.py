"""Tests du partage (Round 016) : contacts (demande/acceptation/rupture) et
partages d'éléments en LECTURE SEULE (événements, tâches, notes).

Points de sécurité couverts :
- pas de partage sans contact ACCEPTÉ ;
- impossible de partager l'élément d'un autre ;
- le destinataire VOIT l'élément partagé (listes) mais ne peut NI le
  modifier NI le supprimer NI ajouter d'éléments à une note partagée ;
- retirer le partage / rompre le contact retire la visibilité ;
- la suppression de l'élément retire le partage.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.cookie import COOKIE_NAME
from conftest import create_user, delete_user, make_session_for, sign_token


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


def _make_user(prefix: str):
    email = f"{prefix}-{uuid.uuid4().hex}@test.local"
    uid = create_user(email)
    token = f"{prefix}-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    return uid, email, _cookie(sign_token(token))


@pytest.fixture
def yoann(client):
    uid, email, headers = _make_user("partage-a")
    yield uid, email, headers
    delete_user(uid)


@pytest.fixture
def manon(client):
    uid, email, headers = _make_user("partage-b")
    yield uid, email, headers
    delete_user(uid)


def _lier(client, headers_demandeur, headers_destinataire, email_destinataire) -> str:
    """Crée un contact accepté entre deux comptes, retourne l'id du contact."""
    contact = client.post(
        "/api/contacts", json={"email": email_destinataire}, headers=headers_demandeur
    ).json()["data"]
    accepte = client.post(
        f"/api/contacts/{contact['id']}/accepter", headers=headers_destinataire
    )
    assert accepte.status_code == 200
    return contact["id"]


def _creer_event(client, headers, titre="Padel") -> dict:
    debut = datetime.now(timezone.utc) + timedelta(hours=2)
    return client.post(
        "/api/events",
        json={
            "titre": titre,
            "debut": debut.isoformat(),
            "fin": (debut + timedelta(hours=1)).isoformat(),
        },
        headers=headers,
    ).json()["data"]


def _fenetre(client, headers) -> list[dict]:
    now = datetime.now(timezone.utc)
    return client.get(
        "/api/events",
        params={
            "from": (now - timedelta(hours=1)).isoformat(),
            "to": (now + timedelta(days=1)).isoformat(),
        },
        headers=headers,
    ).json()["data"]


# --- Contacts ---------------------------------------------------------------


def test_contact_demande_acceptation(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, h_manon = manon

    contact = client.post(
        "/api/contacts", json={"email": email_manon}, headers=h_yoann
    ).json()["data"]
    assert contact["statut"] == "en_attente"
    assert contact["direction"] == "envoyee"

    # Côté Manon : demande reçue.
    recus = client.get("/api/contacts", headers=h_manon).json()["data"]
    assert recus[0]["direction"] == "recue"
    assert recus[0]["statut"] == "en_attente"

    accepte = client.post(
        f"/api/contacts/{contact['id']}/accepter", headers=h_manon
    ).json()["data"]
    assert accepte["statut"] == "accepte"


def test_contact_email_inconnu_404(client, yoann):
    _, _, h_yoann = yoann
    resp = client.post(
        "/api/contacts", json={"email": "inconnu@nulle-part.fr"}, headers=h_yoann
    )
    assert resp.status_code == 404


def test_contact_soi_meme_400(client, yoann):
    _, email, h_yoann = yoann
    resp = client.post("/api/contacts", json={"email": email}, headers=h_yoann)
    assert resp.status_code == 400


def test_contact_double_409(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, _ = manon
    client.post("/api/contacts", json={"email": email_manon}, headers=h_yoann)
    resp = client.post("/api/contacts", json={"email": email_manon}, headers=h_yoann)
    assert resp.status_code == 409


def test_seul_le_destinataire_peut_accepter(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, _ = manon
    contact = client.post(
        "/api/contacts", json={"email": email_manon}, headers=h_yoann
    ).json()["data"]
    resp = client.post(f"/api/contacts/{contact['id']}/accepter", headers=h_yoann)
    assert resp.status_code == 404


# --- Partage d'un événement ---------------------------------------------------


def test_partage_sans_contact_accepte_400(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, _ = manon
    contact = client.post(
        "/api/contacts", json={"email": email_manon}, headers=h_yoann
    ).json()["data"]  # encore en_attente
    event = _creer_event(client, h_yoann)
    resp = client.post(
        "/api/partages",
        json={"element_type": "event", "element_id": event["id"], "contact_id": contact["id"]},
        headers=h_yoann,
    )
    assert resp.status_code == 400


def test_partage_element_d_un_autre_404(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, h_manon = manon
    contact_id = _lier(client, h_yoann, h_manon, email_manon)
    event_de_manon = _creer_event(client, h_manon, titre="Privé Manon")
    resp = client.post(
        "/api/partages",
        json={"element_type": "event", "element_id": event_de_manon["id"], "contact_id": contact_id},
        headers=h_yoann,
    )
    assert resp.status_code == 404


def test_evenement_partage_visible_et_lecture_seule(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, h_manon = manon
    contact_id = _lier(client, h_yoann, h_manon, email_manon)
    event = _creer_event(client, h_yoann, titre="Anniversaire Eden")

    # Avant partage : invisible pour Manon.
    assert all(e["id"] != event["id"] for e in _fenetre(client, h_manon))

    partage = client.post(
        "/api/partages",
        json={"element_type": "event", "element_id": event["id"], "contact_id": contact_id},
        headers=h_yoann,
    )
    assert partage.status_code == 201

    # Visible chez Manon, avec le badge (partage_par = nom du propriétaire).
    visibles = _fenetre(client, h_manon)
    partage_recu = next(e for e in visibles if e["id"] == event["id"])
    assert partage_recu["partage_par"] is not None
    # Chez Yoann : pas de badge sur son propre événement.
    a_moi = next(e for e in _fenetre(client, h_yoann) if e["id"] == event["id"])
    assert a_moi["partage_par"] is None

    # LECTURE SEULE : Manon ne peut ni modifier ni supprimer.
    patch = client.patch(
        f"/api/events/{event['id']}", json={"titre": "Piraté"}, headers=h_manon
    )
    assert patch.status_code == 404
    delete = client.delete(f"/api/events/{event['id']}", headers=h_manon)
    assert delete.status_code == 404


def test_retirer_partage_retire_la_visibilite(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, h_manon = manon
    contact_id = _lier(client, h_yoann, h_manon, email_manon)
    event = _creer_event(client, h_yoann)
    partage = client.post(
        "/api/partages",
        json={"element_type": "event", "element_id": event["id"], "contact_id": contact_id},
        headers=h_yoann,
    ).json()["data"]

    resp = client.delete(f"/api/partages/{partage['id']}", headers=h_yoann)
    assert resp.status_code == 204
    assert all(e["id"] != event["id"] for e in _fenetre(client, h_manon))


def test_rompre_le_contact_supprime_les_partages(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, h_manon = manon
    contact_id = _lier(client, h_yoann, h_manon, email_manon)
    event = _creer_event(client, h_yoann)
    client.post(
        "/api/partages",
        json={"element_type": "event", "element_id": event["id"], "contact_id": contact_id},
        headers=h_yoann,
    )
    client.delete(f"/api/contacts/{contact_id}", headers=h_manon)
    assert all(e["id"] != event["id"] for e in _fenetre(client, h_manon))


def test_suppression_element_retire_le_partage(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, h_manon = manon
    contact_id = _lier(client, h_yoann, h_manon, email_manon)
    event = _creer_event(client, h_yoann)
    client.post(
        "/api/partages",
        json={"element_type": "event", "element_id": event["id"], "contact_id": contact_id},
        headers=h_yoann,
    )
    client.delete(f"/api/events/{event['id']}", headers=h_yoann)
    partages = client.get(
        "/api/partages",
        params={"element_type": "event", "element_id": event["id"]},
        headers=h_yoann,
    ).json()["data"]
    assert partages == []


# --- Tâches et notes partagées ------------------------------------------------


def test_tache_partagee_visible_et_non_cochable(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, h_manon = manon
    contact_id = _lier(client, h_yoann, h_manon, email_manon)
    task = client.post(
        "/api/tasks", json={"titre": "Acheter le cadeau"}, headers=h_yoann
    ).json()["data"]
    client.post(
        "/api/partages",
        json={"element_type": "task", "element_id": task["id"], "contact_id": contact_id},
        headers=h_yoann,
    )

    taches_manon = client.get("/api/tasks", headers=h_manon).json()["data"]
    partagee = next(t for t in taches_manon if t["id"] == task["id"])
    assert partagee["partage_par"] is not None

    # Manon ne peut pas la cocher ni la modifier.
    patch = client.patch(
        f"/api/tasks/{task['id']}", json={"statut": "faite"}, headers=h_manon
    )
    assert patch.status_code == 404


def test_note_partagee_visible_items_inclus_et_lecture_seule(client, yoann, manon):
    _, _, h_yoann = yoann
    _, email_manon, h_manon = manon
    contact_id = _lier(client, h_yoann, h_manon, email_manon)
    note = client.post(
        "/api/notes", json={"titre": "Liste de courses"}, headers=h_yoann
    ).json()["data"]
    item = client.post(
        f"/api/notes/{note['id']}/items", json={"contenu": "Oeufs"}, headers=h_yoann
    ).json()["data"]
    client.post(
        "/api/partages",
        json={"element_type": "note", "element_id": note["id"], "contact_id": contact_id},
        headers=h_yoann,
    )

    notes_manon = client.get("/api/notes", headers=h_manon).json()["data"]
    partagee = next(n for n in notes_manon if n["id"] == note["id"])
    assert partagee["partage_par"] is not None
    assert [i["contenu"] for i in partagee["items"]] == ["Oeufs"]

    # Lecture seule : ni éditer la note, ni cocher/ajouter des éléments.
    assert (
        client.patch(
            f"/api/notes/{note['id']}", json={"contenu": "Piraté"}, headers=h_manon
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/note-items/{item['id']}", json={"coche": True}, headers=h_manon
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/notes/{note['id']}/items",
            json={"contenu": "Intrusion"},
            headers=h_manon,
        ).status_code
        == 404
    )
