"""Tests de la branche Gmail : dedup, curseur tronque, suppression distante.

apply/store tournent contre Postgres reel (RLS). Pas d'appel Gmail reel.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

import app.db.client as dbclient
from app.config import settings
from app.db import google_connection as repo
from app.services.google import gmail_branch

from conftest import create_user, delete_user


def run_in_loop(coro_factory):
    async def _runner():
        saved = dbclient._pool
        dbclient._pool = await asyncpg.create_pool(
            settings.backend_database_url, min_size=1, max_size=3
        )
        try:
            return await coro_factory()
        finally:
            await dbclient._pool.close()
            dbclient._pool = saved

    return asyncio.new_event_loop().run_until_complete(_runner())


def admin_val(query, *args):
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            return await conn.fetchval(query, *args)
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


def _msg(gmail_id, lu=False):
    return {
        "gmail_id": gmail_id,
        "expediteur": "a@b.com",
        "sujet": "Bonjour",
        "extrait": "extrait",
        "date_reception": datetime.now(timezone.utc),
        "lu": lu,
    }


@pytest.fixture
def connected_user():
    uid = create_user(f"gmail-{datetime.now().timestamp()}@test.local")
    run_in_loop(
        lambda: repo.upsert_tokens(
            uid, access_token="at", refresh_token="rt",
            token_expiry=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    yield uid
    delete_user(uid)


def test_store_dedup_par_user_gmail_id(connected_user):
    changes = {"new_messages": [_msg("m1")], "status_updates": [],
               "next_history_id": "H1", "resync": False, "truncated": False}
    r1 = run_in_loop(lambda: gmail_branch.store_new_mails(connected_user, changes))
    r2 = run_in_loop(lambda: gmail_branch.store_new_mails(connected_user, changes))
    assert r1["new_mails"] == 1
    assert r2["new_mails"] == 0  # relecture dedupliquee
    assert admin_val(
        "SELECT count(*) FROM mails WHERE user_id=$1 AND gmail_id='m1'", connected_user
    ) == 1


def test_store_truncated_ne_avance_pas_le_curseur(connected_user):
    run_in_loop(lambda: repo.update_cursors(connected_user, gmail_history_id="H1"))
    changes = {"new_messages": [_msg("m2")], "status_updates": [],
               "next_history_id": "H999", "resync": True, "truncated": True}
    run_in_loop(lambda: gmail_branch.store_new_mails(connected_user, changes))
    assert admin_val(
        "SELECT gmail_history_id FROM google_connections WHERE user_id=$1",
        connected_user,
    ) == "H1"


def test_store_suppression_distante_archive_localement(connected_user):
    changes_in = {"new_messages": [_msg("m3")], "status_updates": [],
                  "next_history_id": "H1", "resync": False, "truncated": False}
    run_in_loop(lambda: gmail_branch.store_new_mails(connected_user, changes_in))
    changes_del = {"new_messages": [], "status_updates": [{"gmail_id": "m3", "deleted": True}],
                   "next_history_id": "H2", "resync": False, "truncated": False}
    run_in_loop(lambda: gmail_branch.store_new_mails(connected_user, changes_del))
    assert admin_val(
        "SELECT statut FROM mails WHERE user_id=$1 AND gmail_id='m3'", connected_user
    ) == "archived_remote"


def test_store_maj_lu(connected_user):
    changes_in = {"new_messages": [_msg("m4", lu=False)], "status_updates": [],
                  "next_history_id": "H1", "resync": False, "truncated": False}
    run_in_loop(lambda: gmail_branch.store_new_mails(connected_user, changes_in))
    changes_upd = {"new_messages": [], "status_updates": [{"gmail_id": "m4", "lu": True}],
                   "next_history_id": "H2", "resync": False, "truncated": False}
    run_in_loop(lambda: gmail_branch.store_new_mails(connected_user, changes_upd))
    assert admin_val(
        "SELECT lu FROM mails WHERE user_id=$1 AND gmail_id='m4'", connected_user
    ) is True
