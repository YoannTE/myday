"""Tests d'intégration des endpoints Budget (section privée à code).

Exigent Postgres migré (RLS active sur les 5 tables `budget_*`). Chaque test
crée son propre utilisateur pour rester isolé.

Ce que ces tests protègent en priorité :
  - le verrou est bien DOUBLE : une session valide seule ne donne accès à
    aucune donnée financière ;
  - le jeton d'un utilisateur n'ouvre pas le budget d'un autre ;
  - le code ne peut pas être redéfini sans connaître l'ancien ;
  - la saisie est bloquée après plusieurs échecs (4 chiffres = 10 000
    combinaisons, la limitation du débit fait partie de la protection).
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.cookie import COOKIE_NAME
from app.security.code_budget import emettre_jeton
from conftest import create_user, delete_user, make_session_for, sign_token

CODE = "4271"
AUTRE_CODE = "9083"


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"budget-{uuid.uuid4().hex}@test.local")
    token = "budget-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


@pytest.fixture
def autre_user(client):
    uid = create_user(f"budget2-{uuid.uuid4().hex}@test.local")
    token = "budget2-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


def _ouvrir(client, headers, code=CODE) -> dict[str, str]:
    """Définit le code puis renvoie les en-têtes session + jeton d'accès."""
    resp = client.post("/api/budget/acces/definir", json={"code": code}, headers=headers)
    assert resp.status_code == 201, resp.text
    return {**headers, "X-Budget-Acces": resp.json()["data"]["jeton"]}


# --- Le routeur est monté (SOP fastapi-route-registration-check) ---


def test_router_monte_401_sans_cookie(client):
    assert client.get("/api/budget/acces").status_code == 401
    assert client.get("/api/budget").status_code == 401


# --- Double verrou ---


def test_donnees_refusees_avec_session_seule(client, auth_user):
    _uid, headers = auth_user
    client.post("/api/budget/acces/definir", json={"code": CODE}, headers=headers)
    resp = client.get("/api/budget", headers=headers)
    assert resp.status_code == 401
    assert resp.headers.get("X-Budget-Etat") == "verrouille"


def test_donnees_accessibles_avec_jeton(client, auth_user):
    _uid, headers = auth_user
    ouvert = _ouvrir(client, headers)
    resp = client.get("/api/budget", headers=ouvert)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data == {
        "recurrents": [],
        "operations": [],
        "previsions": [],
        "comptes": [],
    }


def test_jeton_d_un_autre_utilisateur_refuse(client, auth_user, autre_user):
    _uid, headers = auth_user
    autre_uid, _ = autre_user
    jeton_autre, _ = emettre_jeton(autre_uid)
    client.post("/api/budget/acces/definir", json={"code": CODE}, headers=headers)
    resp = client.get(
        "/api/budget", headers={**headers, "X-Budget-Acces": jeton_autre}
    )
    assert resp.status_code == 401


def test_jeton_expire_refuse(client, auth_user, monkeypatch):
    import app.security.code_budget as module

    _uid, headers = auth_user
    monkeypatch.setattr(module, "DUREE_ACCES", timedelta(seconds=-1))
    ouvert = _ouvrir(client, headers)
    assert client.get("/api/budget", headers=ouvert).status_code == 401


# --- Cycle de vie du code ---


