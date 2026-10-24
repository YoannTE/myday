"""Dependency FastAPI de l'accès « machine » MIA (`/api/mia`).

Pas de cookie Better-auth ici : le Mac de l'utilisateur appelle l'API avec
curl et l'en-tête `Authorization: Bearer <MIA_TOKEN>`. Le jeton est comparé à
temps constant (`hmac.compare_digest`). Il ouvre l'accès à UN seul compte,
celui dont l'email vaut `MIA_USER_EMAIL`, renvoyé sous la même forme
qu'`get_current_user` : les services et la RLS s'appliquent donc exactement
comme pour une session du site.

Fonction désactivée par défaut : sans `MIA_TOKEN` (assez long) ni
`MIA_USER_EMAIL`, toutes les routes répondent 404, comme si elles
n'existaient pas.
"""

import hmac

from fastapi import HTTPException, Request, status

from app.auth.session import AuthUser
from app.config import settings
from app.db.client import get_pool


def _mia_configure() -> bool:
    return (
        len(settings.mia_token) >= settings.mia_token_min_length
        and bool(settings.mia_user_email.strip())
    )


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Jeton MIA invalide",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_mia_user(request: Request) -> AuthUser:
    if not _mia_configure():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    entete = request.headers.get("authorization", "")
    schema, _, jeton = entete.partition(" ")
    if schema.lower() != "bearer" or not jeton.strip():
        raise _unauthorized()
    if not hmac.compare_digest(
        jeton.strip().encode("utf-8"), settings.mia_token.encode("utf-8")
    ):
        raise _unauthorized()

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT id, email, name, role, active FROM "user" '
            "WHERE lower(email) = lower($1) LIMIT 1",
            settings.mia_user_email.strip(),
        )

    # Compte introuvable ou désactivé : même réponse qu'un mauvais jeton, pour
    # ne rien révéler de la configuration.
    if row is None or not row["active"]:
        raise _unauthorized()

    return AuthUser(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        role=row["role"],
        active=row["active"],
    )
