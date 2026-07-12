"""Outil assistant : création d'un événement (délègue au socle events R004).

Contrat d'import figé (plan Round 008, coordination BACK-CONV) :
`create_event_action(user_id, params, action_key)` est importé directement par
`app.services.assistant.orchestrator`. `params` arrive déjà validé par
`action_params.EventParams` (BACK-CONV) : clés `title`, `start`, `end`,
`location` (mêmes noms que le schéma envoyé au LLM). On revalide ici en
défense en profondeur (appel direct/tests) avec le même schéma.

Idempotence best-effort par `client_uuid` dérivé de `action_key` (la table
`events` n'a pas d'unique sur une clé d'action - aucune migration ce round) :
SELECT avant INSERT. Race négligeable en usage séquentiel (un seul message
traité à la fois par utilisateur - correction #7 review Round 008).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ValidationError

from app.config import settings
from app.db.client import scoped_connection
from app.models.events import EventCreate
from app.services.events import create_event
from app.utils.errors import bad_request


class EventParams(BaseModel):
    title: str
    start: str
    end: str
    location: str | None = None
    # Informations complémentaires de l'utilisateur, reportées dans la
    # description de l'événement (contexte, personnes, ordre du jour, etc.).
    description: str | None = None


def _parse_local_datetime(value: str) -> datetime:
    """Parse une date/heure ISO ; si naïve, l'ancre au fuseau applicatif."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo(settings.app_timezone))
    return parsed


def _client_uuid_for(action_key: str) -> str:
    """Clé d'idempotence déterministe dérivée de l'`action_key` (turn_key:index)."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"myday-assistant-event:{action_key}"))


async def create_event_action(user_id: str, params: dict, action_key: str) -> dict:
    """Crée l'événement demandé par l'assistant (idempotent par `action_key`).

    Toute exception levée ici (params invalides, dates incohérentes) est
    catchée par l'orchestrateur (`except Exception` autour du dispatch) qui
    écarte proprement l'action - jamais de crash du message entier.
    """
    try:
        validated = EventParams.model_validate(params)
        debut = _parse_local_datetime(validated.start)
        fin = _parse_local_datetime(validated.end)
    except (ValidationError, ValueError) as exc:
        raise bad_request("Paramètres d'événement invalides.") from exc

    client_uuid = _client_uuid_for(action_key)

    async with scoped_connection(user_id) as conn:
        existing = await conn.fetchrow(
            "SELECT id::text, titre FROM events WHERE user_id = $1 AND client_uuid = $2",
            user_id, client_uuid,
        )
    if existing is not None:
        return {
            "type": "create_event",
            "ok": True,
            "event_id": existing["id"],
            "label": f"Événement « {existing['titre']} » ajouté au planning",
        }

    payload = EventCreate(
        titre=validated.title,
        debut=debut,
        fin=fin,
        lieu=validated.location,
        description=validated.description,
    )
    event = await create_event(user_id, payload)

    # Pose la clé d'idempotence APRÈS coup (best-effort) : sans impact sur un
    # éventuel push Google déjà effectué en synchrone dans `create_event`
    # (sync_status='synced' -> plus aucun push ne relira cette colonne pour
    # cet événement).
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            "UPDATE events SET client_uuid = $1 WHERE id = $2::uuid AND user_id = $3",
            client_uuid, event["id"], user_id,
        )

    return {
        "type": "create_event",
        "ok": True,
        "event_id": event["id"],
        "label": f"Événement « {validated.title} » ajouté au planning",
    }
