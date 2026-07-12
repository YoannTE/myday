"""Collecte du contexte du brief (Round 007, réordonné Round 014) : une seule
passe `scoped_connection` pour charger les 3 blocs du brief du jour, dans
l'ordre de lecture naturel repris par `compose.py`/`degraded.py` :
(a) les rendez-vous du jour (+ lendemain matin si demandé), (b) les tâches
dont l'échéance tombe aujourd'hui, (c) les 3 mails les plus importants reçus
dans les 5 derniers jours. S'y ajoute la fraîcheur de la dernière
synchronisation Google. Bornes de volume 20/20/3 (compact pour le prompt
LLM), `truncated` par liste.

Les bornes horaires sont calculées dans le fuseau de l'utilisateur
(`user_preferences.timezone`, transmis par l'appelant) — jamais en UTC naïf
ni via une horloge globale (déterminisme : `brief_date` vient toujours de
l'appelant, cf. SOP `agent-design-to-fastapi-service`). Les tâches « du jour »
sont bornées par `[day_start, day_end]` (jamais une date UTC nue) : une tâche
en retard depuis plusieurs jours ne réapparaît plus dans ce bloc (seules les
échéances d'aujourd'hui comptent, cf. spec Round 014 F5).
"""

from __future__ import annotations

from datetime import date as date_type
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.db.client import scoped_connection

_EVENTS_LIMIT = 20
_TASKS_LIMIT = 20
_MAILS_LIMIT = 3
_MAILS_LOOKBACK_DAYS = 5


def _day_bounds(brief_date: str, tz: ZoneInfo) -> tuple[datetime, datetime]:
    day = date_type.fromisoformat(brief_date)
    return (
        datetime.combine(day, time.min, tzinfo=tz),
        datetime.combine(day, time.max, tzinfo=tz),
    )


def _tomorrow_morning_bounds(brief_date: str, tz: ZoneInfo) -> tuple[datetime, datetime]:
    day = date_type.fromisoformat(brief_date) + timedelta(days=1)
    return (
        datetime.combine(day, time.min, tzinfo=tz),
        datetime.combine(day, time(12, 0), tzinfo=tz),
    )


def _bound(rows: list, limit: int) -> tuple[list, bool]:
    return list(rows[:limit]), len(rows) > limit


def _serialize_event(row) -> dict:
    return {
        "title": row["titre"],
        "start": row["debut"].isoformat(),
        "end": row["fin"].isoformat(),
        "location": row["lieu"],
    }


def _serialize_task(row, now: datetime) -> dict:
    echeance = row["echeance"]
    return {
        "title": row["titre"],
        "due": echeance.isoformat() if echeance else None,
        "priority": row["priorite"],
        "overdue": bool(echeance and echeance < now),
    }


def _serialize_mail(row) -> dict:
    return {
        "from": row["expediteur"],
        "subject": row["sujet"],
        "summary": row["resume_ia"],
        "score": row["score"],
    }


async def collect_context(
    user_id: str,
    brief_date: str,
    timezone_str: str,
    include_mails: bool,
    lookahead_tomorrow: bool,
    importance_threshold: int,
) -> dict:
    tz = ZoneInfo(timezone_str)
    day_start, day_end = _day_bounds(brief_date, tz)

    async with scoped_connection(user_id) as conn:
        event_rows = await conn.fetch(
            "SELECT titre, debut, fin, lieu FROM events "
            "WHERE fin > $1 AND debut < $2 ORDER BY debut ASC LIMIT $3",
            day_start, day_end, _EVENTS_LIMIT + 1,
        )

        tomorrow_rows: list = []
        if lookahead_tomorrow:
            tmr_start, tmr_end = _tomorrow_morning_bounds(brief_date, tz)
            tomorrow_rows = await conn.fetch(
                "SELECT titre, debut, fin, lieu FROM events "
                "WHERE fin > $1 AND debut < $2 ORDER BY debut ASC LIMIT $3",
                tmr_start, tmr_end, _EVENTS_LIMIT + 1,
            )

        task_rows = await conn.fetch(
            "SELECT titre, priorite, echeance FROM tasks "
            "WHERE statut = 'a_faire' AND echeance IS NOT NULL "
            "AND echeance >= $1 AND echeance <= $2 "
            "ORDER BY CASE priorite WHEN 'haute' THEN 0 WHEN 'normale' THEN 1 "
            "ELSE 2 END ASC, echeance ASC LIMIT $3",
            day_start, day_end, _TASKS_LIMIT + 1,
        )

        mail_rows: list = []
        if include_mails:
            mail_rows = await conn.fetch(
                "SELECT expediteur, sujet, resume_ia, score FROM mails "
                "WHERE statut = 'triaged' AND score >= $1 AND repondu = false "
                "AND date_reception >= $2 ORDER BY score DESC LIMIT $3",
                importance_threshold,
                day_end - timedelta(days=_MAILS_LOOKBACK_DAYS),
                _MAILS_LIMIT + 1,
            )

        sync_row = await conn.fetchrow(
            "SELECT LEAST(calendar_synced_at, gmail_synced_at) AS last_sync_at "
            "FROM google_connections"
        )

    events, events_truncated = _bound(event_rows, _EVENTS_LIMIT)
    tomorrow, tomorrow_truncated = _bound(tomorrow_rows, _EVENTS_LIMIT)
    tasks, tasks_truncated = _bound(task_rows, _TASKS_LIMIT)
    mails, mails_truncated = _bound(mail_rows, _MAILS_LIMIT)

    now = datetime.now(tz)
    last_sync_at = None
    if sync_row is not None and sync_row["last_sync_at"] is not None:
        last_sync_at = sync_row["last_sync_at"].isoformat()

    return {
        # (a) rendez-vous du jour - bornes [day_start, day_end] Europe/Paris.
        "events": [_serialize_event(r) for r in events],
        "tomorrow_morning": [_serialize_event(r) for r in tomorrow],
        # (b) tâches dont l'échéance tombe aujourd'hui - mêmes bornes.
        "tasks_today": [_serialize_task(r, now) for r in tasks],
        # (c) 3 mails les plus importants reçus dans les 5 derniers jours.
        "important_mails": [_serialize_mail(r) for r in mails],
        "last_sync_at": last_sync_at,
        "truncated": {
            "events": events_truncated,
            "tomorrow_morning": tomorrow_truncated,
            "tasks_today": tasks_truncated,
            "important_mails": mails_truncated,
        },
    }
