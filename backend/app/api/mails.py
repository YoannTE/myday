"""Endpoints mails : liste triee, detail, mise a jour, feedback expediteur.

Proteges par `get_current_user`. Reponses `{"data": ...}` (SOP
`api-response-casing-contract`, snake_case sans alias). Logique dans
`app.services.mails`.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.auth.session import AuthUser, get_current_user
from app.models.mails import MailFeedback, MailListResponse, MailResponse, MailUpdate
from app.services import mails as mails_service
from app.utils.errors import not_found

router = APIRouter(prefix="/mails", tags=["mails"])


@router.get("")
async def list_mails(
    filter: Literal["important", "tous"] = Query(default="tous"),
    user: AuthUser = Depends(get_current_user),
):
    """Liste les mails, triee score desc puis date de reception desc."""
    result = await mails_service.list_mails(user["id"], filter)
    payload = MailListResponse(
        mails=[MailResponse(**m) for m in result["mails"]],
        ecartes=result["ecartes"],
    )
    return {"data": payload.model_dump()}


@router.get("/{mail_id}")
async def get_mail(mail_id: UUID, user: AuthUser = Depends(get_current_user)):
    """Detail d'un mail (resume, raison, extrait) ; marque `lu=true`."""
    mail = await mails_service.get_mail(user["id"], str(mail_id))
    if mail is None:
        raise not_found("Mail introuvable.")
    return {"data": MailResponse(**mail).model_dump()}


@router.patch("/{mail_id}")
async def patch_mail(
    mail_id: UUID,
    payload: MailUpdate,
    user: AuthUser = Depends(get_current_user),
):
    """Met a jour partiellement `lu`/`repondu`."""
    mail = await mails_service.update_mail(
        user["id"], str(mail_id), payload.lu, payload.repondu
    )
    if mail is None:
        raise not_found("Mail introuvable.")
    return {"data": MailResponse(**mail).model_dump()}


@router.post("/{mail_id}/feedback")
async def post_feedback(
    mail_id: UUID,
    payload: MailFeedback,
    user: AuthUser = Depends(get_current_user),
):
    """Feedback expediteur : upsert `sender_preferences` + reclassement immediat."""
    statut = await mails_service.apply_feedback(user["id"], str(mail_id), payload.valeur)
    if statut is None:
        raise not_found("Mail introuvable.")
    return {"data": {"statut": statut}}
