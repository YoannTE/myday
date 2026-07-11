"""Tests de get_current_user : verification cookie signe + lookup session.

Couvre le VRAI format Better-auth (token.<signature HMAC>) verifie par login
reel, plus les cas d'echec (absent, signature invalide, session expiree).
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.auth.cookie import COOKIE_NAME, verify_session_cookie
from app.config import settings
from conftest import drop_session, make_session, sign_token


# --- Unitaire : verification cryptographique (sans BDD) ---


def test_verify_valid_signature():
    token = "abc123DEF456"
    assert verify_session_cookie(sign_token(token), settings.better_auth_secret) == token


def test_verify_rejects_bad_signature():
    assert verify_session_cookie("abc123.mauvaisesignature=", settings.better_auth_secret) is None


def test_verify_rejects_missing_dot():
    assert verify_session_cookie("abc123", settings.better_auth_secret) is None


def test_verify_handles_urlencoded_value():
    token = "tokenAvecSignatureSpeciale"
    signed = sign_token(token)  # contient souvent + / =
    from urllib.parse import quote

    encoded = quote(signed, safe="")
    assert verify_session_cookie(encoded, settings.better_auth_secret) == token


# --- Integration : endpoint protege /api/me ---


def _cookie_header(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


def test_me_401_without_cookie(client):
    response = client.get("/api/me")
    assert response.status_code == 401


def test_me_401_bad_signature(client):
    token = "token" + uuid.uuid4().hex
    response = client.get("/api/me", headers=_cookie_header(f"{token}.signaturebidon="))
    assert response.status_code == 401


def test_me_200_valid_session(client):
    token = uuid.uuid4().hex
    user_id = make_session(token, datetime.now(timezone.utc) + timedelta(days=1))
    try:
        response = client.get("/api/me", headers=_cookie_header(sign_token(token)))
        assert response.status_code == 200
        assert response.json()["data"]["id"] == user_id
    finally:
        drop_session(token)


def test_me_401_expired_session(client):
    token = uuid.uuid4().hex
    make_session(token, datetime.now(timezone.utc) - timedelta(hours=1))
    try:
        response = client.get("/api/me", headers=_cookie_header(sign_token(token)))
        assert response.status_code == 401
    finally:
        drop_session(token)


def test_me_401_valid_signature_unknown_token(client):
    """Signature correcte mais token absent de la table session -> 401."""
    token = "inconnu-" + uuid.uuid4().hex
    response = client.get("/api/me", headers=_cookie_header(sign_token(token)))
    assert response.status_code == 401
