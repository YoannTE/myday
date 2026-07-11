"""Endpoints des préférences utilisateur (brief, notifications, onboarding).

Protégés par `get_current_user`. Réponses `{"data": ...}` en snake_case (SOP
`api-response-casing-contract`). La ligne est créée à la demande (create-or-
default) : GET comme PATCH fonctionnent dès le premier appel, sans étape de
provisioning séparée.
"""

from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, get_current_user
from app.models.preferences import PreferencesResponse, PreferencesUpdate
from app.services import preferences as preferences_service

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
async def get_preferences(user: AuthUser = Depends(get_current_user)):
    prefs = await preferences_service.get_or_create_preferences(user["id"])
    return {"data": PreferencesResponse(**prefs).model_dump()}


@router.patch("")
async def patch_preferences(
    payload: PreferencesUpdate, user: AuthUser = Depends(get_current_user)
):
    prefs = await preferences_service.update_preferences(user["id"], payload)
    return {"data": PreferencesResponse(**prefs).model_dump()}
