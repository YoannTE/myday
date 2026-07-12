"""Logique métier des catégories de notes (miroir des catégories de tâches).

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS). La couleur
est obligatoire en base : si l'utilisateur n'en fournit pas à la création, on
en assigne une automatiquement en tournant sur `PALETTE` selon le nombre de
catégories déjà existantes pour ce user.
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.note_categories import NoteCategoryCreate, NoteCategoryUpdate
from app.utils.errors import conflict, not_found

PALETTE = (
    "#2350E6",
    "#0EA5E9",
    "#8B5CF6",
    "#F59E0B",
    "#EF4444",
    "#10B981",
    "#EC4899",
    "#64748B",
)

_COLUMNS = "id, nom, couleur, created_at, updated_at"


def _serialize(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "nom": row["nom"],
        "couleur": row["couleur"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def list_categories(user_id: str) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            f"SELECT {_COLUMNS} FROM note_categories ORDER BY nom ASC"
        )
    return [_serialize(r) for r in rows]


async def create_category(user_id: str, payload: NoteCategoryCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        couleur = payload.couleur
        if couleur is None:
            count = await conn.fetchval("SELECT count(*) FROM note_categories")
            couleur = PALETTE[count % len(PALETTE)]
        try:
            row = await conn.fetchrow(
                f"""
                INSERT INTO note_categories (user_id, nom, couleur)
                VALUES ($1, $2, $3)
                RETURNING {_COLUMNS}
                """,
                user_id,
                payload.nom,
                couleur,
            )
        except asyncpg.UniqueViolationError as err:
            raise conflict("Une catégorie porte déjà ce nom.") from err
    return _serialize(row)


async def update_category(
    user_id: str, category_id: str, payload: NoteCategoryUpdate
) -> dict:
    fields = payload.model_dump(exclude_unset=True)

    async with scoped_connection(user_id) as conn:
        current = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM note_categories WHERE id = $1 AND user_id = $2",
            category_id,
            user_id,
        )
        if current is None:
            raise not_found("Catégorie introuvable.")
        if not fields:
            return _serialize(current)

        nom = fields.get("nom", current["nom"])
        couleur = fields.get("couleur", current["couleur"])

        try:
            row = await conn.fetchrow(
                f"""
                UPDATE note_categories
                SET nom = $3, couleur = $4, updated_at = now()
                WHERE id = $1 AND user_id = $2
                RETURNING {_COLUMNS}
                """,
                category_id,
                user_id,
                nom,
                couleur,
            )
        except asyncpg.UniqueViolationError as err:
            raise conflict("Une catégorie porte déjà ce nom.") from err
    return _serialize(row)


async def delete_category(user_id: str, category_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM note_categories WHERE id = $1 AND user_id = $2 RETURNING id",
            category_id,
            user_id,
        )
    if deleted is None:
        raise not_found("Catégorie introuvable.")


async def category_belongs_to_user(user_id: str, category_id: str) -> bool:
    """Contrôle applicatif d'appartenance (la FK Postgres contourne la RLS).

    À appeler AVANT toute affectation de `categorie_id` sur une note : la
    contrainte de clé étrangère ne vérifie que l'existence de la ligne, pas
    son isolation par `user_id`.
    """
    async with scoped_connection(user_id) as conn:
        exists = await conn.fetchval(
            "SELECT 1 FROM note_categories WHERE id = $1 AND user_id = $2",
            category_id,
            user_id,
        )
    return exists is not None
