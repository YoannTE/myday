"""Endpoint exemple qui requiert une session Better-auth valide."""

from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, get_current_user

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(user: AuthUser = Depends(get_current_user)):
    return {"data": user}
