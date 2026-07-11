"""Logique métier des invitations (admin).

Écritures via le pool `app_admin` (table hors RLS). Le statut « expiree » est
DÉRIVÉ à l'affichage, jamais stocké. L'anti-doublon pending est délégué à
l'index unique partiel : on capture UniqueViolation pour renvoyer un 400 propre.
"""

import secrets
from datetime import datetime, timedelta, timezone

import asyncpg

from app.config import settings
from app.db.client import get_admin_pool
from app.utils.errors import bad_request, not_found

INVITATION_TTL_DAYS = 7

_RETURNING = (
    "id, email, jeton, statut, expiration, created_at, accepted_at, accepted_by"
)


def _invite_url(jeton: str) -> str:
    return f"{settings.app_url}/sign-up?invitation={jeton}"


def _serialize(row: asyncpg.Record) -> dict:
    statut = row["statut"]
    expiration = row["expiration"]
    if statut == "envoyee" and expiration < datetime.now(timezone.utc):
        statut = "expiree"
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "statut": statut,
        "expiration": expiration,
        "created_at": row["created_at"],
        "accepted_at": row["accepted_at"],
        "accepted_by": row["accepted_by"],
        "invite_url": _invite_url(row["jeton"]),
    }


def _fresh_token_and_expiration() -> tuple[str, datetime]:
    jeton = secrets.token_urlsafe(32)
    expiration = datetime.now(timezone.utc) + timedelta(days=INVITATION_TTL_DAYS)
    return jeton, expiration


async def list_invitations() -> list[dict]:
    pool = get_admin_pool()
    rows = await pool.fetch(
        f"SELECT {_RETURNING} FROM invitations ORDER BY created_at DESC"
    )
    return [_serialize(r) for r in rows]


async def create_invitation(email: str, invited_by: str) -> dict:
    pool = get_admin_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchval(
            'SELECT 1 FROM "user" WHERE lower(email) = $1', email
        )
        if existing:
            raise bad_request("Un compte existe déjà pour cette adresse email.")

        jeton, expiration = _fresh_token_and_expiration()
        try:
            row = await conn.fetchrow(
                f"""
                INSERT INTO invitations (email, jeton, expiration, statut, invite_par)
                VALUES ($1, $2, $3, 'envoyee', $4)
                RETURNING {_RETURNING}
                """,
                email,
                jeton,
                expiration,
                invited_by,
            )
        except asyncpg.UniqueViolationError as err:
            raise bad_request(
                "Une invitation est déjà en attente pour cette adresse email."
            ) from err
    return _serialize(row)


async def renew_invitation(invitation_id: str) -> dict:
    pool = get_admin_pool()
    jeton, expiration = _fresh_token_and_expiration()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                f"""
                UPDATE invitations
                SET jeton = $2, expiration = $3, statut = 'envoyee', updated_at = now()
                WHERE id = $1 AND statut <> 'acceptee'
                RETURNING {_RETURNING}
                """,
                invitation_id,
                jeton,
                expiration,
            )
        except asyncpg.UniqueViolationError as err:
            raise bad_request(
                "Une invitation est déjà en attente pour cette adresse email."
            ) from err
    if row is None:
        await _reject_or_404(
            invitation_id, "Impossible de renouveler une invitation déjà acceptée."
        )
    return _serialize(row)


async def revoke_invitation(invitation_id: str) -> dict:
    pool = get_admin_pool()
    row = await pool.fetchrow(
        f"""
        UPDATE invitations
        SET statut = 'revoquee', updated_at = now()
        WHERE id = $1 AND statut <> 'acceptee'
        RETURNING {_RETURNING}
        """,
        invitation_id,
    )
    if row is None:
        await _reject_or_404(
            invitation_id, "Impossible de révoquer une invitation déjà acceptée."
        )
    return _serialize(row)


async def _reject_or_404(invitation_id: str, conflict_message: str) -> None:
    """0 ligne : distingue 404 (inexistante) de 400 (déjà acceptee)."""
    pool = get_admin_pool()
    exists = await pool.fetchval(
        "SELECT 1 FROM invitations WHERE id = $1", invitation_id
    )
    if not exists:
        raise not_found("Invitation introuvable.")
    raise bad_request(conflict_message)
