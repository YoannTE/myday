"""Recherche globale (Round 009) : notes/tâches/événements/mails, scopée RLS.

Les 4 SELECT tournent dans UNE seule `scoped_connection` (correction #8 du
plan). Requêtes PARAMÉTRÉES (`ILIKE '%' || $2 || '%'`) - JAMAIS de f-string
SQL avec la saisie utilisateur, pour neutraliser toute tentative d'injection
(y compris via les caractères `%`/`'` du motif ILIKE, qui restent de simples
valeurs liées passées par asyncpg, jamais interpolées dans le texte SQL).
"""

from __future__ import annotations

from app.db.client import scoped_connection

_LIMIT = 5

_NOTES_SQL = """
    SELECT id::text, titre, contenu
    FROM notes
    WHERE user_id = $1 AND archivee = false
      AND (titre ILIKE '%' || $2 || '%' OR contenu ILIKE '%' || $2 || '%')
    ORDER BY updated_at DESC LIMIT $3
"""

_TACHES_SQL = """
    SELECT id::text, titre, description, statut
    FROM tasks
    WHERE user_id = $1
      AND (titre ILIKE '%' || $2 || '%' OR description ILIKE '%' || $2 || '%')
    ORDER BY updated_at DESC LIMIT $3
"""

_EVENTS_SQL = """
    SELECT id::text, titre, lieu, debut
    FROM events
    WHERE user_id = $1
      AND (titre ILIKE '%' || $2 || '%' OR lieu ILIKE '%' || $2 || '%')
    ORDER BY debut DESC LIMIT $3
"""

_MAILS_SQL = """
    SELECT id::text, expediteur, sujet, extrait
    FROM mails
    WHERE user_id = $1 AND statut = 'triaged'
      AND (expediteur ILIKE '%' || $2 || '%' OR sujet ILIKE '%' || $2 || '%'
           OR extrait ILIKE '%' || $2 || '%')
    ORDER BY date_reception DESC LIMIT $3
"""


async def search_all(user_id: str, query: str) -> dict:
    async with scoped_connection(user_id) as conn:
        notes = await conn.fetch(_NOTES_SQL, user_id, query, _LIMIT)
        taches = await conn.fetch(_TACHES_SQL, user_id, query, _LIMIT)
        events = await conn.fetch(_EVENTS_SQL, user_id, query, _LIMIT)
        mails = await conn.fetch(_MAILS_SQL, user_id, query, _LIMIT)
    return {
        "notes": [dict(r) for r in notes],
        "taches": [dict(r) for r in taches],
        "events": [dict(r) for r in events],
        "mails": [dict(r) for r in mails],
    }
