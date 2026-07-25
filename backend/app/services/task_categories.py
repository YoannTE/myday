"""Logique métier des catégories de tâches (Round 012).

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS). La couleur
est obligatoire en base : si l'utilisateur n'en fournit pas à la création, on
en assigne une automatiquement en tournant sur `PALETTE` selon le nombre de
catégories déjà existantes pour ce user. Le tri est un ordre manuel
(`position`), plus alphabétique en repli (Refonte Cockpit unique).
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.task_categories import TaskCategoryCreate, TaskCategoryUpdate
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

_COLUMNS = "id, nom, couleur, position, created_at, updated_at"
_ORDER_BY = "ORDER BY position ASC NULLS LAST, nom ASC"


def _serialize(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "nom": row["nom"],
        "couleur": row["couleur"],
        "position": row["position"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def list_categories(user_id: str) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            f"SELECT {_COLUMNS} FROM task_categories {_ORDER_BY}"
        )
    return [_serialize(r) for r in rows]


async def create_category(user_id: str, payload: TaskCategoryCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        async with conn.transaction():
            couleur = payload.couleur
            if couleur is None:
                count = await conn.fetchval(
                    "SELECT count(*) FROM task_categories"
                )
                couleur = PALETTE[count % len(PALETTE)]
            # L'ordre par défaut est l'ordre de création (plus de tri
            # alphabétique) : on fige d'abord l'ordre affiché des catégories
            # jamais positionnées, puis la nouvelle prend la suite.
            group = await conn.fetch(
                f"SELECT id, position FROM task_categories "
                f"WHERE user_id = $1 {_ORDER_BY}",
                user_id,
            )
            for position, existante in enumerate(group):
                if existante["position"] != position:
                    await conn.execute(
                        "UPDATE task_categories SET position = $2, "
                        "updated_at = now() WHERE id = $1",
                        existante["id"],
                        position,
                    )
            try:
                row = await conn.fetchrow(
                    f"""
                    INSERT INTO task_categories (user_id, nom, couleur, position)
                    VALUES ($1, $2, $3, $4)
                    RETURNING {_COLUMNS}
                    """,
                    user_id,
                    payload.nom,
                    couleur,
                    len(group),
                )
            except asyncpg.UniqueViolationError as err:
                raise conflict(
                    "Une catégorie porte déjà ce nom."
                ) from err
    return _serialize(row)


async def update_category(
    user_id: str, category_id: str, payload: TaskCategoryUpdate
) -> dict:
    fields = payload.model_dump(exclude_unset=True)

    async with scoped_connection(user_id) as conn:
        current = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM task_categories WHERE id = $1 AND user_id = $2",
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
                UPDATE task_categories
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
            raise conflict(
                "Une catégorie porte déjà ce nom."
            ) from err
    return _serialize(row)


async def deplacer_task_category(user_id: str, category_id: str, direction: str) -> list[dict]:
    """Déplace une catégorie vers le haut/bas dans l'ordre manuel de
    l'utilisateur (Refonte Cockpit unique). No-op si elle est déjà en
    première/dernière position ; renvoie dans tous les cas la liste complète
    des catégories re-triée."""
    async with scoped_connection(user_id) as conn:
        async with conn.transaction():
            category = await conn.fetchrow(
                "SELECT id FROM task_categories WHERE id = $1 AND user_id = $2",
                category_id,
                user_id,
            )
            if category is None:
                raise not_found("Catégorie introuvable.")

            group = await conn.fetch(
                f"SELECT id::text AS id, position FROM task_categories "
                f"WHERE user_id = $1 {_ORDER_BY}",
                user_id,
            )
            ordered_ids = [r["id"] for r in group]
            positions_avant = {r["id"]: r["position"] for r in group}

            index = ordered_ids.index(category_id)
            voisin_index = index - 1 if direction == "haut" else index + 1
            if 0 <= voisin_index < len(ordered_ids):
                ordered_ids[index], ordered_ids[voisin_index] = (
                    ordered_ids[voisin_index],
                    ordered_ids[index],
                )

            for position, cid in enumerate(ordered_ids):
                if positions_avant[cid] != position:
                    await conn.execute(
                        "UPDATE task_categories SET position = $2, updated_at = now() "
                        "WHERE id = $1",
                        cid,
                        position,
                    )

    return await list_categories(user_id)


async def delete_category(user_id: str, category_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM task_categories WHERE id = $1 AND user_id = $2 RETURNING id",
            category_id,
            user_id,
        )
    if deleted is None:
        raise not_found("Catégorie introuvable.")


async def category_belongs_to_user(user_id: str, category_id: str) -> bool:
    """Contrôle applicatif d'appartenance (la FK Postgres contourne la RLS).

    À appeler AVANT toute affectation de `categorie_id` sur une tâche : la
    contrainte de clé étrangère ne vérifie que l'existence de la ligne, pas
    son isolation par `user_id`.
    """
    async with scoped_connection(user_id) as conn:
        exists = await conn.fetchval(
            "SELECT 1 FROM task_categories WHERE id = $1 AND user_id = $2",
            category_id,
            user_id,
        )
    return exists is not None
