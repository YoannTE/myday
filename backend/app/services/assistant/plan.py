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
from app.services.assistant.action_params import ACTION_PARAM_MODELS
from app.services.mail_triage.llm import complete_json

logger = logging.getLogger("myday.assistant.plan")

_GENERIC_CLARIFICATION = "Je n'ai pas réussi à traiter ta demande, peux-tu reformuler ?"


class ActionPlanModel(BaseModel):
    intent: Literal["actions", "question", "clarification"]
    actions: list[dict] = Field(default_factory=list)
    clarification_question: str | None = None


def _build_system_prompt(max_actions: int, allow_email_send: bool) -> str:
    email_note = (
        ""
        if allow_email_send
        else (
            "\nNote : l'envoi de mails est désactivé - les brouillons seront "
            "préparés mais non envoyés, dis-le si un mail est demandé."
        )
    )
    return f"""Tu es le planificateur de l'assistant MyDay, le cockpit personnel de l'utilisateur. Tu transformes son message en plan d'actions JSON. Tu ne réponds JAMAIS en texte libre.

Chaque action est un objet {{"type": "<nom_action>", "params": {{...}}}} — la clé est TOUJOURS "type".

Actions disponibles :
- "create_task" : params {{"title": str, "priority": "haute"|"normale"|"basse", "due": "YYYY-MM-DD" | null}}
- "create_note" : params {{"note_title": str, "content_to_add": str}} - pour ajouter à une note existante (ex. liste de courses), reprends son titre exact s'il apparaît dans l'historique
- "create_event" : params {{"title": str, "start": "YYYY-MM-DDTHH:MM", "end": "YYYY-MM-DDTHH:MM", "location": str | null}} - durée par défaut 1h si non précisée
- "query_data" : params {{"entity": "events"|"tasks"|"notes"|"mails", "question": str}} - pour répondre à une question sur ses données
- "draft_email" : params {{"to": str | null, "subject": str | null, "instruction": str, "reply_to_ref": true|false}} - reply_to_ref=true si l'utilisateur répond au mail fourni en référence

Règles :
- "intent" : "actions" si au moins une action, "question" si uniquement query_data, "clarification" si la demande est ambiguë (destinataire inconnu, date impossible à déduire, action floue).
- Maximum {max_actions} actions par message. Si l'utilisateur en demande plus, garde les premières.
- Les dates relatives ("vendredi", "demain") se résolvent avec la date du jour fournie. Ne devine JAMAIS une date ambiguë : demande une clarification.
- N'invente JAMAIS un destinataire de mail : s'il n'est ni dans le message, ni dans le mail de référence, ni dans l'historique -> clarification.
- En cas de clarification : "actions": [] et "clarification_question" en français, une seule question précise.{email_note}
- Ne mets JAMAIS de champ "action_key" dans les actions.

Réponds UNIQUEMENT avec le JSON demandé, exemple : {{"intent": "actions", "actions": [{{"type": "create_task", "params": {{"title": "...", "priority": "normale", "due": null}}}}], "clarification_question": null}}"""


def _build_user_prompt(message: str, history: list[dict], ref_data: dict) -> str:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from app.config import settings

    maintenant = datetime.now(ZoneInfo(settings.app_timezone))
    date_jour = maintenant.strftime("%A %d %B %Y, %Hh%M")
    history_formatted = "\n".join(
        f"- {h['role']} : {h['content']}" for h in history
    ) or "(aucun)"
    ref_block = ""
    mail = ref_data.get("mail")
    if mail:
        ref_block = (
            f"\nMail en référence : de {mail.get('expediteur')}, objet "
            f"« {mail.get('sujet')} », extrait : {mail.get('extrait')}"
        )
    return (
        f"Date et heure actuelles : {date_jour} (format ISO : {maintenant.isoformat()}).\n"
        f"Utilise cette date pour résoudre les dates relatives (« vendredi », « demain »).\n"
        f"Historique récent de la conversation :\n{history_formatted}\n"
        f"{ref_block}\n\nMessage de l'utilisateur : {message}"
    )


def _validate_actions(raw_actions: list[dict], max_actions: int) -> tuple[list[dict], int]:
    valid: list[dict] = []
    discarded = 0
    for raw in raw_actions:
        if len(valid) >= max_actions:
            break
        # Tolérance : certains modèles renvoient la clé "action" au lieu de "type".
        atype = (raw.get("type") or raw.get("action")) if isinstance(raw, dict) else None
        model = ACTION_PARAM_MODELS.get(atype)
        if model is None:
            discarded += 1
            continue
        try:
            params = model(**(raw.get("params") or {}))
        except ValidationError:
            discarded += 1
            continue
        valid.append({"type": atype, "params": params.model_dump()})
    return valid, discarded


async def plan_actions(
    user_id: str, message: str, history: list[dict], ref_data: dict
) -> dict:
    system = _build_system_prompt(
        settings.assistant_max_actions_per_message, settings.assistant_allow_email_send
    )
    user_prompt = _build_user_prompt(message, history, ref_data)

    try:
        raw = await complete_json(
            user_id=user_id,
            agent="assistant_plan",
            model=settings.assistant_llm_model,
            system=system,
            user_prompt=user_prompt,
            max_tokens=1200,
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
