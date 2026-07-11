"""Acces BDD a la connexion Google d'un utilisateur (table `google_connections`).

TOUS les acces passent par `scoped_connection(user_id)` : la table est sous RLS
(`SET LOCAL app.current_user_id`), donc chaque requete ne voit/n'ecrit que la
ligne de l'utilisateur courant. Le pool admin n'est JAMAIS utilise ici.

Les jetons OAuth sont chiffres (AES-256-GCM) avant l'ecriture et dechiffres a la
lecture : ils ne sont jamais stockes ni renvoyes en clair depuis la BDD.
"""

from __future__ import annotations

from datetime import datetime

from app.db.client import scoped_connection
from app.security.token_cipher import decrypt, encrypt

# Colonnes de metadonnees exposees (jamais les jetons) pour l'etat de connexion.
_META_COLUMNS = (
    "id, user_id, scopes, calendar_sync_token, gmail_history_id, status, "
    "token_expiry, calendar_synced_at, gmail_synced_at, sync_locked_until, "
    "last_manual_sync_at, reauth_notified, created_at, updated_at"
)


async def get_connection(user_id: str) -> dict | None:
    """Renvoie les metadonnees de connexion (curseurs, statut, fraicheur) sans jetons."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"SELECT {_META_COLUMNS} FROM google_connections WHERE user_id = $1",
            user_id,
        )
    return dict(row) if row is not None else None


async def upsert_tokens(
    user_id: str,
    *,
    access_token: str,
    refresh_token: str | None = None,
    token_expiry: datetime | None = None,
    scopes: list[str] | None = None,
) -> None:
    """Chiffre puis stocke les jetons (upsert) et remet la connexion en `connected`.

    `refresh_token`/`scopes` a `None` sont preserves (Google ne renvoie pas
    toujours un refresh_token lors d'un rafraichissement).
    """
    enc_access = encrypt(access_token)
    enc_refresh = encrypt(refresh_token) if refresh_token is not None else None
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            """
            INSERT INTO google_connections
                (user_id, access_token, refresh_token, token_expiry, scopes,
                 status, reauth_notified, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'connected', false, now())
            ON CONFLICT (user_id) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, google_connections.refresh_token),
                token_expiry = EXCLUDED.token_expiry,
                scopes = COALESCE(EXCLUDED.scopes, google_connections.scopes),
                status = 'connected',
                reauth_notified = false,
                updated_at = now()
            """,
            user_id,
            enc_access,
            enc_refresh,
            token_expiry,
            scopes,
        )


async def read_tokens(user_id: str) -> dict | None:
    """Renvoie les jetons DECHIFFRES + leur expiration, ou None si pas de connexion."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "SELECT access_token, refresh_token, token_expiry, scopes, status "
            "FROM google_connections WHERE user_id = $1",
            user_id,
        )
    if row is None:
        return None
    return {
        "access_token": decrypt(row["access_token"]) if row["access_token"] else None,
        "refresh_token": decrypt(row["refresh_token"]) if row["refresh_token"] else None,
        "token_expiry": row["token_expiry"],
        "scopes": row["scopes"],
        "status": row["status"],
    }


async def update_cursors(
    user_id: str,
    *,
    calendar_sync_token: str | None = None,
    gmail_history_id: str | None = None,
) -> None:
    """Met a jour les curseurs fournis (les `None` conservent la valeur existante)."""
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            """
            UPDATE google_connections SET
                calendar_sync_token = COALESCE($2, calendar_sync_token),
                gmail_history_id = COALESCE($3, gmail_history_id),
                updated_at = now()
            WHERE user_id = $1
            """,
            user_id,
            calendar_sync_token,
            gmail_history_id,
        )


async def set_reauth_required(user_id: str) -> bool:
    """Passe la connexion en `reauth_required`.

    Renvoie True si c'est la PREMIERE transition (flag `reauth_notified` pose) :
    l'appelant emet alors la notification de reconnexion une seule fois.
    """
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            """
            UPDATE google_connections
            SET status = 'reauth_required', reauth_notified = true, updated_at = now()
            WHERE user_id = $1 AND reauth_notified = false
            RETURNING id
            """,
            user_id,
        )
        if row is not None:
            return True
        # Deja notifie : garantir que le statut reste reauth_required.
        await conn.execute(
            "UPDATE google_connections SET status = 'reauth_required', "
            "updated_at = now() WHERE user_id = $1",
            user_id,
        )
    return False


async def acquire_sync_lock(user_id: str, lock_seconds: int = 120) -> bool:
    """Pose le verrou anti-chevauchement de maniere atomique.

    UPDATE conditionnel : le verrou n'est pris que s'il est libre ou expire.
    Renvoie False si un run est deja en cours (0 ligne) ou s'il n'y a pas de
    connexion pour cet utilisateur.
    """
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            """
            UPDATE google_connections
            SET sync_locked_until = now() + make_interval(secs => $2),
                updated_at = now()
            WHERE user_id = $1
              AND (sync_locked_until IS NULL OR sync_locked_until < now())
            RETURNING id
            """,
            user_id,
            lock_seconds,
        )
    return row is not None


async def release_sync_lock(user_id: str) -> None:
    """Libere le verrou de synchronisation."""
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            "UPDATE google_connections SET sync_locked_until = NULL, "
            "updated_at = now() WHERE user_id = $1",
            user_id,
        )


async def touch_manual_sync(user_id: str) -> None:
    """Horodate la derniere synchronisation manuelle (anti-spam 1/30 s)."""
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            "UPDATE google_connections SET last_manual_sync_at = now(), "
            "updated_at = now() WHERE user_id = $1",
            user_id,
        )
