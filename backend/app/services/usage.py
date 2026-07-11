"""Logique métier du journal d'usage (`usage_events`).

Écriture via `scoped_connection(user_id)` (RLS). `task_completed` est refusé
ici : il est inséré exclusivement par `app.services.tasks.update_task` dans la
même transaction que le passage atomique du statut à `faite`.
"""

import json

from app.db.client import scoped_connection
from app.models.usage import USAGE_EVENT_TYPES, UsageEventCreate
from app.utils.errors import bad_request


async def create_usage_event(user_id: str, payload: UsageEventCreate) -> dict:
    if payload.type not in USAGE_EVENT_TYPES:
        raise bad_request("Type d'évènement invalide.")
    if payload.type == "task_completed":
        raise bad_request(
            "task_completed est réservé au serveur (émis automatiquement)."
        )

    metadata_json = json.dumps(payload.metadata) if payload.metadata is not None else None
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO usage_events (user_id, type, metadata)
            VALUES ($1, $2, $3::jsonb)
            RETURNING id
            """,
            user_id,
            payload.type,
            metadata_json,
        )
    return {"id": str(row["id"])}
