"""Dependency FastAPI : exige un budget déverrouillé, en plus de la session.

Deux barrières superposées, jamais l'une à la place de l'autre :

1. `get_current_user` — la session MyDay (cookie Better-auth signé).
2. `require_budget_unlock` — le jeton délivré après saisie du code à 4 chiffres,
   présenté dans l'en-tête `X-Budget-Acces`.

Le jeton porte l'identifiant de son propriétaire et une expiration (12 h) : il
est vérifié CONTRE l'utilisateur de la session, donc un jeton valide obtenu sur
un autre compte n'ouvre rien ici.

Un jeton absent ou périmé renvoie 401 avec un code applicatif distinct
(`budget_verrouille`) : le frontend doit pouvoir distinguer « session MyDay
expirée » (→ page de connexion) de « budget reverrouillé » (→ clavier du code),
sans se fier au texte du message.
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from app.auth.session import AuthUser, get_current_user
from app.security.code_budget import verifier_jeton

EN_TETE_ACCES = "X-Budget-Acces"


async def require_budget_unlock(
    user: AuthUser = Depends(get_current_user),
    x_budget_acces: str | None = Header(default=None, alias=EN_TETE_ACCES),
) -> AuthUser:
    if not verifier_jeton(x_budget_acces, user["id"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Budget verrouillé. Saisis ton code pour continuer.",
            headers={"X-Budget-Etat": "verrouille"},
        )
    return user
