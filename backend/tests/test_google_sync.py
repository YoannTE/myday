"""Tests du service de synchronisation Google (logique metier, BDD reelle).

Les appels reseau (fetch Google) sont monkeypatches ; apply/store/push tournent
pour de vrai contre Postgres (RLS via scoped_connection). Prouve : verrou
anti-double-run, 2 connexions distinctes en fan-out, conflit Google-gagne qui
preserve les rows sync_pending, anti-doublon par client_uuid, idempotence,
resultat partiel si une branche echoue.
"""

from __future__ import annotations

import asyncio
import contextlib
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

import app.db.client as dbclient
from app.config import settings
from app.db import google_connection as repo
from app.services.google import calendar_branch, gmail_branch, sync

from conftest import create_user, delete_user


def run_in_loop(coro_factory):
    async def _runner():
        saved = dbclient._pool
        dbclient._pool = await asyncpg.create_pool(
            settings.backend_database_url, min_size=2, max_size=6
        )
        try:
            return await coro_factory()
        finally:
            await dbclient._pool.close()
            dbclient._pool = saved

    return asyncio.new_event_loop().run_until_complete(_runner())


# --- Helpers BDD directs (app_admin) pour setup/verification ---


async def _admin(fn):
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await fn(conn)
    finally:
        await conn.close()


def admin(fn):
    return asyncio.new_event_loop().run_until_complete(_admin(fn))


def insert_event(user_id, *, google_event_id=None, client_uuid=None,
                 sync_status="synced", source="google", titre="t"):
    async def _do(conn):
        return await conn.fetchval(
            "INSERT INTO events (user_id, titre, debut, fin, google_event_id, "
            "client_uuid, source, sync_status) VALUES ($1,$2, now(), now()+interval "
            "'1 hour', $3,$4,$5,$6) RETURNING id::text",
            user_id, titre, google_event_id, client_uuid, source, sync_status,
        )
    return admin(_do)


def event_field(user_id, google_event_id, field):
    async def _do(conn):
        return await conn.fetchval(
            f"SELECT {field} FROM events WHERE user_id=$1 AND google_event_id=$2",
            user_id, google_event_id,
        )
    return admin(_do)


def count_events(user_id, client_uuid):
    async def _do(conn):
        return await conn.fetchval(
            "SELECT count(*) FROM events WHERE user_id=$1 AND client_uuid=$2",
            user_id, client_uuid,
        )
    return admin(_do)


def cal_sync_token(user_id):
    async def _do(conn):
        return await conn.fetchval(
            "SELECT calendar_sync_token FROM google_connections WHERE user_id=$1",
            user_id,
        )
    return admin(_do)


@pytest.fixture
def connected_user():
    uid = create_user(f"sync-{datetime.now().timestamp()}@test.local")
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    run_in_loop(
        lambda: repo.upsert_tokens(
            uid, access_token="at", refresh_token="rt", token_expiry=future,
            scopes=["calendar.events"],
        )
    )
    yield uid
    delete_user(uid)


# --- apply_calendar_changes : conflit, reconciliation, idempotence ---


def _cal_item(gid, titre, *, client_uuid=None, status="confirmed"):
    item = {
        "id": gid,
        "status": status,
        "summary": titre,
        "start": {"dateTime": "2026-07-10T10:00:00+00:00"},
        "end": {"dateTime": "2026-07-10T11:00:00+00:00"},
    }
    if client_uuid:
        item["extendedProperties"] = {"private": {"mydayClientUuid": client_uuid}}
    return item


def test_conflit_google_gagne_sauf_sync_pending(connected_user):
    """Google ecrase une row synced mais PRESERVE une row sync_pending."""
    insert_event(connected_user, google_event_id="G_PENDING",
                 sync_status="sync_pending", titre="local")
    insert_event(connected_user, google_event_id="G_SYNCED",
                 sync_status="synced", titre="old")
    changes = {
        "items": [
            _cal_item("G_PENDING", "google-veut-ecraser"),
            _cal_item("G_SYNCED", "nouveau-google"),
        ],
        "next_sync_token": "S1",
    }
    run_in_loop(lambda: calendar_branch.apply_calendar_changes(connected_user, changes))
    assert event_field(connected_user, "G_PENDING", "titre") == "local"
    assert event_field(connected_user, "G_SYNCED", "titre") == "nouveau-google"
    assert cal_sync_token(connected_user) == "S1"


def test_client_uuid_anti_doublon_apres_crash(connected_user):
    """Row pushee mais UPDATE local perdu : le pull la reconcilie sans doublon."""
    # Simule l'etat post-crash : pousse cote Google, mais local encore pending
    # avec client_uuid pose et google_event_id NULL.
    insert_event(connected_user, google_event_id=None, client_uuid="deadbeef",
                 sync_status="sync_pending", source="myday", titre="mon-event")
    changes = {
        "items": [_cal_item("deadbeef", "mon-event", client_uuid="deadbeef")],
        "next_sync_token": "S1",
    }
    run_in_loop(lambda: calendar_branch.apply_calendar_changes(connected_user, changes))
    # Toujours une seule row, desormais reliee a l'id Google (pas de doublon).
    assert count_events(connected_user, "deadbeef") == 1
    assert event_field(connected_user, "deadbeef", "sync_status") == "synced"


