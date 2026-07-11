"""Dependency FastAPI : valide la session Better-auth et retourne le user.

Etapes (echec silencieux = 401, jamais 500) :
  1. lire le cookie brut (dev ou prod __Secure-)
  2. verifier la signature HMAC-SHA256 avec BETTER_AUTH_SECRET
  3. lookup du token verifie dans la table `session` + jointure `user`
  4. controler l'expiration (expires_at)
"""

from datetime import datetime, timezone
from typing import TypedDict

from fastapi import Depends, HTTPException, Request, status

from app.auth.cookie import extract_cookie_value, verify_session_cookie
from app.config import settings
from app.db.client import get_pool


class AuthUser(TypedDict):
    id: str
    email: str
    name: str
    role: str
    active: bool


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


async def get_current_user(request: Request) -> AuthUser:
    raw_cookie = extract_cookie_value(request.cookies)
    if not raw_cookie:
        raise _unauthorized("Non authentifie")

    token = verify_session_cookie(raw_cookie, settings.better_auth_secret)
    if token is None:
        raise _unauthorized("Signature de session invalide")

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.id, u.email, u.name, u.role, u.active, s.expires_at
            FROM "session" s
            JOIN "user" u ON u.id = s.user_id
            WHERE s.token = $1
            LIMIT 1
            """,
            token,
        )

    if row is None:
        raise _unauthorized("Session invalide")

    expires_at = row["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise _unauthorized("Session expiree")

    # Enforcement de la desactivation cote API : un compte desactive ne peut
    # plus etre authentifie meme si une session residuelle existe encore.
    if not row["active"]:
        raise _unauthorized("Compte desactive")

    return AuthUser(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        role=row["role"],
        active=row["active"],
    )


async def require_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Restreint l'acces aux administrateurs (403 sinon)."""
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé à l'administrateur",
        )
    return user
