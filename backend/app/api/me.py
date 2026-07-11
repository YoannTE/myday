"""Endpoints du compte courant : lecture de la session et suppression."""

from fastapi import APIRouter, Depends, Response, status

from app.auth.session import AuthUser, get_current_user
from app.services import accounts as accounts_service
from app.services.google import oauth as google_oauth

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(user: AuthUser = Depends(get_current_user)):
    return {"data": user}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(user: AuthUser = Depends(get_current_user)) -> Response:
    """Supprime le compte courant (cascade FK) sous garde dernier-administrateur.

    Revoque l'acces Google en best-effort AVANT la purge (jamais bloquant) : le
    ON DELETE CASCADE supprimerait la connexion sans prevenir Google sinon.
    """
    await google_oauth.revoke_token(user["id"])
    await accounts_service.delete_own_account(user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)
