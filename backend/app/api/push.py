"""Endpoints Web Push : clé publique VAPID + abonnement navigateur.

Protégés par `get_current_user` (correction #9 du plan : la clé publique
VAPID reste derrière auth, le service worker s'abonne depuis une page déjà
authentifiée). Réponses `{"data": ...}` (SOP `api-response-casing-contract`).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.auth.session import AuthUser, get_current_user
from app.config import settings
from app.models.push import PushSubscribeRequest, PushUnsubscribeRequest
from app.services.push import subscriptions as push_subscriptions
from app.services.push.sender import dispatch_push

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-public-key")
async def get_vapid_public_key(user: AuthUser = Depends(get_current_user)):
    return {"data": {"public_key": settings.vapid_public_key}}


@router.post("/subscribe")
async def subscribe(
    payload: PushSubscribeRequest, user: AuthUser = Depends(get_current_user)
):
    await push_subscriptions.upsert_subscription(
        user["id"], payload.endpoint, payload.keys.p256dh, payload.keys.auth
    )
    return {"data": {"ok": True}}


@router.post("/test")
async def send_test_notification(user: AuthUser = Depends(get_current_user)):
    """Envoie une notification de test à tous les appareils abonnés de
    l'utilisateur — diagnostic bout en bout de la chaîne push (abonnements,
    VAPID, service worker)."""
    subs = await push_subscriptions.list_subscriptions(user["id"])
    sent = await dispatch_push(
        user["id"],
        "test",
        "MyDay",
        "Notification de test : tout fonctionne !",
        "/reglages",
    )
    return {"data": {"subscriptions": len(subs), "sent": sent}}


@router.delete("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    payload: PushUnsubscribeRequest, user: AuthUser = Depends(get_current_user)
) -> Response:
    await push_subscriptions.delete_subscription(user["id"], payload.endpoint)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