def test_apply_idempotent_sur_re_run(connected_user):
    """Rejouer les memes changements ne cree jamais de doublon."""
    changes = {"items": [_cal_item("G1", "reunion")], "next_sync_token": "S1"}
    run_in_loop(lambda: calendar_branch.apply_calendar_changes(connected_user, changes))
    run_in_loop(lambda: calendar_branch.apply_calendar_changes(connected_user, changes))

    async def _count(conn):
        return await conn.fetchval(
            "SELECT count(*) FROM events WHERE user_id=$1 AND google_event_id='G1'",
            connected_user,
        )
    assert admin(_count) == 1


def test_cancelled_supprime_la_row(connected_user):
    insert_event(connected_user, google_event_id="G_DEL", titre="a-supprimer")
    changes = {"items": [_cal_item("G_DEL", "x", status="cancelled")],
               "next_sync_token": "S1"}
    res = run_in_loop(
        lambda: calendar_branch.apply_calendar_changes(connected_user, changes)
    )
    assert res["deleted"] == 1
    assert event_field(connected_user, "G_DEL", "titre") is None


# --- run_sync : verrou, fan-out, partiel ---


def test_verrou_empeche_double_run(connected_user):
    """Un run deja en cours (verrou pose) -> le second est skipped."""
    run_in_loop(lambda: repo.acquire_sync_lock(connected_user))
    out = run_in_loop(lambda: sync.run_sync(connected_user, trigger="manual"))
    assert out["status"] == "skipped"


def _patch_fetch(monkeypatch, cal_changes, gmail_changes):
    async def fake_cal(client, sync_token, window_days):
        return cal_changes

    async def fake_gmail(client, history_id, lookback, max_mails):
        return gmail_changes

    monkeypatch.setattr(calendar_branch, "fetch_calendar_changes", fake_cal)
    monkeypatch.setattr(gmail_branch, "fetch_gmail_changes", fake_gmail)


def test_fan_out_deux_connexions_distinctes(connected_user, monkeypatch):
    """Les 2 branches ouvrent chacune leur propre connexion asyncpg."""
    _patch_fetch(
        monkeypatch,
        {"items": [], "next_sync_token": "S1", "resync": False},
        {"new_messages": [], "status_updates": [], "next_history_id": "H1",
         "resync": False, "truncated": False},
    )
    seen: list[int] = []
    orig = dbclient.scoped_connection

    @contextlib.asynccontextmanager
    async def spy(uid):
        async with orig(uid) as conn:
            seen.append(id(conn))
            yield conn

    monkeypatch.setattr(calendar_branch, "scoped_connection", spy)
    monkeypatch.setattr(gmail_branch, "scoped_connection", spy)

    out = run_in_loop(lambda: sync.run_sync(connected_user, trigger="manual"))
    assert out["status"] == "completed"
    assert out["partial"] is False
    # apply (agenda) et store (mails) ont chacun ouvert une connexion distincte.
    assert len(set(seen)) >= 2


def test_partiel_si_une_branche_echoue(connected_user, monkeypatch):
    """Branche agenda en echec -> partial=true, curseur agenda non avance."""
    run_in_loop(
        lambda: repo.update_cursors(connected_user, calendar_sync_token="OLD")
    )

    async def boom_cal(client, sync_token, window_days):
        raise RuntimeError("agenda down")

    async def ok_gmail(client, history_id, lookback, max_mails):
        return {"new_messages": [], "status_updates": [], "next_history_id": "H1",
                "resync": False, "truncated": False}

    monkeypatch.setattr(calendar_branch, "fetch_calendar_changes", boom_cal)
    monkeypatch.setattr(gmail_branch, "fetch_gmail_changes", ok_gmail)

    out = run_in_loop(lambda: sync.run_sync(connected_user, trigger="manual"))
    assert out["status"] == "completed"
    assert out["partial"] is True
    # Curseur agenda intact (apply n'a jamais tourne).
    assert cal_sync_token(connected_user) == "OLD"
    # Verrou libere en fin de run.
    meta = run_in_loop(lambda: repo.get_connection(connected_user))
    assert meta["sync_locked_until"] is None


def test_reauth_court_circuite_le_run(connected_user):
    """Connexion en reauth_required -> run renvoie reauth_required (pas de sync)."""
    run_in_loop(lambda: repo.set_reauth_required(connected_user))
    out = run_in_loop(lambda: sync.run_sync(connected_user, trigger="manual"))
    assert out["status"] == "reauth_required"
