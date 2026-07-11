"""Validation de la session Better-auth en lisant directement la table `session`.

Better-auth stocke les sessions dans la table `session` avec un token unique.
Le cookie HTTP `better-auth.session_token` contient ce meme token.
On verifie sa presence en BDD + sa date d'expiration.
"""

from datetime import datetime, timezone
from typing import TypedDict

from fastapi import Cookie, Depends, HTTPException, status

from app.db.client import get_pool

COOKIE_NAME = "better-auth.session_token"


class AuthUser(TypedDict):
    id: str
    email: str
    name: str


async def get_current_user(
    session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> AuthUser:
    """Dependency FastAPI : retourne le user connecte ou leve une 401."""
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non authentifie")

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.id, u.email, u.name, s.expires_at
            FROM "session" s
            JOIN "user" u ON u.id = s.user_id
            WHERE s.token = $1
            LIMIT 1
            """,
            session_token,
        )

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalide")

    expires_at = row["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expiree")

    return AuthUser(id=row["id"], email=row["email"], name=row["name"])


CurrentUser = Depends(get_current_user)
