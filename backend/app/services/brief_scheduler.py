"""Scheduler du brief quotidien (Round 007), calqué sur `google/scheduler.py`.

Chaque tick (~5 min) : liste les utilisateurs ayant terminé l'onboarding
(`onboarding_completed = true`), calcule l'heure locale via leur `timezone`,
et déclenche un brief `scheduled` si `heure_locale >= brief_hour` ET qu'aucun
brief `quotidien` n'existe déjà pour la date locale (idempotent, rattrapage
inclus après un redémarrage). Chaque run utilisateur est isolé (try/except)
et borné par un timeout (`brief_run_timeout`) — un échec n'interrompt jamais
la boucle des autres utilisateurs.

La liste des utilisateurs à évaluer est une lecture cross-tenant légitime
(uniquement `user_id`/`brief_hour`/`timezone`, aucun contenu) : elle passe
par le pool admin, comme pour le scheduler Google.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.db.client import get_admin_pool
from app.services.daily_brief.orchestrator import run_daily_brief

logger = logging.getLogger("myday.daily_brief.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _list_onboarded_users() -> list[dict]:
    pool = get_admin_pool()
    rows = await pool.fetch(
        "SELECT user_id, brief_hour, timezone FROM user_preferences "
        "WHERE onboarding_completed = true"
    )
    return [dict(r) for r in rows]


async def _already_generated_today(user_id: str, brief_date: str) -> bool:
    pool = get_admin_pool()
    return bool(
        await pool.fetchval(
            "SELECT 1 FROM briefs WHERE user_id = $1 AND brief_date = $2 "
            "AND type = 'quotidien'",
            user_id, date.fromisoformat(brief_date),
        )
    )


def _due_now(brief_hour: str, timezone_str: str) -> tuple[bool, str]:
    """`(du, date_locale)` : vrai si l'heure locale a dépassé `brief_hour`."""
    tz = ZoneInfo(timezone_str)
    now_local = datetime.now(tz)
    return now_local.strftime("%H:%M") >= brief_hour, now_local.date().isoformat()


async def _tick() -> None:
    """Un cycle : évalue chaque utilisateur onboardé, borné et isolé."""
    try:
        users = await _list_onboarded_users()
    except Exception as exc:  # BDD indisponible : on retentera au prochain cycle
        logger.warning("brief scheduler: liste des utilisateurs indisponible: %r", exc)
        return

    for row in users:
        user_id = row["user_id"]
        try:
            due, brief_date = _due_now(row["brief_hour"], row["timezone"])
            if not due or await _already_generated_today(user_id, brief_date):
                continue
            await asyncio.wait_for(
                run_daily_brief(user_id, "scheduled", brief_date),
                timeout=settings.brief_run_timeout,
            )
        except Exception as exc:
            logger.warning("brief scheduler: run user=%s en échec: %r", user_id, exc)


def start_brief_scheduler() -> None:
    """Démarre le scheduler (idempotent). Désactivable via config (tests)."""
    global _scheduler
    if not settings.brief_scheduler_enabled or _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _tick,
        "interval",
        minutes=settings.brief_scheduler_interval_minutes,
        max_instances=1,
        coalesce=True,
        id="daily_brief_tick",
    )
    _scheduler.start()
    logger.info(
        "scheduler brief démarré (interval=%s min)",
        settings.brief_scheduler_interval_minutes,
    )


def stop_brief_scheduler() -> None:
    """Arrête proprement le scheduler (shutdown non bloquant)."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
