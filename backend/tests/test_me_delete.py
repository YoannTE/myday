"""Tests DELETE /api/me (cascade + garde dernier-admin) et enforcement
de la desactivation dans get_current_user (Round 002)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.cookie import COOKIE_NAME
from conftest import (
    admin_user_id,
    count_admins,
    count_events,
    create_event,
    create_user,
    delete_user,
    drop_session,
    make_session,
    make_session_for,
    sign_token,
    user_active,
)


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


def test_delete_me_cascade(client):
    email = f"del-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=True)
    token = "del-" + uuid.uuid4().hex
    make_session_for(user_id, token, datetime.now(timezone.utc) + timedelta(days=1))
    event_id = create_event(user_id)
    assert count_events(event_id) == 1
    try:
        response = client.delete("/api/me", headers=_cookie(sign_token(token)))
        assert response.status_code == 204
        # Cascade FK prouvee : le contenu de l'utilisateur a disparu.
        assert count_events(event_id) == 0
        assert user_active(user_id) is None  # user supprime
    finally:
        drop_session(token)
        delete_user(user_id)


def test_delete_me_last_admin_blocked(client):
    if count_admins() != 1:
        pytest.skip("Plusieurs admins : garde dernier-admin non isolable.")
    admin_id = admin_user_id()
    token = "adm-" + uuid.uuid4().hex
    make_session(token, datetime.now(timezone.utc) + timedelta(days=1))
    try:
        response = client.delete("/api/me", headers=_cookie(sign_token(token)))
        assert response.status_code == 400
        assert "dernier administrateur" in response.json()["detail"].lower()
        assert user_active(admin_id) is True  # admin toujours present
    finally:
        drop_session(token)


def test_deactivated_user_401(client):
    """Un compte desactive ne peut plus etre authentifie (get_current_user)."""
    email = f"inactive-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=False)
    token = "ina-" + uuid.uuid4().hex
    make_session_for(user_id, token, datetime.now(timezone.utc) + timedelta(days=1))
    try:
        response = client.get("/api/me", headers=_cookie(sign_token(token)))
        assert response.status_code == 401
    finally:
        drop_session(token)
        delete_user(user_id)
