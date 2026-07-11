"""Orchestrateur du tri des mails - service FastAPI normal (async), PAS de
plateforme Core (décision 2026-07-10, decisions.md). Séquence :

    load -> prefilter -> (si candidats) score -> (si importants) summarize
    -> persist -> (si activé) notifications

Advisory lock Postgres anti-concurrence (correction #2 review Round 006) :
un seul run de tri actif par utilisateur à la fois, best-effort. PII (sujet,
expéditeur, contenu) jamais dans les logs - uniquement des compteurs/ids.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.config import settings
from app.db.client import get_pool
from app.services.mail_triage.persistence import (
    attach_content,
    load_mails,
    persist_triage,
    queue_notifications,
)
from app.services.mail_triage.prefilter import prefilter_mails
from app.services.mail_triage.scoring import score_candidates
from app.services.mail_triage.summaries import summarize_important

logger = logging.getLogger("myday.mail_triage.orchestrator")

_EMPTY_RESULT = {
    "processed": 0, "important_count": 0, "skipped_prefilter": 0, "llm_calls": 0,
}


@asynccontextmanager
async def _advisory_lock(user_id: str) -> AsyncIterator[bool]:
    """Verrou session Postgres sur une connexion dédiée, gardée le temps du run."""
    pool = get_pool()
    async with pool.acquire() as conn:
        acquired = await conn.fetchval(
            "SELECT pg_try_advisory_lock(hashtext('mail_triage:' || $1))", user_id
        )
        try:
            yield bool(acquired)
        finally:
            if acquired:
                await conn.execute(
                    "SELECT pg_advisory_unlock(hashtext('mail_triage:' || $1))",
                    user_id,
                )


async def run_mail_triage(user_id: str, mail_ids: list[str], trigger: str) -> dict:
    """Point d'entrée : trie les mails `pending_triage` parmi `mail_ids`
    appartenant à `user_id`. Best-effort - à appeler en `try/except` par
    l'appelant (sync, endpoint refresh)."""
    if not mail_ids:
        return dict(_EMPTY_RESULT)

    async with _advisory_lock(user_id) as acquired:
        if not acquired:
            logger.info("mail_triage déjà en cours user_id=%s trigger=%s", user_id, trigger)
            return dict(_EMPTY_RESULT)

        mails, sender_prefs = await load_mails(user_id, mail_ids)
        if not mails:
            return dict(_EMPTY_RESULT)
        mails_by_id = {m["mail_id"]: m for m in mails}

        prefiltered = prefilter_mails(mails, sender_prefs)
        auto_scored = prefiltered["auto_scored"]
        candidates = prefiltered["candidates"]

        llm_calls = 0
        scored: list[dict] = []
        if candidates:
            result = await score_candidates(
                user_id, candidates, settings.triage_llm_model,
                settings.triage_max_llm_mails_per_run,
            )
            scored = result["scored"]
            llm_calls += result["llm_calls"]

        threshold = settings.triage_importance_threshold
        all_scored = auto_scored + scored
        important = [m for m in all_scored if m["score"] >= threshold]

        summaries: dict[str, str] = {}
        if important:
            summaries = await summarize_important(
                user_id, attach_content(important, mails_by_id), settings.triage_summary_model
            )
            if summaries:
                llm_calls += 1

        persisted = await persist_triage(user_id, all_scored, summaries)
        notified = await queue_notifications(user_id, important, summaries, mails_by_id)

        logger.info(
            "mail_triage user_id=%s trigger=%s requested=%s processed=%s "
            "important=%s skipped_prefilter=%s notified=%s",
            user_id, trigger, len(mail_ids), persisted,
            len(important), len(auto_scored), notified,
        )
        return {
            "processed": persisted,
            "important_count": len(important),
            "skipped_prefilter": len(auto_scored),
            "llm_calls": llm_calls,
        }
