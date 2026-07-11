"""Tests d'integration du repository `google_connection` (RLS + chiffrement).

Ces tests exigent Postgres (localhost:5433) et le schema migre. Ils creent un
utilisateur de test, operent via `scoped_connection` (RLS), et verifient que les
jetons sont chiffres au repos. Chaque appel repository s'execute dans un event
loop dedie avec son propre pool asyncpg (isolation, pas de fuite inter-loop).
"""

import asyncio
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

import app.db.client as dbclient
from app.config import settings
from app.db import google_connection as repo
from app.security.token_cipher import decrypt

from conftest import create_user, delete_user


def run_repo(coro_factory):
    """Execute une coroutine avec un pool app_rls dedie a un loop neuf."""

    async def _runner():
        saved = dbclient._pool
        dbclient._pool = await asyncpg.create_pool(
            settings.backend_database_url, min_size=1, max_size=2
        )
        try:
            return await coro_factory()
        finally:
            await dbclient._pool.close()
            dbclient._pool = saved

    return asyncio.new_event_loop().run_until_complete(_runner())


def raw_tokens(user_id: str) -> tuple[str | None, str | None]:
    """Lit les colonnes brutes (via app_admin) pour prouver le chiffrement au repos."""

    async def _read():
        conn = await asyncpg.connect(settings.database_url)
        try:
            row = await conn.fetchrow(
                "SELECT access_token, refresh_token FROM google_connections "
                "WHERE user_id = $1",
                user_id,
            )
            return (row["access_token"], row["refresh_token"]) if row else (None, None)
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_read())


@pytest.fixture
def user_id():
    uid = create_user(f"google-conn-{datetime.now().timestamp()}@test.local")
    yield uid
    delete_user(uid)  # cascade -> supprime la connexion Google


def test_upsert_puis_read_round_trip_dechiffre(user_id):
    """Les jetons ecrits chiffres sont relus en clair et corrects."""
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    run_repo(
        lambda: repo.upsert_tokens(
            user_id,
            access_token="access-secret-123",
            refresh_token="refresh-secret-456",
            token_expiry=expiry,
            scopes=["calendar.readonly", "gmail.readonly"],
        )
    )
    tokens = run_repo(lambda: repo.read_tokens(user_id))
    assert tokens is not None
    assert tokens["access_token"] == "access-secret-123"
    assert tokens["refresh_token"] == "refresh-secret-456"
    assert tokens["scopes"] == ["calendar.readonly", "gmail.readonly"]
    assert tokens["status"] == "connected"


def test_jetons_chiffres_au_repos(user_id):
    """Les colonnes en BDD ne contiennent JAMAIS les jetons en clair."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id,
            access_token="access-en-clair",
            refresh_token="refresh-en-clair",
            token_expiry=datetime.now(timezone.utc),
        )
    )
    raw_access, raw_refresh = raw_tokens(user_id)
    assert raw_access != "access-en-clair"
    assert raw_refresh != "refresh-en-clair"
    # La valeur stockee est bien le chiffre de la valeur d'origine.
    assert decrypt(raw_access) == "access-en-clair"
    assert decrypt(raw_refresh) == "refresh-en-clair"


def test_read_tokens_sans_connexion_renvoie_none(user_id):
    """Sans connexion enregistree, read_tokens renvoie None."""
    assert run_repo(lambda: repo.read_tokens(user_id)) is None


def test_upsert_refresh_none_preserve_le_refresh_existant(user_id):
    """Un refresh (access seul) ne doit pas effacer le refresh_token existant."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id,
            access_token="a1",
            refresh_token="r1",
            token_expiry=datetime.now(timezone.utc),
        )
    )
    run_repo(
        lambda: repo.upsert_tokens(
            user_id,
            access_token="a2",
            refresh_token=None,
            token_expiry=datetime.now(timezone.utc),
        )
    )
    tokens = run_repo(lambda: repo.read_tokens(user_id))
    assert tokens["access_token"] == "a2"
    assert tokens["refresh_token"] == "r1"


