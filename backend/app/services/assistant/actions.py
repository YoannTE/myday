"""Exécuteurs d'actions locales de l'assistant : `create_task`, `create_note`,
`query_data`. Toutes idempotentes par `action_key` (dérivé de `turn_key` +
index par l'orchestrateur - jamais un UUID généré par le LLM, correction #6).

`create_event`/`draft_email` ne sont PAS ici : ils sont importés depuis les
modules de BACK-MAIL (`tools_event.py`/`draft.py`) et dispatchés directement
par l'orchestrateur (contrat d'import figé, plan Round 008).
"""

from __future__ import annotations

import re
from datetime import date, datetime, timezone

from app.db.client import scoped_connection

_STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "à",
    "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "c'est",
    "quand", "est", "ce", "pour", "avec", "sur", "dans", "que", "qui", "je",
    "j'ai", "prochain", "prochaine",
}


def _parse_due(due: str | None) -> datetime | None:
    if not due:
        return None
    try:
        return datetime.combine(date.fromisoformat(due), datetime.min.time(), tzinfo=timezone.utc)
    except ValueError:
        return None


async def create_task(user_id: str, action_key: str, params: dict) -> dict:
    echeance = _parse_due(params.get("due"))
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO tasks (user_id, titre, priorite, echeance, origine, assistant_action_key)
            VALUES ($1, $2, $3, $4, 'assistant', $5)
            ON CONFLICT (user_id, assistant_action_key) WHERE assistant_action_key IS NOT NULL
            DO NOTHING
            RETURNING id::text, titre
            """,
            user_id, params["title"], params.get("priority", "normale"), echeance, action_key,
        )
        if row is None:
            row = await conn.fetchrow(
                "SELECT id::text, titre FROM tasks WHERE user_id = $1 AND assistant_action_key = $2",
                user_id, action_key,
            )
    return {
        "type": "create_task", "ok": True, "task_id": row["id"],
        "label": f"Tâche « {row['titre']} » créée",
    }


async def create_note(user_id: str, action_key: str, params: dict) -> dict:
    note_title = params["note_title"]
    content = params["content_to_add"]

    async with scoped_connection(user_id) as conn:
        already = await conn.fetchrow(
            "SELECT n.id::text AS id, n.titre AS titre FROM note_appends na "
            "JOIN notes n ON n.id = na.note_id WHERE na.user_id = $1 AND na.action_key = $2",
            user_id, action_key,
        )
        if already is not None:
            return {
                "type": "create_note", "ok": True, "note_id": already["id"], "created": False,
                "label": f"Note « {already['titre']} » mise à jour",
            }

        existing = await conn.fetchrow(
            "SELECT id::text, titre FROM notes WHERE user_id = $1 AND lower(titre) = lower($2) "
            "ORDER BY updated_at DESC LIMIT 1",
            user_id, note_title,
        )
        created = existing is None
        if existing is None:
            note_row = await conn.fetchrow(
                "INSERT INTO notes (user_id, titre, contenu, origine) VALUES ($1, $2, $3, 'assistant') "
                "RETURNING id::text, titre",
                user_id, note_title, content,
            )
        else:
            note_row = dict(existing)
            await conn.execute(
                "UPDATE notes SET contenu = COALESCE(contenu, '') || E'\\n' || $2, updated_at = now() "
                "WHERE id = $1::uuid",
                note_row["id"], content,
            )
        await conn.execute(
            "INSERT INTO note_appends (note_id, user_id, action_key, contenu) "
            "VALUES ($1::uuid, $2, $3, $4) ON CONFLICT (note_id, action_key) DO NOTHING",
            note_row["id"], user_id, action_key, content,
        )
    return {
        "type": "create_note", "ok": True, "note_id": note_row["id"], "created": created,
        "label": f"Note « {note_row['titre']} » mise à jour",
    }


def _keywords(question: str) -> list[str]:
    words = re.findall(r"[a-zàâäéèêëïîôöùûüç0-9']+", question.lower())
    return [w for w in words if len(w) > 2 and w not in _STOPWORDS][:3]


async def query_data(user_id: str, params: dict) -> dict:
    entity = params["entity"]
    keywords = _keywords(params["question"])
    pattern = f"%{'%'.join(keywords)}%" if keywords else None

    columns_by_entity = {
        "events": ("id::text, titre, debut, fin, lieu", "titre", "fin > now()", "debut ASC"),
        "tasks": ("id::text, titre, echeance, statut", "titre", "statut = 'a_faire'", "echeance ASC NULLS LAST"),
        "notes": ("id::text, titre, contenu", "titre", "archivee = false", "updated_at DESC"),
        "mails": ("id::text, expediteur, sujet, extrait", "sujet", "true", "date_reception DESC"),
    }
    columns, filter_col, base_where, order = columns_by_entity[entity]
    table = entity

    async with scoped_connection(user_id) as conn:
        if pattern:
            rows = await conn.fetch(
                f"SELECT {columns} FROM {table} WHERE user_id = $1 AND {base_where} "
                f"AND {filter_col} ILIKE $2 ORDER BY {order} LIMIT 10",
                user_id, pattern,
            )
        else:
            rows = await conn.fetch(
                f"SELECT {columns} FROM {table} WHERE user_id = $1 AND {base_where} "
                f"ORDER BY {order} LIMIT 10",
                user_id,
            )
    results = [
        {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in dict(r).items()}
        for r in rows
    ]
    return {
        "type": "query_data", "ok": True, "entity": entity, "results": results,
        "truncated": len(results) == 10,
        "label": "Recherche effectuée dans le planning",
    }
