"""Résumés IA des mails importants (score >= seuil), sur `extrait` uniquement
(pas de corps complet Gmail dans ce projet - correction #8 review Round 006).

Clé absente ou échec -> pas de résumé : le mail s'affiche avec l'extrait brut
(comportement normal du fallback, pas une erreur).
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel, ValidationError

from app.services.mail_triage.llm import LlmUnavailable, complete_json

logger = logging.getLogger("myday.mail_triage.summaries")

_SYSTEM_PROMPT = """Tu résumes des mails pour le dashboard personnel MyDay. Pour chaque mail fourni, écris un résumé de 1 à 2 phrases en français, au présent, factuel : qui demande quoi, et pour quand si une échéance existe. Pas de formule de politesse, pas de mise en forme, pas d'opinion. 220 caractères maximum par résumé.

Réponds UNIQUEMENT avec le JSON demandé. Chaque mail_id reçu doit apparaître exactement une fois dans "results"."""

_MAX_LEN = 220


class MailSummary(BaseModel):
    mail_id: str
    summary: str


class SummaryBatch(BaseModel):
    results: list[MailSummary]


def _truncate(text: str) -> str:
    if len(text) <= _MAX_LEN:
        return text
    return text[: _MAX_LEN - 3] + "..."


def _build_user_prompt(mails: list[dict]) -> str:
    payload = [
        {
            "mail_id": m["mail_id"],
            "from": m.get("expediteur", ""),
            "subject": m.get("sujet") or "",
            "extrait": (m.get("extrait") or "")[:1000],
        }
        for m in mails
    ]
    header = f"Voici {len(payload)} mails importants à résumer, au format JSON :\n\n"
    return header + json.dumps({"mails": payload}, ensure_ascii=False)


async def summarize_important(user_id: str, important: list[dict], model: str) -> dict:
    """Retourne `{mail_id: résumé}`. Aucun appel LLM si `important` est vide."""
    if not important:
        return {}
    try:
        raw = await complete_json(
            user_id=user_id,
            agent="mail_triage_summary",
            model=model,
            system=_SYSTEM_PROMPT,
            user_prompt=_build_user_prompt(important),
        )
        parsed = SummaryBatch.model_validate(raw)
        return {r.mail_id: _truncate(r.summary) for r in parsed.results}
    except (LlmUnavailable, ValidationError) as exc:
        logger.info("mail_triage summarize fallback (%s)", type(exc).__name__)
        return {}
