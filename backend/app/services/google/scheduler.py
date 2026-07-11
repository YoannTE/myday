"""Scheduler de synchronisation Google (~5 min, un run par utilisateur connecte).

Demarre/arrete dans le lifespan FastAPI. Le VRAI garde anti-double-run est le
verrou BDD `sync_locked_until` (pose par `load_connection`) : `--workers 1` n'est
qu'une garde intra-process. Chaque run utilisateur est borne par un timeout global
et isole (une erreur utilisateur n'interrompt pas la boucle).

La liste des utilisateurs a synchroniser est une lecture cross-tenant legitime
(uniquement des `user_id`, aucun jeton) : elle passe par le pool admin. TOUTES
les operations de donnees restent scopees par `scoped_connection` dans run_sync.
"""

from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.db.client import get_admin_pool
from app.services.google.sync import run_sync

logger = logging.getLogger("myday.google.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _list_connected_users() -> list[str]:
    pool = get_admin_pool()
    rows = await pool.fetch(
        "SELECT user_id FROM google_connections "
        "WHERE status = 'connected' AND refresh_token IS NOT NULL"
    )
    return [r["user_id"] for r in rows]


async def _tick() -> None:
    """Un cycle : synchronise chaque utilisateur connecte, borne et isole."""
    try:
        user_ids = await _list_connected_users()
    except Exception as exc:  # BDD indisponible : on retentera au prochain cycle
        logger.warning("scheduler: liste des connexions indisponible: %r", exc)
        return
    for user_id in user_ids:
        try:
            await asyncio.wait_for(
                run_sync(user_id, trigger="scheduled"),
                timeout=settings.google_sync_run_timeout,
            )
        except Exception as exc:
            logger.warning("scheduler: run user=%s en echec: %r", user_id, exc)


def start_scheduler() -> None:
    """Demarre le scheduler (idempotent). Desactivable via config (tests)."""
    global _scheduler
    if not settings.google_scheduler_enabled or _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _tick,
        "interval",
        minutes=settings.google_scheduler_interval_minutes,
        max_instances=1,
        coalesce=True,
        id="google_sync_tick",
    )
    _scheduler.start()
    logger.info(
        "scheduler google demarre (interval=%s min)",
        settings.google_scheduler_interval_minutes,
    )


def stop_scheduler() -> None:
    """Arrete proprement le scheduler (shutdown non bloquant)."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
