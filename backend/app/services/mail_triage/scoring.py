"""Scoring des candidats retenus par le pré-filtre.

Un seul appel LLM par lot (plafonné à `max_llm_mails_per_run`, les candidats
au-delà restent `deferred`). Clé absente ou échec -> fallback heuristique :
`known_sender -> 65`, `action_keywords -> 70`, sinon `40`, `source="fallback"`,
raison « Score automatique (règles) ».

Prompts transposés SANS `to_type` ni corps de mail (correction #8 review
Round 006) : source de contenu = `sujet` + `extrait` uniquement.
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel, Field, ValidationError

from app.services.mail_triage.llm import LlmUnavailable, complete_json

logger = logging.getLogger("myday.mail_triage.scoring")

_SYSTEM_PROMPT = """Tu es le moteur de tri des mails de MyDay, un cockpit personnel. Tu évalues l'importance de chaque mail pour son destinataire.

Pour chaque mail fourni, attribue :
- "score" : un entier de 0 à 100
- "reason" : une raison courte en français (12 mots maximum)

Barème :
- 80-100 : demande d'action urgente, échéance proche, expéditeur humain qui attend une réponse
- 60-79 : demande de réponse ou d'action sans urgence, information personnelle importante
- 30-59 : information utile sans action attendue
- 0-29 : notification automatique, publicité, contenu promotionnel

Signaux fournis avec chaque mail : known_sender (expéditeur déjà vu récemment), action_keywords (mots d'action détectés dans le sujet et l'extrait).

Réponds UNIQUEMENT avec le JSON demandé, sans aucun texte autour. Chaque mail_id reçu doit apparaître exactement une fois dans "results"."""


class MailScore(BaseModel):
    mail_id: str
    score: int = Field(ge=0, le=100)
    reason: str = Field(max_length=120)


class ScoreBatch(BaseModel):
    results: list[MailScore]


def _fallback_score(candidate: dict) -> dict:
    if candidate.get("known_sender"):
        score = 65
    elif candidate.get("action_keywords"):
        score = 70
    else:
        score = 40
    return {
        "mail_id": candidate["mail_id"],
        "score": score,
        "reason": "Score automatique (règles)",
        "source": "fallback",
    }


def _build_user_prompt(batch: list[dict]) -> str:
    mails = [
        {
            "mail_id": c["mail_id"],
            "from": c.get("expediteur", ""),
            "subject": c.get("sujet") or "",
            "snippet": (c.get("extrait") or "")[:200],
            "known_sender": bool(c.get("known_sender")),
            "action_keywords": c.get("action_keywords", []),
        }
        for c in batch
    ]
    header = f"Voici {len(mails)} mails à évaluer, au format JSON :\n\n"
    return header + json.dumps({"mails": mails}, ensure_ascii=False)


async def score_candidates(
    user_id: str, candidates: list[dict], model: str, max_llm_mails: int
) -> dict:
    """Retourne `{"scored": [ScoredMail], "deferred": [mail_id], "llm_calls": int}`."""
    if not candidates:
        return {"scored": [], "deferred": [], "llm_calls": 0}

    batch = candidates[:max_llm_mails]
    deferred = [c["mail_id"] for c in candidates[max_llm_mails:]]

    try:
        raw = await complete_json(
            user_id=user_id,
            agent="mail_triage_score",
            model=model,
            system=_SYSTEM_PROMPT,
            user_prompt=_build_user_prompt(batch),
        )
        parsed = ScoreBatch.model_validate(raw)
        by_id = {r.mail_id: r for r in parsed.results}
        scored = [
            {
                "mail_id": c["mail_id"],
                "score": by_id[c["mail_id"]].score,
                "reason": by_id[c["mail_id"]].reason,
                "source": "llm",
            }
            if c["mail_id"] in by_id
            else _fallback_score(c)
            for c in batch
        ]
        return {"scored": scored, "deferred": deferred, "llm_calls": 1}
    except (LlmUnavailable, ValidationError, KeyError) as exc:
        logger.info("mail_triage score_mails fallback (%s)", type(exc).__name__)
        return {
            "scored": [_fallback_score(c) for c in batch],
            "deferred": deferred,
            "llm_calls": 0,
        }
