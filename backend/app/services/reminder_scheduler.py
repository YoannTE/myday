"""Scheduler des rappels d'événements (Round 009), calqué sur
`brief_scheduler.py` / `google/scheduler.py`.

Chaque tick (`event_reminder_interval_minutes`, ~5 min) exécute
`run_event_reminders` avec `delta_minutes` égal à l'intervalle du tick
(fenêtre de la requête = intervalle du tick, correction #6 du plan - ne
rate ni ne double un rappel). `max_instances=1, coalesce=True` : un tick lent
n'en accumule jamais un second. Démarré/arrêté dans le lifespan `main.py`.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.services.event_reminders import run_event_reminders
from app.services.task_reminders import run_task_reminders

logger = logging.getLogger("myday.event_reminders.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _tick() -> None:
    interval = settings.event_reminder_interval_minutes
    try:
        created = await run_event_reminders(interval)
        if created:
            logger.info("rappels d'événements: %s notification(s) créée(s)", created)
    except Exception as exc:  # BDD indisponible : on retentera au prochain cycle
        logger.warning("scheduler rappels événements: cycle en échec: %r", exc)
    try:
        created_taches = await run_task_reminders(interval)
        if created_taches:
            logger.info("rappels de tâches: %s notification(s) créée(s)", created_taches)
    except Exception as exc:
        logger.warning("scheduler rappels tâches: cycle en échec: %r", exc)


def start_reminder_scheduler() -> None:
    """Démarre le scheduler (idempotent). Désactivable via config (tests)."""
    global _scheduler
    if not settings.event_reminder_scheduler_enabled or _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _tick,
        "interval",
        minutes=settings.event_reminder_interval_minutes,
        max_instances=1,
        coalesce=True,
        id="event_reminder_tick",
    )
    _scheduler.start()
    logger.info(
        "scheduler rappels d'événements démarré (interval=%s min)",
        settings.event_reminder_interval_minutes,
    )


def stop_reminder_scheduler() -> None:
    """Arrête proprement le scheduler (shutdown non bloquant)."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
