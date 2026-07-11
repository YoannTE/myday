"""Endpoint de génération du brief (Round 007) : `POST /api/brief/generate`.

Anti-spam manuel (correction #8 review) : vérifie le dernier brief
`a_la_demande` de la dernière minute via une requête BDD (robuste au
redémarrage ; TOCTOU possible en cas d'appels quasi simultanés — acceptable
au volume de ce projet, noté dans le plan). `brief_date` est calculée côté
endpoint en timezone utilisateur — jamais dans l'orchestrateur (déterminisme).
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, get_current_user
from app.config import settings
from app.db.client import scoped_connection
from app.services.daily_brief.orchestrator import run_daily_brief
from app.utils.errors import too_many_requests

router = APIRouter(prefix="/brief", tags=["brief"])

_ALLOWED_TRIGGERS = {"manual", "onboarding"}


async def _user_timezone(user_id: str) -> str:
    async with scoped_connection(user_id) as conn:
        tz = await conn.fetchval(
            "SELECT timezone FROM user_preferences WHERE user_id = $1", user_id
        )
    return tz or settings.app_timezone


async def _cooldown_active(user_id: str) -> bool:
    async with scoped_connection(user_id) as conn:
        return bool(
            await conn.fetchval(
                "SELECT 1 FROM briefs WHERE type = 'a_la_demande' "
                "AND created_at > now() - make_interval(secs => $1)",
                settings.brief_manual_cooldown_seconds,
            )
        )


@router.post("/generate")
async def generate_brief(
    trigger: str = "manual", user: AuthUser = Depends(get_current_user)
):
    trigger = trigger if trigger in _ALLOWED_TRIGGERS else "manual"

    if await _cooldown_active(user["id"]):
        raise too_many_requests(
            "Un brief vient d'être généré, réessaie dans une minute."
        )

    timezone_str = await _user_timezone(user["id"])
    brief_date = datetime.now(ZoneInfo(timezone_str)).date().isoformat()

    result = await run_daily_brief(user["id"], trigger, brief_date)
    return {"data": result}
