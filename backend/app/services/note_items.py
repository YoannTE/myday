"""Logique métier des éléments (cases à cocher) d'une note.

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS). Le
`user_id` est dénormalisé sur `note_items` pour une policy RLS directe. La FK
`note_id` contourne la RLS : on valide donc explicitement que la note
appartient à l'utilisateur avant d'y ajouter un élément.
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.note_items import NoteItemCreate, NoteItemUpdate
from app.utils.errors import not_found

_COLUMNS = "id, contenu, coche, position, created_at, updated_at"
# Tri : éléments non cochés d'abord (par position), cochés relégués en bas.
_ORDER = "ORDER BY coche ASC, position ASC, created_at ASC"


def _serialize(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "contenu": row["contenu"],
        "coche": row["coche"],
        "position": row["position"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def list_for_notes(conn: asyncpg.Connection, note_ids: list[str]) -> dict:
    """Retourne un dict {note_id: [items...]} pour une liste de notes, en une
    seule requête (réutilise la connexion scoped déjà ouverte)."""
    if not note_ids:
        return {}
    rows = await conn.fetch(
        f"SELECT note_id::text, {_COLUMNS} FROM note_items "
        f"WHERE note_id = ANY($1::uuid[]) {_ORDER}",
        note_ids,
    )
    groupes: dict[str, list[dict]] = {nid: [] for nid in note_ids}
    for row in rows:
        groupes.setdefault(row["note_id"], []).append(_serialize(row))
    return groupes


async def list_for_note(conn: asyncpg.Connection, note_id: str) -> list[dict]:
    rows = await conn.fetch(
        f"SELECT {_COLUMNS} FROM note_items WHERE note_id = $1 {_ORDER}",
        note_id,
    )
    return [_serialize(r) for r in rows]


async def _assert_note_appartient(conn: asyncpg.Connection, note_id: str) -> None:
    """La RLS restreint déjà `notes` à l'utilisateur courant : si la note n'est
    pas visible ici, elle n'est pas la sienne (ou n'existe pas)."""
    existe = await conn.fetchval("SELECT 1 FROM notes WHERE id = $1", note_id)
    if existe is None:
        raise not_found("Note introuvable.")


async def create_item(user_id: str, note_id: str, payload: NoteItemCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        await _assert_note_appartient(conn, note_id)
        position = await conn.fetchval(
            "SELECT COALESCE(max(position), -1) + 1 FROM note_items WHERE note_id = $1",
            note_id,
        )
        row = await conn.fetchrow(
            f"""
            INSERT INTO note_items (note_id, user_id, contenu, position)
            VALUES ($1, $2, $3, $4)
            RETURNING {_COLUMNS}
            """,
            note_id,
            user_id,
            payload.contenu,
            position,
        )
    return _serialize(row)


async def update_item(user_id: str, item_id: str, payload: NoteItemUpdate) -> dict:
    fields = payload.model_dump(exclude_unset=True)
    async with scoped_connection(user_id) as conn:
        current = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM note_items WHERE id = $1 AND user_id = $2",
            item_id,
            user_id,
        )
        if current is None:
            raise not_found("Élément introuvable.")
        if not fields:
            return _serialize(current)

        contenu = fields.get("contenu", current["contenu"])
        coche = fields.get("coche", current["coche"])
        row = await conn.fetchrow(
            f"""
            UPDATE note_items
            SET contenu = $3, coche = $4, updated_at = now()
            WHERE id = $1 AND user_id = $2
            RETURNING {_COLUMNS}
            """,
            item_id,
            user_id,
            contenu,
            coche,
        )
    return _serialize(row)


async def delete_item(user_id: str, item_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM note_items WHERE id = $1 AND user_id = $2 RETURNING id",
            item_id,
            user_id,
        )
    if deleted is None:
        raise not_found("Élément introuvable.")
