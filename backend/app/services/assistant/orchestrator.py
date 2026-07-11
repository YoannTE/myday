"""`run_assistant_message` — point d'entrée unique de l'assistant
conversationnel (service FastAPI normal, PAS de plateforme Core - SOP
`agent-design-to-fastapi-service`). Séquence :

    dédup (conversation_id, turn_key) EN TÊTE -> load_context -> plan_actions
    -> (clarification -> reply -> persist, fin) OU boucle actions (max
    `assistant_max_actions_per_message`, dispatch local + import BACK-MAIL)
    -> compose_reply -> persist_turn

Correction #6 (review) : la dédup est vérifiée AVANT tout appel LLM/action -
un double message identique (même `turn_key`) ne ré-exécute JAMAIS rien, le
résultat stocké est simplement renvoyé. Les `action_key` sont dérivés de
`turn_key + index` (stables), jamais un UUID généré par le LLM.
"""

from __future__ import annotations

import logging

from app.config import settings
from app.services.assistant import persist
from app.services.assistant.actions import create_note, create_task, query_data
from app.services.assistant.context import load_context
from app.services.assistant.plan import plan_actions
from app.services.assistant.reply import compose_reply

logger = logging.getLogger("myday.assistant.orchestrator")

# Contrat d'import figé (plan Round 008, coordination BACK-MAIL) : import
# tolérant le temps de la convergence des 2 agents backend (même pattern que
# les routers optionnels de `main.py`) - le lead vérifie ensuite que les 2
# imports réussissent et retire ce garde-fou si besoin.
try:
    from app.services.assistant.tools_event import create_event_action
except ImportError:  # pragma: no cover - convergence BACK-MAIL en cours
    create_event_action = None  # type: ignore[assignment]

try:
    from app.services.assistant.draft import draft_email
except ImportError:  # pragma: no cover - convergence BACK-MAIL en cours
    draft_email = None  # type: ignore[assignment]


async def _dispatch(
    user_id: str, action_key: str, atype: str, params: dict, ref_data: dict
) -> dict:
    if atype == "create_task":
        return await create_task(user_id, action_key, params)
    if atype == "create_note":
        return await create_note(user_id, action_key, params)
    if atype == "query_data":
        return await query_data(user_id, params)
    if atype == "create_event":
        if create_event_action is None:
            raise RuntimeError("create_event_action indisponible")
        return await create_event_action(user_id, params, action_key)
    if atype == "draft_email":
        if draft_email is None:
            raise RuntimeError("draft_email indisponible")
        return await draft_email(user_id, params, ref_data, action_key)
    raise RuntimeError(f"Type d'action inconnu : {atype}")


async def run_assistant_message(
    user_id: str,
    conversation_id: str,
    turn_key: str,
    message: str,
    context_ref: dict | None,
) -> dict:
    existing = await persist.get_existing_turn(user_id, conversation_id, turn_key)
    if existing is not None:
        return existing

    ctx = await load_context(user_id, conversation_id, context_ref)
    plan = await plan_actions(user_id, message, ctx["history"], ctx["ref_data"])

    if plan["intent"] == "clarification":
        reply = await compose_reply(user_id, plan, [], None, settings.assistant_reply_tone)
        result = {
            "reply": reply, "actions_done": [], "draft": None, "clarification_needed": True,
        }
        await persist.persist_turn(user_id, conversation_id, turn_key, message, result)
        return result

    action_results: list[dict] = []
    draft: dict | None = None
    max_actions = settings.assistant_max_actions_per_message
    for index, action in enumerate(plan["actions"][:max_actions]):
        action_key = f"{turn_key}:{index}"
        atype = action["type"]
        try:
            r = await _dispatch(user_id, action_key, atype, action["params"], ctx["ref_data"])
        except Exception as exc:
            logger.info("assistant action échouée type=%s raison=%s", atype, type(exc).__name__)
            r = {"type": atype, "ok": False, "label": "Cette action n'a pas pu être réalisée."}
        if atype == "draft_email" and r.get("ok", True):
            draft = r
        action_results.append(r)

    reply = await compose_reply(
        user_id, plan, action_results, draft, settings.assistant_reply_tone
    )
    result = {
        "reply": reply,
        "actions_done": action_results,
        "draft": draft,
        "clarification_needed": False,
    }
    await persist.persist_turn(user_id, conversation_id, turn_key, message, result)
    return result
