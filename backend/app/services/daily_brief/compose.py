"""Rédaction du brief (Round 007) : tente `mail_triage.llm.complete_json`
(client LLM à dégradation gracieuse réutilisé — pas de réimplémentation),
**valide** le dict brut renvoyé avec `BriefContentModel` (correction #1
review : `complete_json` ne fait AUCUNE validation de schéma côté client),
applique le garde-fou anti-hallucination UNIQUEMENT sur ce chemin (correction
#6), puis bascule sur le brief dégradé déterministe (`degraded.py`) en cas
d'échec (clé absente, JSON invalide, schéma invalide) — brief dégradé =
CHEMIN NOMINAL ce round (aucune clé `ANTHROPIC_API_KEY` configurée).

Round 014 (F5) : le brief suit désormais l'ordre de lecture naturel (a)
rendez-vous du jour, (b) tâches du jour, (c) mails importants - défini UNE
SEULE fois par `degraded.BRIEF_BLOCK_ORDER` (source unique, cf. docstring de
`degraded.py`). Pour forcer le mode dégradé en test (sans clé IA réelle), il
suffit de laisser `settings.anthropic_api_key` vide/absent - c'est déjà ce
que fait la fixture autouse `_neutraliser_cle_llm` de `backend/tests/conftest.py`,
qui neutralise systématiquement la clé pour tous les tests (chemin nominal).
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel, Field

from app.services.daily_brief.degraded import (
    BRIEF_BLOCK_ORDER,
    build_degraded_brief,
    deterministic_priorities,
)
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
    # L'ordre de déclaration de ces 3 champs DOIT rester celui de
    # `BRIEF_BLOCK_ORDER` (garde-fou vérifié juste après la classe).
    schedule_summary: str = Field(max_length=400)
    tasks_summary: str = Field(max_length=280)
    mails_summary: str = Field(max_length=280)
    alerts: list[str] = Field(max_length=3)


# Garde-fou « source unique » (Round 014) : si `BriefContentModel` est un
# jour réordonné sans mettre à jour `degraded.BRIEF_BLOCK_ORDER` (ou
# inversement), le module refuse de s'importer plutôt que de laisser les
# deux chemins (IA / dégradé) diverger silencieusement.
_champs_ordonnes = tuple(
    champ for champ in BriefContentModel.model_fields if champ in BRIEF_BLOCK_ORDER
)
assert _champs_ordonnes == BRIEF_BLOCK_ORDER, (
    "BriefContentModel doit respecter l'ordre unique BRIEF_BLOCK_ORDER "
    "(degraded.py) - rendez-vous, tâches, mails."
)


def _build_system_prompt(tone: str, max_priorities: int) -> str:
    tone_line = _TONE_INSTRUCTIONS.get(tone, _TONE_INSTRUCTIONS["neutre"])
    return (
        "Tu rédiges le brief quotidien de MyDay, le cockpit personnel de "
        "l'utilisateur. Tu écris en français, à la deuxième personne (« tu »), "
        "au présent.\n\n"
        f"{tone_line}\n\n"
        "Règles (les 3 champs suivants doivent suivre l'ordre de lecture "
        "naturel de la journée - rendez-vous, puis tâches, puis mails) :\n"
        '- "headline" : 1 phrase d\'accroche (140 caractères max).\n'
        f'- "priorities" : les {max_priorities} actions les plus importantes '
        "MAINTENANT, formulées comme des actions concrètes, la plus urgente "
        "en premier. Croise les mails, les tâches et le planning.\n"
        '- "schedule_summary" : les rendez-vous d\'aujourd\'hui en 1 à 3 '
        "phrases ; si la liste est vide, dis exactement « Aucun rendez-vous "
        "aujourd'hui. ».\n"
        '- "tasks_summary" : l\'état des tâches dont l\'échéance tombe '
        "aujourd'hui en 1 à 2 phrases, signale les retards ; si la liste est "
        "vide, dis exactement « Rien d'urgent aujourd'hui. ».\n"
        '- "mails_summary" : parmi les 3 mails les plus importants reçus '
        "ces 5 derniers jours, ceux qui attendent une action, en 1 à 2 "
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
        "tasks_today": context["tasks_today"],
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
    titles |= {t["title"] for t in context["tasks_today"]}
    titles |= {m["subject"] for m in context["important_mails"] if m.get("subject")}
    return titles


def _dedupe_priorities(
    priorities: list[str], complement: list[str], max_priorities: int
) -> list[str]:
    """Supprime les priorités en double (le LLM peut répéter la même, et le
    garde-fou peut réinjecter `fallback[-1]` plusieurs fois), en préservant
    l'ordre. Complète ensuite avec des priorités déterministes distinctes tant
    qu'on n'a pas atteint `max_priorities`."""
    seen: set[str] = set()
    result: list[str] = []
    for source in (priorities, complement):
        for priority in source:
            cle = priority.strip().casefold()
            if cle and cle not in seen and len(result) < max_priorities:
                seen.add(cle)
                result.append(priority)
    return result


def _apply_anti_hallucination_guard(
    content: BriefContentModel, context: dict, max_priorities: int
) -> BriefContentModel:
    """Remplace toute priorité qui ne cite aucun élément connu du contexte par
    la règle déterministe équivalente (le LLM ne doit rien inventer), puis
    déduplique (le LLM peut répéter la même priorité)."""
    known = _known_titles(context)
    if not known:
        content.priorities = _dedupe_priorities(content.priorities, [], max_priorities)
        return content
    fallback = deterministic_priorities(context, max_priorities)
    fixed = []
    for i, priority in enumerate(content.priorities):
        if any(title in priority for title in known):
            fixed.append(priority)
        else:
            fixed.append(fallback[i] if i < len(fallback) else fallback[-1])
    content.priorities = _dedupe_priorities(fixed, fallback, max_priorities)
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
