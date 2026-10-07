"""`plan_actions` — interprète le message en plan d'actions JSON strict via
`complete_json` (dict brut, validé Pydantic ensuite - SOP
`agent-design-to-fastapi-service`). C'est le SEUL endroit qui décide quoi
faire ; toute la suite (`actions.py`, `orchestrator.py`) est un dispatch
Python déterministe.

Correction #6 (review Round 008) : les `action_key` ne sont PLUS générés par
le LLM (source d'instabilité/collision) - l'orchestrateur les dérive de
`turn_key + index`. Le plan ne transporte donc que `type` + `params`.

Correction #10 : les `params` sont validés PAR TYPE juste après le parsing
(voir `action_params.py`) ; une action invalide est écartée + signalée,
jamais de crash. Type inconnu -> ignoré (whitelist).
"""

from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from app.config import settings
from app.services.assistant.action_params import (
    ACTION_PARAM_MODELS,
    PARTIAL_ACTION_TYPES,
)
from app.services.assistant.plan_prompt import build_system_prompt, build_user_prompt
from app.services.mail_triage.llm import complete_json

logger = logging.getLogger("myday.assistant.plan")

_GENERIC_CLARIFICATION = "Je n'ai pas réussi à traiter ta demande, peux-tu reformuler ?"


class ActionPlanModel(BaseModel):
    intent: Literal["actions", "question", "clarification"]
    actions: list[dict] = Field(default_factory=list)
    clarification_question: str | None = None


def _validate_actions(raw_actions: list[dict], max_actions: int) -> tuple[list[dict], int]:
    valid: list[dict] = []
    discarded = 0
    for raw in raw_actions:
        if len(valid) >= max_actions:
            break
        # Tolérance : certains modèles renvoient la clé "action" au lieu de "type".
        atype = (raw.get("type") or raw.get("action")) if isinstance(raw, dict) else None
        # Filet de sécurité : le LLM peut renvoyer "draft_email" malgré le
        # retrait du prompt (retrait de l'intégration Google) - on l'écarte
        # comme un type inconnu, jamais de dispatch vers le mail.
        if atype == "draft_email" and not settings.assistant_mails_enabled:
            discarded += 1
            continue
        model = ACTION_PARAM_MODELS.get(atype)
        if model is None:
            discarded += 1
            continue
        try:
            params = model(**(raw.get("params") or {}))
        except ValidationError:
            discarded += 1
            continue
        # Modifications : seuls les champs envoyés comptent (absent = inchangé).
        dumped = params.model_dump(exclude_unset=atype in PARTIAL_ACTION_TYPES)
        valid.append({"type": atype, "params": dumped})
    return valid, discarded


async def plan_actions(
    user_id: str,
    message: str,
    history: list[dict],
    ref_data: dict,
    snapshot_text: str = "",
    pending_deletions: list[dict] | None = None,
) -> dict:
    system = build_system_prompt(
        settings.assistant_max_actions_per_message, settings.assistant_allow_email_send
    )
    user_prompt = build_user_prompt(
        message, history, ref_data, snapshot_text or "(non disponible)",
        pending_deletions or [],
    )

    try:
        raw = await complete_json(
            user_id=user_id,
            agent="assistant_plan",
            model=settings.assistant_llm_model,
            system=system,
            user_prompt=user_prompt,
            # Large : la réflexion du modèle compte dans ce plafond.
            max_tokens=16000,
            effort=settings.assistant_llm_effort,
        )
        parsed = ActionPlanModel(**raw)
    except Exception as exc:  # filet systématique (SOP) - jamais de crash
        logger.info("assistant plan_actions échec raison=%s", type(exc).__name__)
        return {
            "intent": "clarification",
            "actions": [],
            "clarification_question": _GENERIC_CLARIFICATION,
            "discarded_count": 0,
        }

    if parsed.intent == "clarification":
        return {
            "intent": "clarification",
            "actions": [],
            "clarification_question": parsed.clarification_question
            or "Peux-tu préciser ta demande ?",
            "discarded_count": 0,
        }

    valid_actions, discarded = _validate_actions(
        parsed.actions, settings.assistant_max_actions_per_message
    )
    if not valid_actions:
        return {
            "intent": "clarification",
            "actions": [],
            "clarification_question": "Je n'ai pas compris précisément ta demande, peux-tu préciser ?",
            "discarded_count": discarded,
        }
    return {
        "intent": parsed.intent,
        "actions": valid_actions,
        "clarification_question": None,
        "discarded_count": discarded,
    }
