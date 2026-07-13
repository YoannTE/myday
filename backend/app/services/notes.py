"""Logique métier des notes.

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS). La liste
filtre `archivee` (défaut False), recherche `q` en `ILIKE` sur titre+contenu,
et trie les notes épinglées en premier puis par `updated_at` décroissant.

`categorie_id` est une FK nullable vers `note_categories`. La contrainte FK
Postgres ne vérifie que l'existence de la ligne, PAS son isolation par
`user_id` (elle contourne la RLS) : toute affectation passe donc par
`note_categories_service.category_belongs_to_user` avant d'être écrite.
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.notes import NoteCreate, NoteUpdate
from app.services import note_categories as note_categories_service
from app.services import note_items as note_items_service
from app.utils.errors import bad_request, not_found

_SELECT = """
    SELECT n.id, n.titre, n.contenu, n.epinglee, n.archivee, n.origine,
           n.categorie_id, n.created_at, n.updated_at,
           c.nom AS categorie_nom, c.couleur AS categorie_couleur
    FROM notes n
    LEFT JOIN note_categories c ON c.id = n.categorie_id
"""


def _serialize(row: asyncpg.Record, items: list[dict] | None = None) -> dict:
    categorie = None
    if row["categorie_id"] is not None and row["categorie_nom"] is not None:
        categorie = {
            "id": str(row["categorie_id"]),
            "nom": row["categorie_nom"],
            "couleur": row["categorie_couleur"],
        }
    return {
        "id": str(row["id"]),
        "titre": row["titre"],
        "contenu": row["contenu"],
        "epinglee": row["epinglee"],
        "archivee": row["archivee"],
        "origine": row["origine"],
        "categorie_id": str(row["categorie_id"]) if row["categorie_id"] else None,
        "categorie": categorie,
        "items": items or [],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def _assert_categorie_valide(user_id: str, categorie_id: str | None) -> None:
    if categorie_id is None:
        return
    appartient = await note_categories_service.category_belongs_to_user(
        user_id, categorie_id
    )
    if not appartient:
        raise bad_request("Catégorie invalide ou appartenant à un autre utilisateur.")


async def list_notes(user_id: str, archivee: bool, q: str | None) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        if q:
            pattern = f"%{q}%"
            rows = await conn.fetch(
                f"""
                {_SELECT}
                WHERE n.archivee = $1 AND (n.titre ILIKE $2 OR n.contenu ILIKE $2)
                ORDER BY n.epinglee DESC, n.updated_at DESC
                """,
                archivee,
                pattern,
            )
        else:
            rows = await conn.fetch(
                f"""
                {_SELECT}
                WHERE n.archivee = $1
                ORDER BY n.epinglee DESC, n.updated_at DESC
                """,
                archivee,
            )
        note_ids = [str(r["id"]) for r in rows]
        items_par_note = await note_items_service.list_for_notes(conn, note_ids)
    return [_serialize(r, items_par_note.get(str(r["id"]), [])) for r in rows]


async def create_note(user_id: str, payload: NoteCreate) -> dict:
    categorie_id = str(payload.categorie_id) if payload.categorie_id else None
    await _assert_categorie_valide(user_id, categorie_id)

    async with scoped_connection(user_id) as conn:
        note_id = await conn.fetchval(
            """
            INSERT INTO notes (user_id, titre, contenu, categorie_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            user_id,
            payload.titre,
            payload.contenu,
            categorie_id,
        )
        row = await conn.fetchrow(f"{_SELECT} WHERE n.id = $1", note_id)
    return _serialize(row, [])


async def update_note(user_id: str, note_id: str, payload: NoteUpdate) -> dict:
    fields = payload.model_dump(exclude_unset=True)
    async with scoped_connection(user_id) as conn:
        current = await conn.fetchrow(
            f"{_SELECT} WHERE n.id = $1 AND n.user_id = $2", note_id, user_id
        )
        if current is None:
            raise not_found("Note introuvable.")
        items = await note_items_service.list_for_note(conn, note_id)
        if not fields:
            return _serialize(current, items)

        titre = fields.get("titre", current["titre"])
        contenu = fields["contenu"] if "contenu" in fields else current["contenu"]
        epinglee = fields.get("epinglee", current["epinglee"])
        archivee = fields.get("archivee", current["archivee"])

        if "categorie_id" in fields:
            categorie_id = (
                str(fields["categorie_id"]) if fields["categorie_id"] else None
            )
            await _assert_categorie_valide(user_id, categorie_id)
        else:
            categorie_id = current["categorie_id"]

        await conn.execute(
            """
            UPDATE notes
            SET titre = $3, contenu = $4, epinglee = $5, archivee = $6,
                categorie_id = $7, updated_at = now()
            WHERE id = $1 AND user_id = $2
            """,
            note_id,
            user_id,
            titre,
            contenu,
            epinglee,
            archivee,
            categorie_id,
        )
        row = await conn.fetchrow(
            f"{_SELECT} WHERE n.id = $1 AND n.user_id = $2", note_id, user_id
        )
    return _serialize(row, items)


async def delete_note(user_id: str, note_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id",
            note_id,
            user_id,
        )
    if deleted is None:
        raise not_found("Note introuvable.")
