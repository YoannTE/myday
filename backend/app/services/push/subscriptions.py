"""CRUD des abonnements Web Push (`push_subscriptions`).

Lecture/suppression : TOUJOURS via `scoped_connection` (RLS) - un utilisateur
ne touche jamais qu'à ses propres abonnements.

Upsert (souscription) - EXCEPTION documentée : `endpoint` est une clé
GLOBALE (unique tous utilisateurs confondus, cf. schéma) : sur un appareil
partagé, le dernier utilisateur à s'abonner doit reprendre la propriété de
l'endpoint (correction #7 du plan). Or la policy RLS de `push_subscriptions`
(`user_id = current_setting('app.current_user_id')`) est un USING/WITH CHECK
par ligne : une session scopée sur le NOUVEL utilisateur ne peut pas
modifier une ligne appartenant à l'ANCIEN utilisateur - Postgres lève
`InsufficientPrivilegeError` (vérifié manuellement, cf. tests). Cette
réassignation cross-utilisateur passe donc par le pool admin
(`get_admin_pool()`), au même titre que les écritures sur `session`/
`invitations` : c'est une opération d'enregistrement d'appareil, pas une
lecture/écriture de contenu appartenant à un autre utilisateur.
"""

from __future__ import annotations

from app.db.client import get_admin_pool, scoped_connection

_UPSERT_SQL = """
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (endpoint) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            updated_at = now()
"""


async def upsert_subscription(
    user_id: str, endpoint: str, p256dh: str, auth: str
) -> None:
    pool = get_admin_pool()
    await pool.execute(_UPSERT_SQL, user_id, endpoint, p256dh, auth)


async def delete_subscription(user_id: str, endpoint: str) -> None:
    """Supprime l'abonnement de `endpoint` s'il appartient à `user_id` (la
    RLS empêche de toute façon de toucher l'abonnement d'un autre)."""
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
            user_id, endpoint,
        )


async def list_subscriptions(user_id: str) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
            user_id,
        )
    return [dict(r) for r in rows]


async def delete_dead_subscription(user_id: str, endpoint: str) -> None:
    """Purge un abonnement mort (404/410 renvoyé par le service push) - même
    logique que `delete_subscription`, nom explicite côté appelant. Toujours
    scopé à `user_id` (jamais cross-utilisateur, contrairement à l'upsert)."""
    await delete_subscription(user_id, endpoint)
