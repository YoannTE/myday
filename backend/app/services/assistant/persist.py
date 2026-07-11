"""Persistance du tour de conversation. Idempotent par `(conversation_id,
turn_key)` (contrainte d'unicité posée par postgres-developer).

La table `assistant_conversation_turns` a une seule ligne par
`(conversation_id, turn_key)` : un tour = 2 messages (user + assistant), donc
2 suffixes internes distincts sur le `turn_key` physique pour respecter la
contrainte tout en gardant un seul `turn_key` logique côté API/orchestrateur.
`get_existing_turn` sert la dédup EN TÊTE de `run_assistant_message`
(correction #6 review) : si la ligne assistant existe déjà, le résultat
stocké est renvoyé tel quel, aucune ré-exécution.
"""

from __future__ import annotations

import json

from app.db.client import scoped_connection

_USER_SUFFIX = ":user"
_ASSISTANT_SUFFIX = ":assistant"


async def get_existing_turn(user_id: str, conversation_id: str, turn_key: str) -> dict | None:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "SELECT contenu, actions FROM assistant_conversation_turns "
            "WHERE conversation_id = $1::uuid AND turn_key = $2 AND role = 'assistant'",
            conversation_id, turn_key + _ASSISTANT_SUFFIX,
        )
    if row is None:
        return None
    stored = json.loads(row["actions"]) if row["actions"] else {}
    return {
        "reply": row["contenu"],
        "actions_done": stored.get("actions_done", []),
        "draft": stored.get("draft"),
        "clarification_needed": stored.get("clarification_needed", False),
    }


async def persist_turn(
    user_id: str, conversation_id: str, turn_key: str, user_msg: str, result: dict
) -> None:
    stored = {
        "actions_done": result["actions_done"],
        "draft": result["draft"],
        "clarification_needed": result["clarification_needed"],
    }
    stored_json = json.dumps(stored)

    async with scoped_connection(user_id) as conn:
        await conn.execute(
            "INSERT INTO assistant_conversation_turns "
            "(conversation_id, user_id, turn_key, role, contenu) "
            "VALUES ($1::uuid, $2, $3, 'user', $4) "
            "ON CONFLICT (conversation_id, turn_key) DO NOTHING",
            conversation_id, user_id, turn_key + _USER_SUFFIX, user_msg,
        )
        await conn.execute(
            "INSERT INTO assistant_conversation_turns "
            "(conversation_id, user_id, turn_key, role, contenu, actions) "
            "VALUES ($1::uuid, $2, $3, 'assistant', $4, $5::jsonb) "
            "ON CONFLICT (conversation_id, turn_key) DO NOTHING",
            conversation_id, user_id, turn_key + _ASSISTANT_SUFFIX,
            result["reply"], stored_json,
        )
        await conn.execute(
            "UPDATE assistant_conversations SET updated_at = now() WHERE id = $1::uuid",
            conversation_id,
        )
        await conn.execute(
            "INSERT INTO usage_events (user_id, type) VALUES ($1, 'assistant_message_sent')",
            user_id,
        )
