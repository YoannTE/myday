"""Logique métier de gestion des comptes (admin + suppression de soi).

Les gardes « dernier administrateur » sont EXCLUSIVEMENT atomiques (UPDATE/DELETE
conditionnels avec sous-requête de comptage) : jamais de SELECT-puis-UPDATE, pour
résister à deux opérations concurrentes. Écritures via le pool `app_admin`.
"""

import asyncpg

from app.db.client import get_admin_pool
from app.utils.errors import bad_request, not_found


def _account_to_dict(row: asyncpg.Record) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "active": row["active"],
        "last_connexion": None,
    }


async def list_accounts() -> list[dict]:
    pool = get_admin_pool()
    rows = await pool.fetch(
        """
        SELECT u.id, u.email, u.name, u.role, u.active,
               (SELECT max(s.created_at) FROM "session" s WHERE s.user_id = u.id)
                   AS last_connexion
        FROM "user" u
        ORDER BY u.created_at ASC
        """
    )
    return [dict(r) for r in rows]


async def set_account_active(account_id: str, active: bool) -> dict:
    """Active/désactive un compte. Désactivation = garde dernier-admin-actif
    atomique + révocation des sessions dans LA MÊME transaction."""
    pool = get_admin_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            if active:
                row = await conn.fetchrow(
                    """
                    UPDATE "user"
                    SET active = true, updated_at = now()
                    WHERE id = $1
                    RETURNING id, email, name, role, active
                    """,
                    account_id,
                )
                if row is None:
                    raise not_found("Compte introuvable.")
                return _account_to_dict(row)

            row = await conn.fetchrow(
                """
                UPDATE "user"
                SET active = false, updated_at = now()
                WHERE id = $1
                  AND NOT (
                    role = 'admin' AND active = true
                    AND (SELECT count(*) FROM "user"
                         WHERE role = 'admin' AND active = true) <= 1
                  )
                RETURNING id, email, name, role, active
                """,
                account_id,
            )
            if row is None:
                exists = await conn.fetchval(
                    'SELECT 1 FROM "user" WHERE id = $1', account_id
                )
                if not exists:
                    raise not_found("Compte introuvable.")
                raise bad_request(
                    "Impossible de désactiver le dernier administrateur actif."
                )
            # Fenêtre « désactivé mais connecté » fermée dans la même transaction.
            await conn.execute('DELETE FROM "session" WHERE user_id = $1', account_id)
            return _account_to_dict(row)


async def delete_own_account(user_id: str) -> None:
    """Supprime son propre compte. Garde dernier-admin atomique ; les FK
    ON DELETE CASCADE purgent tout le contenu en une transaction."""
    pool = get_admin_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            deleted = await conn.fetchval(
                """
                DELETE FROM "user"
                WHERE id = $1
                  AND NOT (
                    role = 'admin'
                    AND (SELECT count(*) FROM "user" WHERE role = 'admin') <= 1
                  )
                RETURNING id
                """,
                user_id,
            )
            if deleted is None:
                raise bad_request("Impossible de supprimer le dernier administrateur.")
