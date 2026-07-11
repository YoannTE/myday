"""Tests d'integration des endpoints Taches (Round 004).

Exigent Postgres migre (RLS active sur `tasks`/`usage_events`). Chaque test
cree son propre utilisateur de test pour rester isole.
"""

import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from app.auth.cookie import COOKIE_NAME
from app.config import settings
from conftest import (
    create_user,
    delete_user,
    make_session_for,
    run_async,
    sign_token,
)


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"task-{uuid.uuid4().hex}@test.local")
    token = "task-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


async def _count_usage_events(user_id: str, event_type: str) -> int:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "SELECT count(*) FROM usage_events WHERE user_id = $1 AND type = $2",
            user_id,
            event_type,
        )
    finally:
        await conn.close()


def count_usage_events(user_id: str, event_type: str) -> int:
    return run_async(_count_usage_events(user_id, event_type))


# --- Creation + liste ---


def test_create_task_minimal(client, auth_user):
    _, headers = auth_user
    resp = client.post("/api/tasks", json={"titre": "Acheter du pain"}, headers=headers)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["titre"] == "Acheter du pain"
    assert data["priorite"] == "normale"
    assert data["statut"] == "a_faire"
    assert data["origine"] == "manuelle"
    assert data["completed_at"] is None


def test_create_task_titre_vide_rejete(client, auth_user):
    _, headers = auth_user
    resp = client.post("/api/tasks", json={"titre": "   "}, headers=headers)
    assert resp.status_code == 422


def test_list_tasks_filtre_statut(client, auth_user):
    _, headers = auth_user
    client.post("/api/tasks", json={"titre": "Tache A"}, headers=headers)
    created = client.post(
        "/api/tasks", json={"titre": "Tache B"}, headers=headers
    ).json()["data"]
    client.patch(
        f"/api/tasks/{created['id']}", json={"statut": "faite"}, headers=headers
    )

    a_faire = client.get("/api/tasks?statut=a_faire", headers=headers).json()["data"]
    faites = client.get("/api/tasks?statut=faite", headers=headers).json()["data"]
    assert any(t["titre"] == "Tache A" for t in a_faire)
    assert all(t["statut"] == "a_faire" for t in a_faire)
    assert any(t["titre"] == "Tache B" for t in faites)
    assert all(t["statut"] == "faite" for t in faites)


# --- Passage a "faite" atomique ---


def test_toggle_task_completed_insere_usage_event(client, auth_user):
    uid, headers = auth_user
    task = client.post(
        "/api/tasks", json={"titre": "Finir le rapport"}, headers=headers
    ).json()["data"]

    resp = client.patch(
        f"/api/tasks/{task['id']}", json={"statut": "faite"}, headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["statut"] == "faite"
    assert data["completed_at"] is not None
    assert count_usage_events(uid, "task_completed") == 1


def test_double_toggle_ne_cree_qu_un_seul_usage_event(client, auth_user):
    uid, headers = auth_user
    task = client.post(
        "/api/tasks", json={"titre": "Double clic"}, headers=headers
    ).json()["data"]

    resp1 = client.patch(
        f"/api/tasks/{task['id']}", json={"statut": "faite"}, headers=headers
    )
    resp2 = client.patch(
        f"/api/tasks/{task['id']}", json={"statut": "faite"}, headers=headers
    )
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json()["data"]["completed_at"] == resp2.json()["data"]["completed_at"]
    assert count_usage_events(uid, "task_completed") == 1


def test_repassage_a_faire_remet_completed_at_null(client, auth_user):
    _, headers = auth_user
    task = client.post(
        "/api/tasks", json={"titre": "Va et vient"}, headers=headers
    ).json()["data"]
    client.patch(f"/api/tasks/{task['id']}", json={"statut": "faite"}, headers=headers)

    resp = client.patch(
        f"/api/tasks/{task['id']}", json={"statut": "a_faire"}, headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["statut"] == "a_faire"
    assert data["completed_at"] is None


# --- Suppression ---


def test_delete_task(client, auth_user):
    _, headers = auth_user
    task = client.post(
        "/api/tasks", json={"titre": "A supprimer"}, headers=headers
    ).json()["data"]
    resp = client.delete(f"/api/tasks/{task['id']}", headers=headers)
    assert resp.status_code == 204
    remaining = client.get("/api/tasks", headers=headers).json()["data"]
    assert all(t["id"] != task["id"] for t in remaining)


# --- Isolation RLS cross-utilisateur ---


def test_patch_task_cross_user_404(client, auth_user):
    _, headers_owner = auth_user
    task = client.post(
        "/api/tasks", json={"titre": "Privee"}, headers=headers_owner
    ).json()["data"]

    other_uid = create_user(f"other-{uuid.uuid4().hex}@test.local")
    other_token = "other-" + uuid.uuid4().hex
    make_session_for(
        other_uid, other_token, datetime.now(timezone.utc) + timedelta(days=1)
    )
    try:
        resp = client.patch(
            f"/api/tasks/{task['id']}",
            json={"titre": "Vol"},
            headers=_cookie(sign_token(other_token)),
        )
        assert resp.status_code == 404
    finally:
        delete_user(other_uid)


def test_delete_task_cross_user_404(client, auth_user):
    _, headers_owner = auth_user
    task = client.post(
        "/api/tasks", json={"titre": "Privee 2"}, headers=headers_owner
    ).json()["data"]

    other_uid = create_user(f"other2-{uuid.uuid4().hex}@test.local")
    other_token = "other2-" + uuid.uuid4().hex
    make_session_for(
        other_uid, other_token, datetime.now(timezone.utc) + timedelta(days=1)
    )
    try:
        resp = client.delete(
            f"/api/tasks/{task['id']}",
            headers=_cookie(sign_token(other_token)),
        )
        assert resp.status_code == 404
    finally:
        delete_user(other_uid)
