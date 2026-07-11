"""Fixtures partagees pour les tests backend.

Ces tests sont des tests d'integration : ils exigent Postgres (localhost:5433)
et le schema migre (tables `session` / `user`). Le setup des sessions utilise le
role app_admin (settings.database_url) pour inserer/supprimer sans contrainte RLS
(la table `session` n'est pas soumise a la RLS).
"""

import asyncio
import base64
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256

import asyncpg
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@pytest.fixture(autouse=True)
def _neutraliser_cle_llm(monkeypatch):
    """Les tests ne doivent JAMAIS appeler la vraie API Anthropic : la clé est
    neutralisée par défaut (chemin fallback/dégradé déterministe, offline).
    Les tests qui exercent le chemin LLM mockent `complete_json` explicitement.
    Indispensable depuis qu'une vraie `ANTHROPIC_API_KEY` peut être présente
    dans `.env.local` (sinon les tests fallback deviennent lents/non déterministes)."""
    monkeypatch.setattr(settings, "anthropic_api_key", "", raising=False)


def run_async(coro):
    """Execute une coroutine dans un event loop dedie (hors du loop TestClient)."""
    return asyncio.new_event_loop().run_until_complete(coro)


def sign_token(token: str) -> str:
    """Reproduit la signature Better-auth : token.<base64(HMAC-SHA256)>."""
    digest = hmac.new(settings.better_auth_secret.encode(), token.encode(), sha256).digest()
    return f"{token}.{base64.b64encode(digest).decode()}"


@pytest.fixture(scope="session")
def client():
    # Le context manager declenche le lifespan (ouverture/fermeture du pool).
    with TestClient(app) as test_client:
        yield test_client


async def _get_admin_user_id() -> str:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval('SELECT id FROM "user" ORDER BY created_at LIMIT 1')
    finally:
        await conn.close()


async def _insert_session(token: str, user_id: str, expires_at: datetime) -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute(
            'INSERT INTO "session" (id, token, user_id, expires_at) VALUES ($1, $2, $3, $4)',
            f"test-{token}",
            token,
            user_id,
            expires_at,
        )
    finally:
        await conn.close()


async def _delete_session(token: str) -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute('DELETE FROM "session" WHERE token = $1', token)
    finally:
        await conn.close()


def make_session(token: str, expires_at: datetime) -> str:
    """Cree une session en BDD pour l'admin, retourne son user_id."""
    user_id = run_async(_get_admin_user_id())
    if user_id is None:
        pytest.skip("Aucun utilisateur en base (lancer `npm run db:seed`).")
    # La colonne est `timestamp without time zone` : passer un datetime naif (UTC).
    naive_utc = expires_at.astimezone(timezone.utc).replace(tzinfo=None)
    run_async(_insert_session(token, user_id, naive_utc))
    return user_id


def drop_session(token: str) -> None:
    run_async(_delete_session(token))


# --- Helpers admin (Round 002) : creation d'utilisateurs/invitations de test ---


async def _create_user(user_id: str, email: str, role: str, active: bool) -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute(
            'INSERT INTO "user" (id, name, email, email_verified, role, active) '
            "VALUES ($1, $2, $3, true, $4, $5)",
            user_id,
            f"Test {user_id}",
            email,
            role,
            active,
        )
    finally:
        await conn.close()


def create_user(email: str, role: str = "user", active: bool = True) -> str:
    """Cree un utilisateur de test (insert direct, hors Better-auth)."""
    user_id = f"test-user-{uuid.uuid4().hex}"
    run_async(_create_user(user_id, email, role, active))
    return user_id


async def _delete_user(user_id: str) -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute('DELETE FROM "user" WHERE id = $1', user_id)
    finally:
        await conn.close()


def delete_user(user_id: str) -> None:
    run_async(_delete_user(user_id))


async def _make_session_for(token: str, user_id: str, expires_at: datetime) -> None:
    naive_utc = expires_at.astimezone(timezone.utc).replace(tzinfo=None)
    await _insert_session(token, user_id, naive_utc)


def make_session_for(user_id: str, token: str, expires_at: datetime) -> None:
    """Cree une session pour un user_id precis (utilisateur de test)."""
    run_async(_make_session_for(token, user_id, expires_at))


async def _count_sessions(user_id: str) -> int:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            'SELECT count(*) FROM "session" WHERE user_id = $1', user_id
        )
    finally:
        await conn.close()


def count_sessions(user_id: str) -> int:
    return run_async(_count_sessions(user_id))


