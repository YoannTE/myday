"""Tests d'integration de l'agregat d'usage admin (Round 010).

La reponse ne doit JAMAIS contenir de contenu utilisateur (mails/notes/taches/
metadata) : uniquement des compteurs et labels de compte. Exigent Postgres
migre + admin seede.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.cookie import COOKIE_NAME
from conftest import (
    create_llm_usage,
    create_usage_event,
    create_user,
    delete_user,
    drop_session,
    make_session,
    make_session_for,
    sign_token,
)


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def admin_headers():
    token = "adm-usage-" + uuid.uuid4().hex
    make_session(token, datetime.now(timezone.utc) + timedelta(days=1))
    yield _cookie(sign_token(token))
    drop_session(token)


@pytest.fixture
def non_admin_headers():
    email = f"user-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=True)
    token = "usr-usage-" + uuid.uuid4().hex
    make_session_for(user_id, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield _cookie(sign_token(token))
    drop_session(token)
    delete_user(user_id)


# --- Garde d'acces ---


def test_usage_401_no_cookie(client):
    response = client.get("/api/admin/usage")
    assert response.status_code == 401


def test_usage_403_non_admin(client, non_admin_headers):
    response = client.get("/api/admin/usage", headers=non_admin_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Accès réservé à l'administrateur"


# --- Cloisonnement du contenu ---


def test_usage_response_has_no_content_keys(client, admin_headers):
    response = client.get("/api/admin/usage", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert set(data.keys()) == {
        "active_days_by_user",
        "events_by_type",
        "llm_cost",
        "active_users",
    }
    dumped = str(data)
    for forbidden in ("metadata", "contenu", "titre", "sujet", "corps"):
        assert forbidden not in dumped


# --- active_days_by_user : jours distincts + comblement a 0 + fuseau ---


def test_active_days_distinct_and_zero_filled(client, admin_headers):
    email = f"usage-days-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=True)
    try:
        today = datetime.now(timezone.utc)
        # Deux ouvertures le meme jour -> un seul jour actif compte.
        create_usage_event(user_id, "dashboard_opened", today)
        create_usage_event(user_id, "dashboard_opened", today - timedelta(hours=1))
        # Une ouverture 3 jours avant (meme semaine courante).
        create_usage_event(user_id, "dashboard_opened", today - timedelta(days=3))

        response = client.get("/api/admin/usage", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()["data"]
        found = next(
            u for u in data["active_days_by_user"] if u["user_label"] == email
        )
        assert len(found["weeks"]) == 4
        assert sum(w["jours_actifs"] for w in found["weeks"]) == 2
        # La semaine la plus ancienne (J-27 a J-21) doit etre comblee a 0.
        assert found["weeks"][0]["jours_actifs"] == 0
    finally:
        delete_user(user_id)


def test_active_days_timezone_bucketing(client, admin_headers):
    email = f"usage-tz-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=True)
    try:
        # 23h30 UTC (jour D) et 00h30 UTC (jour D+1) tombent tous les deux sur
        # le MEME jour civil a Paris (01h30/02h30 selon saison) : ca ne doit
        # compter que comme un seul jour actif, pas deux (piege du decoupage
        # naif en UTC autour de minuit). Ancre 3 jours dans le passe pour
        # garantir que les deux instants restent bien avant "maintenant".
        anchor = datetime.now(timezone.utc) - timedelta(days=3)
        avant_minuit = anchor.replace(hour=23, minute=30, second=0, microsecond=0)
        apres_minuit = avant_minuit + timedelta(hours=1)
        create_usage_event(user_id, "dashboard_opened", avant_minuit)
        create_usage_event(user_id, "dashboard_opened", apres_minuit)

        response = client.get("/api/admin/usage", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()["data"]
        found = next(
            u for u in data["active_days_by_user"] if u["user_label"] == email
        )
        assert sum(w["jours_actifs"] for w in found["weeks"]) == 1
    finally:
        delete_user(user_id)


# --- events_by_type : jamais metadata, group by type ---


def test_events_by_type_counts(client, admin_headers):
    email = f"usage-type-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=True)
    try:
        create_usage_event(user_id, "task_completed")
        create_usage_event(user_id, "task_completed")
        create_usage_event(user_id, "brief_generated")

        response = client.get("/api/admin/usage", headers=admin_headers)
        assert response.status_code == 200
        events_by_type = response.json()["data"]["events_by_type"]
        assert events_by_type.get("task_completed", 0) >= 2
        assert events_by_type.get("brief_generated", 0) >= 1
    finally:
        delete_user(user_id)


# --- llm_cost : Decimal -> float arrondi, par agent ---


def test_llm_cost_aggregation(client, admin_headers):
    email = f"usage-llm-{uuid.uuid4().hex}@test.local"
    user_id = create_user(email, role="user", active=True)
    try:
        create_llm_usage(
            user_id,
            agent="assistant",
            prompt_tokens=100,
            completion_tokens=50,
            cost_usd="0.0123",
        )
        create_llm_usage(
            user_id,
            agent="assistant",
            prompt_tokens=200,
            completion_tokens=100,
            cost_usd="0.0246",
        )

        response = client.get("/api/admin/usage", headers=admin_headers)
        assert response.status_code == 200
        llm_cost = response.json()["data"]["llm_cost"]
        assert isinstance(llm_cost["total_usd"], float)
        assert llm_cost["total_usd"] >= 0.0369
        agent_row = next(
            a for a in llm_cost["by_agent"] if a["agent"] == "assistant"
        )
        assert isinstance(agent_row["cost_usd"], float)
        assert agent_row["tokens"] >= 450
    finally:
        delete_user(user_id)
