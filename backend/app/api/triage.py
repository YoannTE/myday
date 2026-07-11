"""Endpoint de rafraîchissement manuel du tri des mails (Round 006).

Trie de façon synchrone les mails `pending_triage` de l'utilisateur : rapide
en mode fallback (le chemin nominal ce round, aucune clé LLM configurée).
"""

from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, get_current_user
from app.db.client import scoped_connection
from app.services.mail_triage.orchestrator import run_mail_triage

router = APIRouter(prefix="/triage", tags=["triage"])


async def _pending_mail_ids(user_id: str) -> list[str]:
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            "SELECT id::text FROM mails WHERE user_id = $1 AND statut = 'pending_triage'",
            user_id,
        )
    return [r["id"] for r in rows]


@router.post("/refresh")
async def refresh_triage(user: AuthUser = Depends(get_current_user)):
    mail_ids = await _pending_mail_ids(user["id"])
    result = await run_mail_triage(user["id"], mail_ids, "manual")
    return {"data": result}
