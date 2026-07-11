"""Orchestrateur du brief quotidien (Round 007) — service FastAPI normal, PAS
de plateforme Core. Séquence stricte, une `scoped_connection` par étape (pas
d'imbrication — correction #7 review) :

    load_preferences -> collect_context -> compute_alerts -> compose_brief
    -> persist_brief

`brief_date` est toujours fourni par l'appelant (endpoint ou scheduler),
jamais calculé ici (déterminisme). PII (contenu du brief/mails/évènements)
jamais dans les logs — uniquement des compteurs/booléens.
"""

from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings
from app.db.client import scoped_connection
from app.services.daily_brief.alerts import compute_deterministic_alerts
from app.services.daily_brief.compose import compose_brief
from app.services.daily_brief.context import collect_context
from app.services.daily_brief.persist import persist_brief

logger = logging.getLogger("myday.daily_brief.orchestrator")


async def _load_preferences(user_id: str) -> dict:
    """Ton et fuseau viennent de `user_preferences` (correction #9) — jamais
    de config.py pour le ton, qui est per-utilisateur."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "SELECT brief_tone, timezone FROM user_preferences WHERE user_id = $1",
            user_id,
        )
    if row is None:
        return {"brief_tone": "neutre", "timezone": settings.app_timezone}
    return {"brief_tone": row["brief_tone"], "timezone": row["timezone"]}


async def run_daily_brief(user_id: str, trigger: str, brief_date: str) -> dict:
    prefs = await _load_preferences(user_id)
    timezone_str = prefs["timezone"]

    context = await collect_context(
        user_id,
        brief_date,
        timezone_str,
        settings.brief_include_mails,
        settings.brief_lookahead_tomorrow,
        settings.triage_importance_threshold,
    )

    now = datetime.now(ZoneInfo(timezone_str))
    alerts = compute_deterministic_alerts(context, now)

    content, degraded = await compose_brief(
        user_id=user_id,
        brief_date=brief_date,
        context=context,
        alerts=alerts,
        tone=prefs["brief_tone"],
        model=settings.brief_llm_model,
        max_priorities=settings.brief_max_priorities,
    )

    brief_id = await persist_brief(user_id, brief_date, trigger, content, degraded)

    logger.info(
        "daily_brief user_id=%s trigger=%s brief_date=%s degraded=%s",
        user_id, trigger, brief_date, degraded,
    )
    return {"brief_id": brief_id, "generated": True, "degraded": degraded}