async def _create_event(user_id: str) -> str:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "INSERT INTO events (user_id, titre, debut, fin) "
            "VALUES ($1, 'Evenement test', now(), now()) RETURNING id::text",
            user_id,
        )
    finally:
        await conn.close()


def create_event(user_id: str) -> str:
    return run_async(_create_event(user_id))


async def _count_events(event_id: str) -> int:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "SELECT count(*) FROM events WHERE id = $1::uuid", event_id
        )
    finally:
        await conn.close()


def count_events(event_id: str) -> int:
    return run_async(_count_events(event_id))


async def _user_active(user_id: str) -> bool | None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval('SELECT active FROM "user" WHERE id = $1', user_id)
    finally:
        await conn.close()


def user_active(user_id: str) -> bool | None:
    return run_async(_user_active(user_id))


async def _create_invitation(
    email: str, invited_by: str, statut: str, expiration: datetime, jeton: str
) -> str:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "INSERT INTO invitations (email, jeton, expiration, statut, invite_par) "
            "VALUES ($1, $2, $3, $4, $5) RETURNING id::text",
            email,
            jeton,
            expiration,
            statut,
            invited_by,
        )
    finally:
        await conn.close()


def create_invitation(
    email: str,
    invited_by: str,
    statut: str = "envoyee",
    expires_in_days: int = 7,
) -> tuple[str, str]:
    """Cree une invitation de test, retourne (id, jeton)."""
    jeton = f"jeton-{uuid.uuid4().hex}"
    expiration = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    inv_id = run_async(
        _create_invitation(email, invited_by, statut, expiration, jeton)
    )
    return inv_id, jeton


async def _delete_invitation(inv_id: str) -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute("DELETE FROM invitations WHERE id = $1::uuid", inv_id)
    finally:
        await conn.close()


def delete_invitation(inv_id: str) -> None:
    run_async(_delete_invitation(inv_id))


async def _invitation_statut(inv_id: str) -> str | None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "SELECT statut FROM invitations WHERE id = $1::uuid", inv_id
        )
    finally:
        await conn.close()


def invitation_statut(inv_id: str) -> str | None:
    return run_async(_invitation_statut(inv_id))


async def _count_admins(active_only: bool) -> int:
    conn = await asyncpg.connect(settings.database_url)
    try:
        if active_only:
            return await conn.fetchval(
                "SELECT count(*) FROM \"user\" WHERE role = 'admin' AND active = true"
            )
        return await conn.fetchval(
            "SELECT count(*) FROM \"user\" WHERE role = 'admin'"
        )
    finally:
        await conn.close()


def count_admins(active_only: bool = False) -> int:
    return run_async(_count_admins(active_only))


def admin_user_id() -> str:
    uid = run_async(_get_admin_user_id())
    if uid is None:
        pytest.skip("Aucun utilisateur en base (lancer `npm run db:seed`).")
    return uid


# --- Helpers journal d'usage (Round 010) : ecriture directe via le role admin
# (les tables sont sous RLS, ce role la contourne pour poser des donnees de test
# a un instant precis) ---


async def _create_usage_event(user_id: str, type_: str, created_at: datetime) -> str:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "INSERT INTO usage_events (user_id, type, created_at) "
            "VALUES ($1, $2, $3) RETURNING id::text",
            user_id,
            type_,
            created_at,
        )
    finally:
        await conn.close()


def create_usage_event(
    user_id: str,
    type_: str = "dashboard_opened",
    created_at: datetime | None = None,
) -> str:
    """Cree un evenement d'usage de test a un instant precis (defaut: maintenant)."""
    ts = created_at or datetime.now(timezone.utc)
    return run_async(_create_usage_event(user_id, type_, ts))


async def _create_llm_usage(
    user_id: str,
    agent: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: str,
    created_at: datetime,
) -> str:
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await conn.fetchval(
            "INSERT INTO llm_usage "
            "(user_id, agent, model, prompt_tokens, completion_tokens, cost_usd, created_at) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::text",
            user_id,
            agent,
            model,
            prompt_tokens,
            completion_tokens,
            cost_usd,
            created_at,
        )
    finally:
        await conn.close()


def create_llm_usage(
    user_id: str,
    agent: str = "assistant",
    model: str = "claude-sonnet-4-5",
    prompt_tokens: int = 100,
    completion_tokens: int = 50,
    cost_usd: str = "0.0100",
    created_at: datetime | None = None,
) -> str:
    """Cree un enregistrement de cout LLM de test."""
    ts = created_at or datetime.now(timezone.utc)
    return run_async(
        _create_llm_usage(
            user_id, agent, model, prompt_tokens, completion_tokens, cost_usd, ts
        )
    )
