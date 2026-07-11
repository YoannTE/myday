"""Endpoints de décision hors-ligne sur les brouillons de mail de l'assistant.

Règle métier absolue : aucun mail ne part sans un `POST .../decision` explicite
avec `decision=approve` - jamais depuis le moteur de conversation (orchestrateur
BACK-CONV). Réponses `{"data": ...}` / `{"detail": ...}`, snake_case (SOP
`api-response-casing-contract`). RLS via `app.services.assistant_drafts`
(`scoped_connection`) : un brouillon d'un autre utilisateur -> 404.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, get_current_user
from app.models.assistant_drafts import DraftDecisionRequest, MailDraftResponse
from app.services import assistant_drafts as service
from app.utils.errors import not_found

router = APIRouter(prefix="/assistant/drafts", tags=["assistant"])


@router.get("/{draft_id}")
async def get_draft(draft_id: UUID, user: AuthUser = Depends(get_current_user)):
    draft = await service.get_draft(user["id"], str(draft_id))
    if draft is None:
        raise not_found("Brouillon introuvable.")
    return {"data": MailDraftResponse.model_validate(draft).model_dump()}


@router.post("/{draft_id}/decision")
async def decide_draft(
    draft_id: UUID,
    payload: DraftDecisionRequest,
    user: AuthUser = Depends(get_current_user),
):
    if payload.decision == "reject":
        result = await service.reject_draft(user["id"], str(draft_id))
    else:
        edited = payload.edited.model_dump(exclude_none=True) if payload.edited else None
        result = await service.approve_draft(user["id"], str(draft_id), edited)
    return {"data": result}
