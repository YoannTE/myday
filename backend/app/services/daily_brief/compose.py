"""Rédaction du brief (Round 007) : tente `mail_triage.llm.complete_json`
(client LLM à dégradation gracieuse réutilisé — pas de réimplémentation),
**valide** le dict brut renvoyé avec `BriefContentModel` (correction #1
review : `complete_json` ne fait AUCUNE validation de schéma côté client),
applique le garde-fou anti-hallucination UNIQUEMENT sur ce chemin (correction
#6), puis bascule sur le brief dégradé déterministe (`degraded.py`) en cas
d'échec (clé absente, JSON invalide, schéma invalide) — brief dégradé =
CHEMIN NOMINAL ce round (aucune clé `ANTHROPIC_API_KEY` configurée).
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel, Field

from app.services.daily_brief.degraded import build_degraded_brief, deterministic_priorities
from app.services.mail_triage.llm import complete_json

logger = logging.getLogger("myday.daily_brief.compose")

_TONE_INSTRUCTIONS = {
    "neutre": "- neutre : factuel et posé, sans exclamation.",
    "motivant": "- motivant : énergique et positif, sans être artificiel.",
    "direct": "- direct : phrases courtes, droit au but.",
}


class BriefContentModel(BaseModel):
    headline: str = Field(max_length=140)
    priorities: list[str] = Field(min_length=1, max_length=5)
    schedule_summary: str = Field(max_length=400)
    tasks_summary: str = Field(max_length=280)
    mails_summary: str = Field(max_length=280)
    alerts: list[str] = Field(max_length=3)


def _build_system_prompt(tone: str, max_priorities: int) -> str:
    tone_line = _TONE_INSTRUCTIONS.get(tone, _TONE_INSTRUCTIONS["neutre"])
    return (
        "Tu rédiges le brief quotidien de MyDay, le cockpit personnel de "
        "l'utilisateur. Tu écris en français, à la deuxième personne (« tu »), "
        "au présent.\n\n"
        f"{tone_line}\n\n"
        "Règles :\n"
        '- "headline" : 1 phrase d\'accroche (140 caractères max).\n'
        f'- "priorities" : les {max_priorities} actions les plus importantes '
        "MAINTENANT, formulées comme des actions concrètes, la plus urgente "
        "en premier. Croise les mails, les tâches et le planning.\n"
        '- "schedule_summary" : le déroulé du jour en 1 à 3 phrases.\n'
        '- "tasks_summary" : l\'état des tâches en 1 à 2 phrases, signale '
        "les retards.\n"
        '- "mails_summary" : les mails qui attendent une action en 1 à 2 '
        "phrases ; si la liste est vide, dis que rien n'attend de réponse.\n"
        '- "alerts" : recopie les alertes fournies, reformulées naturellement, '
        "sans en inventer.\n"
        "- Si toutes les listes sont vides, produis un brief « journée "
        "calme » qui le dit simplement.\n"
        "- N'invente JAMAIS un événement, une tâche ou un mail absent des "
        "données.\n\n"
        "Réponds UNIQUEMENT avec le JSON demandé, sans texte autour."
    )


def _build_user_prompt(brief_date: str, context: dict, alerts: list[str]) -> str:
    payload = {
        "events": context["events"],
        "tomorrow_morning": context.get("tomorrow_morning", []),
        "tasks_due": context["tasks_due"],
        "important_mails": context["important_mails"],
        "alerts": alerts,
    }
    return (
        f"Brief du {brief_date} à générer. Données du cockpit au format JSON :\n\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )


def _known_titles(context: dict) -> set[str]:
    titles = {e["title"] for e in context["events"]}
    titles |= {e["title"] for e in context.get("tomorrow_morning", [])}
    titles |= {t["title"] for t in context["tasks_due"]}
    titles |= {m["subject"] for m in context["important_mails"] if m.get("subject")}
    return titles


def _apply_anti_hallucination_guard(
    content: BriefContentModel, context: dict, max_priorities: int
) -> BriefContentModel:
    """Remplace toute priorité qui ne cite aucun élément connu du contexte par
    la règle déterministe équivalente (le LLM ne doit rien inventer)."""
    known = _known_titles(context)
    if not known:
        return content
    fallback = deterministic_priorities(context, max_priorities)
    fixed = []
    for i, priority in enumerate(content.priorities):
        if any(title in priority for title in known):
            fixed.append(priority)
        else:
            fixed.append(fallback[i] if i < len(fallback) else fallback[-1])
    content.priorities = fixed
    return content


async def compose_brief(
    *,
    user_id: str,
    brief_date: str,
    context: dict,
    alerts: list[str],
    tone: str,
    model: str,
    max_priorities: int,
) -> tuple[dict, bool]:
    """Retourne `(content, degraded)`. Ne re-tente JAMAIS ici : `complete_json`
    fait déjà 1 re-tentative interne (correction #1)."""
    try:
        raw = await complete_json(
            user_id=user_id,
            agent="daily_brief",
            model=model,
            system=_build_system_prompt(tone, max_priorities),
            user_prompt=_build_user_prompt(brief_date, context, alerts),
        )
        parsed = BriefContentModel(**raw)
        parsed = _apply_anti_hallucination_guard(parsed, context, max_priorities)
        return parsed.model_dump(), False
    except Exception as exc:
        # Filet de sécurité systématique : TOUTE défaillance du chemin LLM
        # (clé absente, JSON/schéma invalide, ET erreurs Anthropic réseau/API/
        # rate-limit une fois l'IA activée) bascule sur le brief dégradé. On ne
        # loggue que le nom de l'exception, jamais de contenu (PII).
        logger.info(
            "daily_brief compose dégradé user_id=%s raison=%s",
            user_id, type(exc).__name__,
        )
        return build_degraded_brief(context, alerts, max_priorities), True
