"""Tests d'integration des endpoints d'administration (Round 002).

Exigent Postgres migre + admin seede. Chaque test cree/detruit ses propres
utilisateurs et invitations de test pour rester isole et ne jamais casser
l'admin seede.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.cookie import COOKIE_NAME
from conftest import (
    admin_user_id,
    count_admins,
    count_sessions,
    create_invitation,
    create_user,
    delete_invitation,
    delete_user,
    drop_session,
    invitation_statut,
    make_session,
    make_session_for,
    sign_token,
    user_active,
)


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def admin_headers():
    token = "adm-" + uuid.uuid4().hex
    make_session(token, datetime.now(timezone.utc) + timedelta(days=1))
    yield _cookie(sign_token(token))
    drop_session(token)


@pytest.fixture
def non_admin_headers():
    email = f"user-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=True)
    token = "usr-" + uuid.uuid4().hex
    make_session_for(user_id, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield _cookie(sign_token(token))
    drop_session(token)
    delete_user(user_id)


# --- Garde admin (403) ---


def test_invitations_403_non_admin(client, non_admin_headers):
    response = client.get("/api/admin/invitations", headers=non_admin_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Accès réservé à l'administrateur"


def test_accounts_403_non_admin(client, non_admin_headers):
    response = client.get("/api/admin/accounts", headers=non_admin_headers)
    assert response.status_code == 403


# --- Creation d'invitation ---


def test_create_invitation_success(client, admin_headers):
    email = f"invite-{uuid.uuid4().hex}@test.local"
    response = client.post(
        "/api/admin/invitations", json={"email": email}, headers=admin_headers
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["invitation"]["statut"] == "envoyee"
    assert data["invitation"]["email"] == email
    assert data["invite_url"].endswith(
        "?invitation=" + data["invite_url"].split("invitation=")[1]
    )
    assert "/sign-up?invitation=" in data["invite_url"]
    delete_invitation(data["invitation"]["id"])


def test_create_invitation_email_already_registered(client, admin_headers):
    email = f"existing-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email)
    try:
        response = client.post(
            "/api/admin/invitations", json={"email": email}, headers=admin_headers
        )
        assert response.status_code == 400
        assert "compte existe déjà" in response.json()["detail"].lower()
    finally:
        delete_user(user_id)


def test_create_invitation_duplicate_pending(client, admin_headers):
    email = f"dup-{uuid.uuid4().hex}@test.local"
    inv_id, _ = create_invitation(email, admin_user_id(), statut="envoyee")
    try:
        response = client.post(
            "/api/admin/invitations", json={"email": email}, headers=admin_headers
        )
        assert response.status_code == 400
        assert "déjà en attente" in response.json()["detail"].lower()
    finally:
        delete_invitation(inv_id)


# --- Liste + statut derive ---


def test_list_invitations_derived_expiree(client, admin_headers):
    email = f"exp-{uuid.uuid4().hex}@test.local"
    inv_id, _ = create_invitation(
        email, admin_user_id(), statut="envoyee", expires_in_days=-1
    )
    try:
        response = client.get("/api/admin/invitations", headers=admin_headers)
        assert response.status_code == 200
        found = next(
            i for i in response.json()["data"] if i["id"] == inv_id
        )
        assert found["statut"] == "expiree"
        assert "invite_url" in found
    finally:
        delete_invitation(inv_id)


# --- Renouvellement ---


def test_renew_from_revoquee(client, admin_headers):
    email = f"renew-{uuid.uuid4().hex}@test.local"
    inv_id, old_jeton = create_invitation(
        email, admin_user_id(), statut="revoquee"
    )
    try:
        response = client.post(
            f"/api/admin/invitations/{inv_id}/renew", headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["statut"] == "envoyee"
        assert old_jeton not in data["invite_url"]
        assert invitation_statut(inv_id) == "envoyee"
    finally:
        delete_invitation(inv_id)


def test_renew_refused_if_accepted(client, admin_headers):
    email = f"renewacc-{uuid.uuid4().hex}@test.local"
    inv_id, _ = create_invitation(email, admin_user_id(), statut="acceptee")
    try:
        response = client.post(
            f"/api/admin/invitations/{inv_id}/renew", headers=admin_headers
        )
        assert response.status_code == 400
        assert "déjà acceptée" in response.json()["detail"].lower()
    finally:
        delete_invitation(inv_id)


# --- Revocation ---


def test_revoke_invitation(client, admin_headers):
    email = f"rev-{uuid.uuid4().hex}@test.local"
    inv_id, _ = create_invitation(email, admin_user_id(), statut="envoyee")
    try:
        response = client.delete(
            f"/api/admin/invitations/{inv_id}", headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["data"]["statut"] == "revoquee"
        assert invitation_statut(inv_id) == "revoquee"
    finally:
        delete_invitation(inv_id)


def test_revoke_refused_if_accepted(client, admin_headers):
    email = f"revacc-{uuid.uuid4().hex}@test.local"
    inv_id, _ = create_invitation(email, admin_user_id(), statut="acceptee")
    try:
        response = client.delete(
            f"/api/admin/invitations/{inv_id}", headers=admin_headers
        )
        assert response.status_code == 400
    finally:
        delete_invitation(inv_id)


# --- Comptes ---


def test_accounts_last_connexion_nullable(client, admin_headers):
    email = f"acc-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email)
    try:
        response = client.get("/api/admin/accounts", headers=admin_headers)
        assert response.status_code == 200
        found = next(a for a in response.json()["data"] if a["id"] == user_id)
        assert found["last_connexion"] is None
        assert found["active"] is True
    finally:
        delete_user(user_id)


def test_deactivate_account_deletes_sessions(client, admin_headers):
    email = f"deact-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=True)
    make_session_for(
        user_id, "s1-" + uuid.uuid4().hex,
        datetime.now(timezone.utc) + timedelta(days=1),
    )
    make_session_for(
        user_id, "s2-" + uuid.uuid4().hex,
        datetime.now(timezone.utc) + timedelta(days=1),
    )
    try:
        assert count_sessions(user_id) == 2
        response = client.patch(
            f"/api/admin/accounts/{user_id}",
            json={"active": False},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["data"]["active"] is False
        assert count_sessions(user_id) == 0
        assert user_active(user_id) is False
    finally:
        delete_user(user_id)


def test_reactivate_account(client, admin_headers):
    email = f"react-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=False)
    try:
        response = client.patch(
            f"/api/admin/accounts/{user_id}",
            json={"active": True},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["data"]["active"] is True
        assert user_active(user_id) is True
    finally:
        delete_user(user_id)


def test_deactivate_last_active_admin_blocked(client, admin_headers):
    if count_admins(active_only=True) != 1:
        pytest.skip("Plusieurs admins actifs : garde dernier-admin non isolable.")
    admin_id = admin_user_id()
    response = client.patch(
        f"/api/admin/accounts/{admin_id}",
        json={"active": False},
        headers=admin_headers,
    )
    assert response.status_code == 400
    assert "dernier administrateur actif" in response.json()["detail"].lower()
    assert user_active(admin_id) is True


def test_deactivate_admin_when_multiple_ok(client, admin_headers):
    email = f"admin2-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="admin", active=True)
    make_session_for(
        user_id, "adm2-" + uuid.uuid4().hex,
        datetime.now(timezone.utc) + timedelta(days=1),
    )
    try:
        response = client.patch(
            f"/api/admin/accounts/{user_id}",
            json={"active": False},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert user_active(user_id) is False
        assert count_sessions(user_id) == 0
    finally:
        delete_user(user_id)
