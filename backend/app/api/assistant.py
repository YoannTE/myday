"""Endpoints de l'assistant conversationnel (Round 008). Protégés par
`get_current_user`. Réponses `{"data": ...}` (SOP
`api-response-casing-contract`, snake_case sans alias).

Anti-spam serveur-autoritaire (correction #16) : compte les tours `user`
persistés dans la dernière minute en BDD (restart-safe, `uvicorn --workers 1`).
`turn_key` = fourni par le client, ou dérivé (hash conversation_id+message) si
absent - clé d'idempotence consommée par l'orchestrateur (dédup en tête).
"""

from __future__ import annotations

import hashlib
import json

from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, get_current_user
from app.config import settings
from app.db.client import scoped_connection
from app.models.assistant import (
    AssistantMessageRequest,
    AssistantMessageResponse,
    ConversationCreateResponse,
    ConversationDetailResponse,
    ConversationTurnResponse,
)
from app.services.assistant.orchestrator import run_assistant_message
from app.utils.errors import not_found, too_many_requests

router = APIRouter(prefix="/assistant", tags=["assistant"])


def _derive_turn_key(conversation_id: str, message: str) -> str:
    digest = hashlib.sha256(f"{conversation_id}:{message}".encode("utf-8")).hexdigest()
    return digest[:40]


async def _rate_limited(user_id: str) -> bool:
    async with scoped_connection(user_id) as conn:
        count = await conn.fetchval(
            "SELECT count(*) FROM assistant_conversation_turns "
            "WHERE user_id = $1 AND role = 'user' "
            "AND created_at > now() - interval '1 minute'",
            user_id,
        )
    return count >= settings.assistant_rate_limit_per_min


@router.post("/conversations")
async def create_conversation(user: AuthUser = Depends(get_current_user)):
    """Crée TOUJOURS une nouvelle conversation (correction #15 review)."""
    async with scoped_connection(user["id"]) as conn:
        row = await conn.fetchrow(
            "INSERT INTO assistant_conversations (user_id) VALUES ($1) RETURNING id::text",
            user["id"],
        )
    payload = ConversationCreateResponse(conversation_id=row["id"])
    return {"data": payload.model_dump()}


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str, user: AuthUser = Depends(get_current_user)
):
    async with scoped_connection(user["id"]) as conn:
        exists = await conn.fetchval(
            "SELECT 1 FROM assistant_conversations WHERE id = $1::uuid AND user_id = $2",
            conversation_id, user["id"],
        )
        if not exists:
            raise not_found("Conversation introuvable.")
        rows = await conn.fetch(
            "SELECT role, contenu, actions FROM assistant_conversation_turns "
            "WHERE conversation_id = $1::uuid ORDER BY created_at ASC",
            conversation_id,
        )
    turns = [
        ConversationTurnResponse(
            role=r["role"],
            contenu=r["contenu"],
            actions=json.loads(r["actions"]) if r["actions"] else None,
        )
        for r in rows
    ]
    payload = ConversationDetailResponse(conversation_id=conversation_id, turns=turns)
    return {"data": payload.model_dump()}


@router.post("/message")
async def post_message(
    payload: AssistantMessageRequest, user: AuthUser = Depends(get_current_user)
):
    if await _rate_limited(user["id"]):
        raise too_many_requests("Trop de messages envoyés, réessaie dans une minute.")

    conversation_id = str(payload.conversation_id)
    turn_key = payload.turn_key or _derive_turn_key(conversation_id, payload.message)

    result = await run_assistant_message(
        user["id"], conversation_id, turn_key, payload.message, payload.context_ref
    )
    response = AssistantMessageResponse(**result)
    return {"data": response.model_dump()}
