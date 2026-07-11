"""Client LLM à dégradation gracieuse (Anthropic Messages API).

Clé absente (`settings.anthropic_api_key == ""`) -> le client Anthropic n'est
JAMAIS construit, `LlmUnavailable` est levée immédiatement (0 appel réseau).
Clé présente -> appel réel (pas de `response_format`, paramètre OpenAI qui
n'existe pas côté Anthropic - correction #9 review Round 006) : le JSON est
obtenu par consigne de prompt, avec 1 re-tentative en cas de réponse mal
formée. Les tokens consommés sont toujours enregistrés dans `llm_usage`
(le coût est estimé via une petite table de prix par modèle, sinon '0' -
jamais une valeur fabriquée - correction #10).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import settings
from app.db.client import scoped_connection

logger = logging.getLogger("myday.mail_triage.llm")

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _extract_json(text: str) -> Any:
    """Parse le JSON d'une réponse LLM même entourée de texte / fences ```json.

    Les modèles renvoient souvent le JSON dans un bloc markdown ou précédé
    d'une phrase. On tente : (1) le texte brut, (2) le contenu d'un bloc ```json,
    (3) la sous-chaîne du premier `{`/`[` au dernier `}`/`]`.
    """
    text = text.strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass
    fence = _FENCE_RE.search(text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except (json.JSONDecodeError, ValueError):
            pass
    for open_c, close_c in (("{", "}"), ("[", "]")):
        start, end = text.find(open_c), text.rfind(close_c)
        if 0 <= start < end:
            try:
                return json.loads(text[start : end + 1])
            except (json.JSONDecodeError, ValueError):
                continue
    raise ValueError("aucun JSON exploitable dans la réponse")

_RETRY_INSTRUCTION = (
    "\n\nTa réponse précédente était invalide. Réponds UNIQUEMENT avec le "
    "JSON demandé, sans aucun texte autour."
)

# Prix indicatifs USD par million de tokens (entrée, sortie). Modèle absent
# du barème -> coût non estimé (0), jamais fabriqué.
_PRICING_PER_MILLION: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-sonnet-4-5": (3.0, 15.0),
}


class LlmUnavailable(Exception):
    """Levée quand aucune clé Anthropic n'est configurée, ou en cas d'échec
    définitif d'un appel (JSON non parsable après re-tentative)."""


def _build_client():
    if not settings.anthropic_api_key:
        raise LlmUnavailable("ANTHROPIC_API_KEY absente")
    from anthropic import AsyncAnthropic

    return AsyncAnthropic(api_key=settings.anthropic_api_key)


def _estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> str:
    pricing = _PRICING_PER_MILLION.get(model)
    if pricing is None:
        return "0"
    in_price, out_price = pricing
    cost = (prompt_tokens / 1_000_000) * in_price
    cost += (completion_tokens / 1_000_000) * out_price
    return f"{cost:.6f}"


async def _record_usage(
    user_id: str, agent: str, model: str, prompt_tokens: int, completion_tokens: int
) -> None:
    async with scoped_connection(user_id) as conn:
        await conn.execute(
            """
            INSERT INTO llm_usage
                (user_id, agent, model, prompt_tokens, completion_tokens, cost_usd)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            user_id, agent, model, prompt_tokens, completion_tokens,
            _estimate_cost(model, prompt_tokens, completion_tokens),
        )


async def complete_json(
    *,
    user_id: str,
    agent: str,
    model: str,
    system: str,
    user_prompt: str,
    max_tokens: int = 2000,
) -> dict[str, Any]:
    """Appelle Anthropic Messages API et parse un JSON strict.

    1 re-tentative avec consigne de format renforcée si la première réponse
    n'est pas un JSON valide. Lève `LlmUnavailable` si la clé est absente ou
    si les 2 tentatives échouent. Enregistre l'usage tokens même en cas
    d'échec final de parsing (l'appel a bien consommé des tokens).
    """
    client = _build_client()  # lève LlmUnavailable si clé absente (0 appel réseau)
    prompt_tokens = completion_tokens = 0
    try:
        for attempt in range(2):
            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system if attempt == 0 else system + _RETRY_INSTRUCTION,
                messages=[{"role": "user", "content": user_prompt}],
            )
            usage = getattr(response, "usage", None)
            prompt_tokens += getattr(usage, "input_tokens", 0) or 0
            completion_tokens += getattr(usage, "output_tokens", 0) or 0
            text = "".join(
                block.text
                for block in response.content
                if getattr(block, "type", None) == "text"
            )
            try:
                return _extract_json(text)
            except (json.JSONDecodeError, ValueError):
                logger.warning(
                    "llm réponse non parsable (tentative %s)", attempt + 1
                )
        raise LlmUnavailable("Réponse LLM non parsable après re-tentative")
    finally:
        if prompt_tokens or completion_tokens:
            await _record_usage(user_id, agent, model, prompt_tokens, completion_tokens)
