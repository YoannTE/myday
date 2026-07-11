"""Logique métier des notes.

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS). La liste
filtre `archivee` (défaut False), recherche `q` en `ILIKE` sur titre+contenu,
et trie les notes épinglées en premier puis par `updated_at` décroissant.
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.notes import NoteCreate, NoteUpdate
from app.utils.errors import not_found

_COLUMNS = "id, titre, contenu, epinglee, archivee, origine, created_at, updated_at"


def _serialize(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "titre": row["titre"],
        "contenu": row["contenu"],
        "epinglee": row["epinglee"],
        "archivee": row["archivee"],
        "origine": row["origine"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def list_notes(user_id: str, archivee: bool, q: str | None) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        if q:
            pattern = f"%{q}%"
            rows = await conn.fetch(
                f"""
                SELECT {_COLUMNS} FROM notes
                WHERE archivee = $1 AND (titre ILIKE $2 OR contenu ILIKE $2)
                ORDER BY epinglee DESC, updated_at DESC
                """,
                archivee,
                pattern,
            )
        else:
            rows = await conn.fetch(
                f"""
                SELECT {_COLUMNS} FROM notes
                WHERE archivee = $1
                ORDER BY epinglee DESC, updated_at DESC
                """,
                archivee,
            )
    return [_serialize(r) for r in rows]


async def create_note(user_id: str, payload: NoteCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"""
            INSERT INTO notes (user_id, titre, contenu)
            VALUES ($1, $2, $3)
            RETURNING {_COLUMNS}
            """,
            user_id,
            payload.titre,
            payload.contenu,
        )
    return _serialize(row)


async def update_note(user_id: str, note_id: str, payload: NoteUpdate) -> dict:
    fields = payload.model_dump(exclude_unset=True)
    async with scoped_connection(user_id) as conn:
        current = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM notes WHERE id = $1 AND user_id = $2",
            note_id,
            user_id,
        )
        if current is None:
            raise not_found("Note introuvable.")
        if not fields:
            return _serialize(current)

        titre = fields.get("titre", current["titre"])
        contenu = fields["contenu"] if "contenu" in fields else current["contenu"]
        epinglee = fields.get("epinglee", current["epinglee"])
        archivee = fields.get("archivee", current["archivee"])

        row = await conn.fetchrow(
            f"""
            UPDATE notes
            SET titre = $3, contenu = $4, epinglee = $5, archivee = $6, updated_at = now()
            WHERE id = $1 AND user_id = $2
            RETURNING {_COLUMNS}
            """,
            note_id,
            user_id,
            titre,
            contenu,
            epinglee,
            archivee,
        )
    return _serialize(row)


async def delete_note(user_id: str, note_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id",
            note_id,
            user_id,
        )
    if deleted is None:
        raise not_found("Note introuvable.")
