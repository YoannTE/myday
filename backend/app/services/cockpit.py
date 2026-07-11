"""Agregation des donnees du cockpit (page d'accueil `/`).

Une seule `scoped_connection` pour les 3 lectures (notes/events/tasks) : la
RLS filtre automatiquement par utilisateur. Bornes du jour calculees en heure
locale (`settings.app_timezone`, Europe/Paris par defaut) plutot qu'en UTC
naif (correction #6 review Round 004).
"""

from __future__ import annotations

import json
from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.config import settings
from app.db.client import scoped_connection
from app.services.mails import MAIL_SELECT_COLUMNS

_NOTES_LIMIT = 5
_MAILS_IMPORTANTS_LIMIT = 5

_NOTES_COLUMNS = (
    "id::text, titre, contenu, epinglee, archivee, origine, created_at, updated_at"
)
_EVENTS_COLUMNS = (
    "id::text, titre, debut, fin, lieu, description, google_event_id, "
    "source, sync_status, created_at, updated_at"
)
_TASKS_COLUMNS = (
    "id::text, titre, description, priorite, echeance, statut, origine, "
    "mail_id::text, completed_at, created_at, updated_at"
)


def _day_bounds() -> tuple[datetime, datetime]:
    """Bornes [debut, fin] du jour courant, calculees dans le fuseau applicatif."""
    tz = ZoneInfo(settings.app_timezone)
    today = datetime.now(tz).date()
    return datetime.combine(today, time.min, tzinfo=tz), datetime.combine(
        today, time.max, tzinfo=tz
    )


async def get_cockpit(user_id: str) -> dict:
    day_start, day_end = _day_bounds()
    async with scoped_connection(user_id) as conn:
        # Correction #5 (review Round 007) : `today_local` du brief est calcule
        # depuis le fuseau PROPRE a l'utilisateur (user_preferences.timezone),
        # dans la MEME scoped_connection - pas settings.app_timezone global
        # (sinon le brief du jour serait invisible pour un utilisateur hors
        # du fuseau applicatif par defaut).
        user_timezone = await conn.fetchval(
            "SELECT timezone FROM user_preferences WHERE user_id = $1", user_id
        ) or settings.app_timezone
        today_local = datetime.now(ZoneInfo(user_timezone)).date()
        brief_row = await conn.fetchrow(
            "SELECT contenu, degraded, generated_at, type FROM briefs "
            "WHERE brief_date = $1 "
            "ORDER BY (type = 'quotidien') DESC, generated_at DESC LIMIT 1",
            today_local,
        )

        notes = await conn.fetch(
            f"SELECT {_NOTES_COLUMNS} FROM notes "
            "WHERE epinglee = true AND archivee = false "
            "ORDER BY updated_at DESC LIMIT $1",
            _NOTES_LIMIT,
        )
        events = await conn.fetch(
            f"SELECT {_EVENTS_COLUMNS} FROM events "
            "WHERE fin > $1 AND debut < $2 ORDER BY debut ASC",
            day_start, day_end,
        )
        tasks = await conn.fetch(
            f"SELECT {_TASKS_COLUMNS} FROM tasks "
            "WHERE statut = 'a_faire' "
            "ORDER BY echeance ASC NULLS LAST, "
            "CASE priorite WHEN 'haute' THEN 0 WHEN 'normale' THEN 1 ELSE 2 END ASC"
        )
        triaged_count = await conn.fetchval(
            "SELECT count(*) FROM mails WHERE statut = 'triaged'"
        )
        mails_importants_rows = await conn.fetch(
            f"SELECT {MAIL_SELECT_COLUMNS} FROM mails "
            "WHERE statut = 'triaged' AND score >= $1 "
            "ORDER BY score DESC LIMIT $2",
            settings.triage_importance_threshold,
            _MAILS_IMPORTANTS_LIMIT,
        )
    # Etat transitoire (aucun mail encore trie) : on garde le placeholder.
    # Des qu'au moins un mail est trie, on affiche les importants reels, meme
    # si la liste filtree par le seuil est vide (correction #7 - source unique
    # du seuil, plan Round 006 point 7).
    if triaged_count == 0:
        mails_importants: dict = {"placeholder": True}
    else:
        mails_importants = {
            "placeholder": False,
            "mails": [dict(r) for r in mails_importants_rows],
        }
    if brief_row is None:
        brief: dict | None = None
    else:
        # asyncpg renvoie le jsonb en str brut (aucun codec) - correction #2
        # review Round 007 : `json.loads` obligatoire cote lecture.
        brief = {
            "contenu": json.loads(brief_row["contenu"]),
            "degraded": brief_row["degraded"],
            "generated_at": brief_row["generated_at"],
            "type": brief_row["type"],
        }
    return {
        "notes_epinglees": [dict(r) for r in notes],
        "journee": [dict(r) for r in events],
        "taches": [dict(r) for r in tasks],
        "mails_importants": mails_importants,
        "brief": brief,
    }
