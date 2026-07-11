"""Endpoints d'administration : invitations et gestion des comptes.

Tous proteges par `require_admin` (403 « Accès réservé à l'administrateur »).
Reponses au format `{"data": ...}` ; erreurs via HTTPException (messages FR).
"""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, require_admin
from app.models.admin import (
    AccountResponse,
    AccountUpdate,
    InvitationCreate,
    InvitationResponse,
)
from app.services import accounts as accounts_service
from app.services import admin_usage as admin_usage_service
from app.services import invitations as invitations_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/invitations")
async def get_invitations(admin: AuthUser = Depends(require_admin)):
    invitations = await invitations_service.list_invitations()
    return {"data": [InvitationResponse(**inv).model_dump() for inv in invitations]}


@router.post("/invitations", status_code=201)
async def post_invitation(
    payload: InvitationCreate, admin: AuthUser = Depends(require_admin)
):
    invitation = await invitations_service.create_invitation(payload.email, admin["id"])
    return {
        "data": {
            "invitation": InvitationResponse(**invitation).model_dump(),
            "invite_url": invitation["invite_url"],
        }
    }


@router.post("/invitations/{invitation_id}/renew")
async def renew_invitation(
    invitation_id: UUID, admin: AuthUser = Depends(require_admin)
):
    invitation = await invitations_service.renew_invitation(str(invitation_id))
    return {"data": InvitationResponse(**invitation).model_dump()}


@router.delete("/invitations/{invitation_id}")
async def delete_invitation(
    invitation_id: UUID, admin: AuthUser = Depends(require_admin)
):
    invitation = await invitations_service.revoke_invitation(str(invitation_id))
    return {"data": InvitationResponse(**invitation).model_dump()}


@router.get("/accounts")
async def get_accounts(admin: AuthUser = Depends(require_admin)):
    accounts = await accounts_service.list_accounts()
    return {"data": [AccountResponse(**acc).model_dump() for acc in accounts]}


@router.patch("/accounts/{account_id}")
async def patch_account(
    account_id: str,
    payload: AccountUpdate,
    admin: AuthUser = Depends(require_admin),
):
    account = await accounts_service.set_account_active(account_id, payload.active)
    return {"data": AccountResponse(**account).model_dump()}


@router.get("/usage")
async def get_usage(admin: AuthUser = Depends(require_admin)):
    usage = await admin_usage_service.get_admin_usage()
    return {"data": usage.model_dump()}
