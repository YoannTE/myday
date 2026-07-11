"""`compose_reply` — rédige la réponse du chat (confirmation des actions,
réponse à une question, ou clarification). Fallback template si le LLM
échoue ou renvoie une réponse vide/invalide (l'utilisateur est TOUJOURS
informé, jamais de crash - SOP `agent-design-to-fastapi-service`).
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel, Field

from app.config import settings
from app.services.mail_triage.llm import complete_json

logger = logging.getLogger("myday.assistant.reply")


class ReplyModel(BaseModel):
    reply: str = Field(min_length=1, max_length=1000)


def _build_system_prompt(tone: str) -> str:
    style = (
        "une ou deux phrases chaleureuses et simples"
        if tone == "naturel"
        else "une phrase factuelle"
    )
    return f"""Tu es l'assistant MyDay. Tu confirmes à l'utilisateur ce qui vient d'être fait, en français, à la deuxième personne.

Règles :
- Style {tone} : {style}.
- Confirme UNIQUEMENT les actions dont le résultat fourni indique ok=true. Une action en échec est signalée honnêtement.
- Pour une recherche (query_data), réponds à la question à partir des résultats fournis - si la liste est vide, dis que tu n'as rien trouvé. N'invente JAMAIS une donnée.
- Si un brouillon de mail est fourni, dis qu'il attend validation avant envoi.
- Pas de listes à puces pour une ou deux actions.

Réponds UNIQUEMENT avec le JSON {{"reply": "..."}}"""


def _build_user_prompt(plan: dict, action_results: list[dict], draft: dict | None) -> str:
    return (
        f"Plan : {json.dumps(plan, ensure_ascii=False)}\n"
        f"Résultats des actions : {json.dumps(action_results, ensure_ascii=False)}\n"
        f"Brouillon en attente : {json.dumps(draft, ensure_ascii=False) if draft else 'aucun'}"
    )


def _build_template_reply(
    plan: dict, action_results: list[dict], draft: dict | None
) -> str:
    if plan.get("intent") == "clarification":
        return plan.get("clarification_question") or "Peux-tu préciser ta demande ?"

    parts: list[str] = []
    for r in action_results:
        if r.get("ok"):
            label = r.get("label")
            if label:
                parts.append(f"{label}.")
        else:
            parts.append("Une action n'a pas pu être réalisée.")
    if draft:
        parts.append("Le brouillon de mail est prêt, valide-le pour l'envoyer.")
    if not parts:
        parts.append("C'est fait.")
    return " ".join(parts)[:1000]


async def compose_reply(
    user_id: str, plan: dict, action_results: list[dict], draft: dict | None, tone: str
) -> str:
    try:
        raw = await complete_json(
            user_id=user_id,
            agent="assistant_reply",
            model=settings.assistant_llm_model,
            system=_build_system_prompt(tone),
            user_prompt=_build_user_prompt(plan, action_results, draft),
            max_tokens=400,
        )
        parsed = ReplyModel(**raw)
        return parsed.reply.strip()
    except Exception as exc:  # filet systématique - jamais de crash côté chat
        logger.info("assistant compose_reply fallback raison=%s", type(exc).__name__)
        return _build_template_reply(plan, action_results, draft)