def test_etat_acces_avant_definition(client, auth_user):
    _uid, headers = auth_user
    resp = client.get("/api/budget/acces", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"] == {"code_defini": False, "bloque_jusqua": None}


def test_code_non_numerique_refuse(client, auth_user):
    _uid, headers = auth_user
    for mauvais in ("12a4", "123", "12345", "", "  "):
        resp = client.post(
            "/api/budget/acces/definir", json={"code": mauvais}, headers=headers
        )
        assert resp.status_code == 400, mauvais


def test_definir_deux_fois_refuse(client, auth_user):
    _uid, headers = auth_user
    client.post("/api/budget/acces/definir", json={"code": CODE}, headers=headers)
    resp = client.post(
        "/api/budget/acces/definir", json={"code": AUTRE_CODE}, headers=headers
    )
    assert resp.status_code == 409
    # L'ancien code fonctionne toujours : la redéfinition n'a rien écrasé.
    assert (
        client.post(
            "/api/budget/acces/ouvrir", json={"code": CODE}, headers=headers
        ).status_code
        == 200
    )


def test_ouvrir_avec_mauvais_code(client, auth_user):
    _uid, headers = auth_user
    client.post("/api/budget/acces/definir", json={"code": CODE}, headers=headers)
    resp = client.post(
        "/api/budget/acces/ouvrir", json={"code": AUTRE_CODE}, headers=headers
    )
    assert resp.status_code == 400
    assert "essai" in resp.json()["detail"]


def test_blocage_apres_cinq_echecs(client, auth_user):
    _uid, headers = auth_user
    client.post("/api/budget/acces/definir", json={"code": CODE}, headers=headers)
    for _ in range(4):
        assert (
            client.post(
                "/api/budget/acces/ouvrir", json={"code": AUTRE_CODE}, headers=headers
            ).status_code
            == 400
        )
    # 5e échec : bascule en blocage temporaire.
    assert (
        client.post(
            "/api/budget/acces/ouvrir", json={"code": AUTRE_CODE}, headers=headers
        ).status_code
        == 429
    )
    # Même le BON code est refusé pendant le blocage.
    assert (
        client.post(
            "/api/budget/acces/ouvrir", json={"code": CODE}, headers=headers
        ).status_code
        == 429
    )
    etat = client.get("/api/budget/acces", headers=headers).json()["data"]
    assert etat["code_defini"] is True
    assert etat["bloque_jusqua"] is not None


def test_succes_remet_le_compteur_a_zero(client, auth_user):
    _uid, headers = auth_user
    client.post("/api/budget/acces/definir", json={"code": CODE}, headers=headers)
    for _ in range(4):
        client.post(
            "/api/budget/acces/ouvrir", json={"code": AUTRE_CODE}, headers=headers
        )
    assert (
        client.post(
            "/api/budget/acces/ouvrir", json={"code": CODE}, headers=headers
        ).status_code
        == 200
    )
    # Le compteur est reparti de zéro : 4 nouveaux échecs ne bloquent pas encore.
    for _ in range(4):
        assert (
            client.post(
                "/api/budget/acces/ouvrir", json={"code": AUTRE_CODE}, headers=headers
            ).status_code
            == 400
        )


def test_modifier_code(client, auth_user):
    _uid, headers = auth_user
    client.post("/api/budget/acces/definir", json={"code": CODE}, headers=headers)
    resp = client.post(
        "/api/budget/acces/modifier",
        json={"code_actuel": AUTRE_CODE, "nouveau_code": "1111"},
        headers=headers,
    )
    assert resp.status_code == 400

    resp = client.post(
        "/api/budget/acces/modifier",
        json={"code_actuel": CODE, "nouveau_code": "1111"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert (
        client.post(
            "/api/budget/acces/ouvrir", json={"code": CODE}, headers=headers
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/budget/acces/ouvrir", json={"code": "1111"}, headers=headers
        ).status_code
        == 200
    )


# --- CRUD ---


def test_cycle_recurrent(client, auth_user):
    _uid, headers = auth_user
    ouvert = _ouvrir(client, headers)

    resp = client.post(
        "/api/budget/recurrents",
        json={
            "libelle": "  Prêt immobilier  ",
            "categorie": "Logement",
            "montant": 1700,
            "sens": "sortie",
        },
        headers=ouvert,
    )
    assert resp.status_code == 201
    ligne = resp.json()["data"]
    assert ligne["libelle"] == "Prêt immobilier"  # espaces nettoyés
    assert ligne["montant"] == 1700.0
    assert ligne["actif"] is True

    resp = client.patch(
        f"/api/budget/recurrents/{ligne['id']}",
        json={"montant": 1650.5},
        headers=ouvert,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["montant"] == 1650.5
    # Le PATCH partiel n'écrase pas les champs absents.
    assert resp.json()["data"]["libelle"] == "Prêt immobilier"

    assert (
        client.delete(f"/api/budget/recurrents/{ligne['id']}", headers=ouvert).status_code
        == 204
    )
    assert client.get("/api/budget", headers=ouvert).json()["data"]["recurrents"] == []


def test_cycle_operation(client, auth_user):
    _uid, headers = auth_user
    ouvert = _ouvrir(client, headers)
    resp = client.post(
        "/api/budget/operations",
        json={
            "date_operation": "2026-08-14",
            "libelle": "Restaurant",
            "categorie": "Loisirs",
            "montant": 42.5,
            "sens": "sortie",
        },
        headers=ouvert,
    )
    assert resp.status_code == 201
    ligne = resp.json()["data"]
    assert ligne["date_operation"] == "2026-08-14"
    assert ligne["montant"] == 42.5

    assert (
        client.delete(f"/api/budget/operations/{ligne['id']}", headers=ouvert).status_code
        == 204
    )


def test_prevision_deplanifiable(client, auth_user):
    _uid, headers = auth_user
    ouvert = _ouvrir(client, headers)
    resp = client.post(
        "/api/budget/previsions",
        json={
            "libelle": "Jardin",
            "categorie": "Logement",
            "montant": 3500,
            "sens": "sortie",
            "echeance": "2026-11",
        },
        headers=ouvert,
    )
    ligne = resp.json()["data"]
    assert ligne["echeance"] == "2026-11"

    # `echeance: null` explicite = déplanifier (≠ champ absent).
    resp = client.patch(
        f"/api/budget/previsions/{ligne['id']}",
        json={"echeance": None},
        headers=ouvert,
    )
    assert resp.json()["data"]["echeance"] is None

    resp = client.patch(
        f"/api/budget/previsions/{ligne['id']}", json={"fait": True}, headers=ouvert
    )
    assert resp.json()["data"]["fait"] is True
    assert resp.json()["data"]["echeance"] is None


def test_echeance_mal_formee_refusee(client, auth_user):
    _uid, headers = auth_user
    ouvert = _ouvrir(client, headers)
    resp = client.post(
        "/api/budget/previsions",
        json={
            "libelle": "Jardin",
            "categorie": "Logement",
            "montant": 100,
            "sens": "sortie",
            "echeance": "2026-13",
        },
        headers=ouvert,
    )
    assert resp.status_code == 400


def test_montant_negatif_refuse_sauf_compte(client, auth_user):
    _uid, headers = auth_user
    ouvert = _ouvrir(client, headers)
    resp = client.post(
        "/api/budget/recurrents",
        json={
            "libelle": "Erreur",
            "categorie": "Autre",
            "montant": -10,
            "sens": "sortie",
        },
        headers=ouvert,
    )
    assert resp.status_code == 400

    # Un compte peut être négatif (découvert).
    resp = client.post(
        "/api/budget/comptes",
        json={"libelle": "Découvert", "montant": -250.75},
        headers=ouvert,
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["montant"] == -250.75


def test_sens_invalide_refuse(client, auth_user):
    _uid, headers = auth_user
    ouvert = _ouvrir(client, headers)
    resp = client.post(
        "/api/budget/recurrents",
        json={
            "libelle": "X",
            "categorie": "Autre",
            "montant": 10,
            "sens": "credit",
        },
        headers=ouvert,
    )
    assert resp.status_code == 422


def test_ligne_inconnue_404(client, auth_user):
    _uid, headers = auth_user
    ouvert = _ouvrir(client, headers)
    inconnu = str(uuid.uuid4())
    assert (
        client.patch(
            f"/api/budget/recurrents/{inconnu}", json={"montant": 1}, headers=ouvert
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/budget/recurrents/{inconnu}", headers=ouvert).status_code
        == 404
    )
    # Un identifiant qui n'est même pas un UUID reste un 404, pas un 500.
    assert (
        client.delete("/api/budget/recurrents/pas-un-uuid", headers=ouvert).status_code
        == 404
    )


def test_isolation_entre_utilisateurs(client, auth_user, autre_user):
    _uid, headers = auth_user
    _uid2, headers2 = autre_user
    ouvert = _ouvrir(client, headers)
    ouvert2 = _ouvrir(client, headers2, code=AUTRE_CODE)

    ligne = client.post(
        "/api/budget/recurrents",
        json={
            "libelle": "Salaire",
            "categorie": "Salaire",
            "montant": 2750,
            "sens": "entree",
        },
        headers=ouvert,
    ).json()["data"]

    # Le second utilisateur ne voit rien et ne peut pas toucher la ligne.
    assert client.get("/api/budget", headers=ouvert2).json()["data"]["recurrents"] == []
    assert (
        client.patch(
            f"/api/budget/recurrents/{ligne['id']}",
            json={"montant": 1},
            headers=ouvert2,
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/budget/recurrents/{ligne['id']}", headers=ouvert2
        ).status_code
        == 404
    )
    # Et le propriétaire, lui, la voit toujours.
    assert len(client.get("/api/budget", headers=ouvert).json()["data"]["recurrents"]) == 1
