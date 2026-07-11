"""Tests d'integration de l'endpoint Usage (Round 004).

Exigent Postgres migre (RLS active sur `usage_events`).
"""

import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from app.auth.cookie import COOKIE_NAME
from app.config import settings
from conftest import create_user, delete_user, make_session_for, run_async, sign_token


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"usage-{uuid.uuid4().hex}@test.local")
    token = "usage-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


async def _fetch_event(event_id: str) -> asyncpg.Record | None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchrow(
            "SELECT type, metadata FROM usage_events WHERE id = $1::uuid", event_id
        )
    finally:
        await conn.close()


def fetch_event(event_id: str) -> asyncpg.Record | None:
    return run_async(_fetch_event(event_id))


def test_create_usage_event_dashboard_opened(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/usage-events", json={"type": "dashboard_opened"}, headers=headers
    )
    assert resp.status_code == 201
    event_id = resp.json()["data"]["id"]
    row = fetch_event(event_id)
    assert row["type"] == "dashboard_opened"


def test_create_usage_event_avec_metadata(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/usage-events",
        json={"type": "brief_opened", "metadata": {"brief_id": "abc"}},
        headers=headers,
    )
    assert resp.status_code == 201
    event_id = resp.json()["data"]["id"]
    row = fetch_event(event_id)
    assert row["type"] == "brief_opened"
    assert row["metadata"] == '{"brief_id": "abc"}' or row["metadata"] == {
        "brief_id": "abc"
    }


def test_create_usage_event_task_completed_refuse(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/usage-events", json={"type": "task_completed"}, headers=headers
    )
    assert resp.status_code == 400


def test_create_usage_event_type_inconnu_refuse(client, auth_user):
    _, headers = auth_user
    resp = client.post(
        "/api/usage-events", json={"type": "type_inexistant"}, headers=headers
    )
    assert resp.status_code == 400
