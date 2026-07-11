"""Logique métier des notifications (liste, marquage lu, compteur non-lues).

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS) - jamais
le pool admin. Bornées à 100 lignes les plus récentes (pas de pagination
demandée ce round).
"""

from __future__ import annotations

from uuid import UUID

from app.db.client import scoped_connection

_LIST_LIMIT = 100


async def list_notifications(user_id: str, lue: bool | None) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        if lue is None:
            rows = await conn.fetch(
                """
                SELECT id::text, type, contenu, ref_id::text, lue, date_envoi
                FROM notifications WHERE user_id = $1
                ORDER BY date_envoi DESC LIMIT $2
                """,
                user_id, _LIST_LIMIT,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id::text, type, contenu, ref_id::text, lue, date_envoi
                FROM notifications WHERE user_id = $1 AND lue = $2
                ORDER BY date_envoi DESC LIMIT $3
                """,
                user_id, lue, _LIST_LIMIT,
            )
    return [dict(r) for r in rows]


async def mark_read(user_id: str, ids: list[UUID] | None) -> int:
    async with scoped_connection(user_id) as conn:
        if ids:
            rows = await conn.fetch(
                """
                UPDATE notifications SET lue = true
                WHERE user_id = $1 AND id = ANY($2::uuid[]) AND lue = false
                RETURNING id
                """,
                user_id, [str(i) for i in ids],
            )
        else:
            rows = await conn.fetch(
                """
                UPDATE notifications SET lue = true
                WHERE user_id = $1 AND lue = false
                RETURNING id
                """,
                user_id,
            )
    return len(rows)


async def unread_count(user_id: str) -> int:
    async with scoped_connection(user_id) as conn:
        count = await conn.fetchval(
            "SELECT count(*) FROM notifications WHERE user_id = $1 AND lue = false",
            user_id,
        )
    return int(count)
