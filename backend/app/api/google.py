"""Endpoints Google : echange OAuth, synchronisation, etat, deconnexion.

Tous proteges par `get_current_user`. Reponses `{"data": ...}` / erreurs via
HTTPException (messages francais). L'echange de code est appele par le Route
Handler Next `/api/google/callback` (le client_secret ne quitte pas FastAPI).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response, status

from app.auth.session import AuthUser, get_current_user
from app.db.google_connection import get_connection, touch_manual_sync
from app.models.google import ExchangeRequest, GoogleStatusResponse
from app.services.google import oauth
from app.services.google.sync import run_sync
from app.utils.errors import bad_request, too_many_requests

router = APIRouter(prefix="/google", tags=["google"])

# Anti-spam du rafraichissement manuel : 1 declenchement / 30 s / utilisateur.
_MANUAL_SYNC_COOLDOWN_SECONDS = 30


@router.post("/exchange")
async def exchange(body: ExchangeRequest, user: AuthUser = Depends(get_current_user)):
    """Echange le code d'autorisation PKCE contre les jetons (stockage chiffre)."""
    try:
        result = await oauth.exchange_code(user["id"], body.code, body.code_verifier)
    except ValueError as exc:
        raise bad_request(str(exc)) from exc
    return {"data": result}


@router.post("/sync")
async def sync(user: AuthUser = Depends(get_current_user)):
    """Declenche une synchronisation manuelle (anti-spam 1/30 s)."""
    meta = await get_connection(user["id"])
    if meta is None:
        raise bad_request("Aucune connexion Google active.")
    last = meta.get("last_manual_sync_at")
    if last is not None:
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last).total_seconds()
        if elapsed < _MANUAL_SYNC_COOLDOWN_SECONDS:
            raise too_many_requests(
                "Patiente quelques secondes avant de resynchroniser."
            )
    await touch_manual_sync(user["id"])
    result = await run_sync(user["id"], trigger="manual")
    return {"data": result}


@router.get("/status")
async def google_status(user: AuthUser = Depends(get_current_user)):
    """Etat de connexion (connecte ?, fraicheur par branche, scopes, reauth)."""
    meta = await get_connection(user["id"])
    if meta is None:
        return {"data": GoogleStatusResponse(connected=False).model_dump()}
    payload = GoogleStatusResponse(
        connected=meta["status"] != "disconnected",
        status=meta["status"],
        reauth_required=meta["status"] == "reauth_required",
        scopes=meta.get("scopes") or [],
        calendar_synced_at=meta.get("calendar_synced_at"),
        gmail_synced_at=meta.get("gmail_synced_at"),
        last_manual_sync_at=meta.get("last_manual_sync_at"),
    )
    return {"data": payload.model_dump()}


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect(user: AuthUser = Depends(get_current_user)) -> Response:
    """Deconnecte Google : revocation best-effort + suppression de la connexion."""
    await oauth.disconnect_google(user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)