def test_get_connection_expose_metadonnees_sans_jetons(user_id):
    """get_connection renvoie curseurs/statut mais aucun jeton."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id,
            access_token="a",
            refresh_token="r",
            token_expiry=datetime.now(timezone.utc),
            scopes=["s1"],
        )
    )
    meta = run_repo(lambda: repo.get_connection(user_id))
    assert meta is not None
    assert meta["status"] == "connected"
    assert meta["scopes"] == ["s1"]
    assert "access_token" not in meta
    assert "refresh_token" not in meta


def test_update_cursors(user_id):
    """update_cursors pose les curseurs et conserve ceux non fournis."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id, access_token="a", token_expiry=datetime.now(timezone.utc)
        )
    )
    run_repo(
        lambda: repo.update_cursors(
            user_id, calendar_sync_token="CAL1", gmail_history_id="H1"
        )
    )
    run_repo(lambda: repo.update_cursors(user_id, calendar_sync_token="CAL2"))
    meta = run_repo(lambda: repo.get_connection(user_id))
    assert meta["calendar_sync_token"] == "CAL2"
    assert meta["gmail_history_id"] == "H1"


def test_set_reauth_required_notifie_une_seule_fois(user_id):
    """La transition reauth n'emet la notification qu'une fois."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id, access_token="a", token_expiry=datetime.now(timezone.utc)
        )
    )
    first = run_repo(lambda: repo.set_reauth_required(user_id))
    second = run_repo(lambda: repo.set_reauth_required(user_id))
    assert first is True
    assert second is False
    meta = run_repo(lambda: repo.get_connection(user_id))
    assert meta["status"] == "reauth_required"
    assert meta["reauth_notified"] is True


def test_upsert_apres_reauth_remet_connected_et_reset_flag(user_id):
    """Une nouvelle connexion (upsert) remet connected et reautorise la notif."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id, access_token="a", token_expiry=datetime.now(timezone.utc)
        )
    )
    run_repo(lambda: repo.set_reauth_required(user_id))
    run_repo(
        lambda: repo.upsert_tokens(
            user_id, access_token="a2", token_expiry=datetime.now(timezone.utc)
        )
    )
    meta = run_repo(lambda: repo.get_connection(user_id))
    assert meta["status"] == "connected"
    assert meta["reauth_notified"] is False


def test_acquire_sync_lock_atomique(user_id):
    """Un seul run obtient le verrou ; le second echoue tant qu'il est actif."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id, access_token="a", token_expiry=datetime.now(timezone.utc)
        )
    )
    first = run_repo(lambda: repo.acquire_sync_lock(user_id))
    second = run_repo(lambda: repo.acquire_sync_lock(user_id))
    assert first is True
    assert second is False


def test_release_sync_lock_libere_le_verrou(user_id):
    """Apres release, le verrou est de nouveau disponible."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id, access_token="a", token_expiry=datetime.now(timezone.utc)
        )
    )
    run_repo(lambda: repo.acquire_sync_lock(user_id))
    run_repo(lambda: repo.release_sync_lock(user_id))
    again = run_repo(lambda: repo.acquire_sync_lock(user_id))
    assert again is True


def test_acquire_sync_lock_expire_est_repris(user_id):
    """Un verrou expire (duree negative) est reacquis au run suivant."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id, access_token="a", token_expiry=datetime.now(timezone.utc)
        )
    )
    # Pose un verrou deja expire (borne dans le passe).
    run_repo(lambda: repo.acquire_sync_lock(user_id, lock_seconds=-10))
    again = run_repo(lambda: repo.acquire_sync_lock(user_id))
    assert again is True


def test_touch_manual_sync(user_id):
    """touch_manual_sync horodate last_manual_sync_at."""
    run_repo(
        lambda: repo.upsert_tokens(
            user_id, access_token="a", token_expiry=datetime.now(timezone.utc)
        )
    )
    assert run_repo(lambda: repo.get_connection(user_id))["last_manual_sync_at"] is None
    run_repo(lambda: repo.touch_manual_sync(user_id))
    assert (
        run_repo(lambda: repo.get_connection(user_id))["last_manual_sync_at"]
        is not None
    )


def test_rls_isole_les_connexions_entre_utilisateurs(user_id):
    """Un utilisateur ne voit pas la connexion d'un autre (RLS)."""
    other = create_user(f"google-conn-other-{datetime.now().timestamp()}@test.local")
    try:
        run_repo(
            lambda: repo.upsert_tokens(
                user_id, access_token="a", token_expiry=datetime.now(timezone.utc)
            )
        )
        # L'autre utilisateur (scope different) ne voit rien.
        assert run_repo(lambda: repo.get_connection(other)) is None
        assert run_repo(lambda: repo.read_tokens(other)) is None
    finally:
        delete_user(other)
