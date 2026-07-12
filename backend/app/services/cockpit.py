"""Agregation des donnees du cockpit (page d'accueil `/`).

Une seule `scoped_connection` pour les 3 lectures (notes/events/tasks) : la
RLS filtre automatiquement par utilisateur. Bornes du jour calculees en heure
locale (`settings.app_timezone`, Europe/Paris par defaut) plutot qu'en UTC
naif (correction #6 review Round 004).

Round 014 (F8) : la section "Ton planning" ("prochains") n'affiche plus les
seuls evenements du jour mais les 10 prochains rendez-vous a venir
(`debut >= now()`, tri croissant), toujours en heure locale.
"""

from __future__ import annotations

import json
from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings
from app.db.client import scoped_connection
from app.services.mails import MAIL_SELECT_COLUMNS

_NOTES_LIMIT = 5
_MAILS_IMPORTANTS_LIMIT = 5
_PROCHAINS_LIMIT = 10

_NOTES_COLUMNS = (
    "n.id::text, n.titre, n.contenu, n.epinglee, n.archivee, n.origine, "
    "n.created_at, n.updated_at, "
    "n.categorie_id::text, c.nom AS categorie_nom, c.couleur AS categorie_couleur"
)
_EVENTS_COLUMNS = (
    "id::text, titre, debut, fin, lieu, description, google_event_id, "
    "source, sync_status, created_at, updated_at"
)
_TASKS_COLUMNS = (
    "t.id::text, t.titre, t.description, t.priorite, t.echeance, t.statut, "
    "t.origine, t.mail_id::text, t.completed_at, t.created_at, t.updated_at, "
    "t.categorie_id::text, c.nom AS categorie_nom, c.couleur AS categorie_couleur"
)


def _serialize_avec_categorie(row) -> dict:
    """Aplati la ligne SQL en dict + objet `categorie` imbrique (ou None).

    Partage entre taches et notes : meme forme d'objet categorie
    (`{id, nom, couleur}`) alimentee par les colonnes alias `categorie_nom` /
    `categorie_couleur` d'une jointure `LEFT JOIN ... categories`.
    """
    d = dict(row)
    nom = d.pop("categorie_nom", None)
    couleur = d.pop("categorie_couleur", None)
    if d.get("categorie_id") is not None and nom is not None:
        d["categorie"] = {"id": d["categorie_id"], "nom": nom, "couleur": couleur}
    else:
        d["categorie"] = None
    return d


# Alias retro-compatibles : taches et notes partagent la meme serialisation.
_serialize_task = _serialize_avec_categorie
_serialize_note = _serialize_avec_categorie


def _now_local() -> datetime:
    """Instant courant dans le fuseau applicatif (Europe/Paris par defaut)."""
    return datetime.now(ZoneInfo(settings.app_timezone))


async def get_cockpit(user_id: str) -> dict:
    now = _now_local()
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
            f"SELECT {_NOTES_COLUMNS} FROM notes n "
            "LEFT JOIN note_categories c ON c.id = n.categorie_id "
            "WHERE n.epinglee = true AND n.archivee = false "
            "ORDER BY n.updated_at DESC LIMIT $1",
            _NOTES_LIMIT,
        )
        prochains = await conn.fetch(
            f"SELECT {_EVENTS_COLUMNS} FROM events "
            "WHERE debut >= $1 ORDER BY debut ASC LIMIT $2",
            now, _PROCHAINS_LIMIT,
        )
        tasks = await conn.fetch(
            f"SELECT {_TASKS_COLUMNS} FROM tasks t "
            "LEFT JOIN task_categories c ON c.id = t.categorie_id "
            "WHERE t.statut = 'a_faire' "
            "ORDER BY t.echeance ASC NULLS LAST, "
            "CASE t.priorite WHEN 'haute' THEN 0 WHEN 'normale' THEN 1 ELSE 2 END ASC"
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
        "notes_epinglees": [_serialize_note(r) for r in notes],
        "prochains": [dict(r) for r in prochains],
        "taches": [_serialize_task(r) for r in tasks],
        "mails_importants": mails_importants,
        "brief": brief,
    }
