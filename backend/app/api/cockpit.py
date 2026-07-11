"""Endpoint Cockpit : agregation de la page d'accueil `/` (notes, journee, taches)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, get_current_user
from app.models.cockpit import CockpitResponse
from app.services import cockpit as cockpit_service

router = APIRouter(prefix="/cockpit", tags=["cockpit"])


@router.get("")
async def get_cockpit(user: AuthUser = Depends(get_current_user)):
    """Notes epinglees (max 5), evenements du jour, taches a faire, mails (placeholder)."""
    data = await cockpit_service.get_cockpit(user["id"])
    return {"data": CockpitResponse(**data).model_dump()}
