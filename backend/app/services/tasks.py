"""Logique métier des tâches.

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS). Le passage
au statut `faite` est ATOMIQUE (`WHERE statut <> 'faite'`) : sur double
clic/toggle optimiste, un seul `usage_events` de type `task_completed` est
inséré et `completed_at` n'est jamais écrasé. Le repassage à `a_faire` remet
`completed_at` à `NULL`.
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.tasks import TaskCreate, TaskUpdate
from app.utils.errors import not_found

_COLUMNS = (
    "id, titre, description, priorite, echeance, statut, origine, "
    "mail_id, completed_at, created_at, updated_at"
)


def _serialize(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "titre": row["titre"],
        "description": row["description"],
        "priorite": row["priorite"],
        "echeance": row["echeance"],
        "statut": row["statut"],
        "origine": row["origine"],
        "mail_id": str(row["mail_id"]) if row["mail_id"] else None,
        "completed_at": row["completed_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def list_tasks(user_id: str, statut: str | None) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        if statut is not None:
            rows = await conn.fetch(
                f"SELECT {_COLUMNS} FROM tasks WHERE statut = $1 "
                "ORDER BY echeance ASC NULLS LAST, created_at DESC",
                statut,
            )
        else:
            rows = await conn.fetch(
                f"SELECT {_COLUMNS} FROM tasks "
                "ORDER BY echeance ASC NULLS LAST, created_at DESC"
            )
    return [_serialize(r) for r in rows]


async def create_task(user_id: str, payload: TaskCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"""
            INSERT INTO tasks (user_id, titre, description, priorite, echeance)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING {_COLUMNS}
            """,
            user_id,
            payload.titre,
            payload.description,
            payload.priorite,
            payload.echeance,
        )
    return _serialize(row)


async def update_task(user_id: str, task_id: str, payload: TaskUpdate) -> dict:
    fields = payload.model_dump(exclude_unset=True)
    statut_cible = fields.pop("statut", None)

    async with scoped_connection(user_id) as conn:
        current = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2",
            task_id,
            user_id,
        )
        if current is None:
            raise not_found("Tâche introuvable.")
        if not fields and statut_cible is None:
            return _serialize(current)

        titre = fields.get("titre", current["titre"])
        description = fields["description"] if "description" in fields else current["description"]
        priorite = fields.get("priorite", current["priorite"])
        echeance = fields["echeance"] if "echeance" in fields else current["echeance"]

        devient_faite = statut_cible == "faite" and current["statut"] != "faite"
        devient_a_faire = statut_cible == "a_faire" and current["statut"] != "a_faire"
        nouveau_statut = statut_cible if statut_cible is not None else current["statut"]

        if devient_faite:
            row = await conn.fetchrow(
                f"""
                UPDATE tasks
                SET titre = $3, description = $4, priorite = $5, echeance = $6,
                    statut = 'faite', completed_at = now(), updated_at = now()
                WHERE id = $1 AND user_id = $2 AND statut <> 'faite'
                RETURNING {_COLUMNS}
                """,
                task_id,
                user_id,
                titre,
                description,
                priorite,
                echeance,
            )
            if row is not None:
                await conn.execute(
                    "INSERT INTO usage_events (user_id, type) VALUES ($1, 'task_completed')",
                    user_id,
                )
            else:
                # Course perdue (déjà passée "faite" entre-temps) : pas de
                # double emission, on renvoie l'etat courant reel.
                row = await conn.fetchrow(
                    f"SELECT {_COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2",
                    task_id,
                    user_id,
                )
        else:
            completed_at = None if devient_a_faire else current["completed_at"]
            row = await conn.fetchrow(
                f"""
                UPDATE tasks
                SET titre = $3, description = $4, priorite = $5, echeance = $6,
                    statut = $7, completed_at = $8, updated_at = now()
                WHERE id = $1 AND user_id = $2
                RETURNING {_COLUMNS}
                """,
                task_id,
                user_id,
                titre,
                description,
                priorite,
                echeance,
                nouveau_statut,
                completed_at,
            )
    return _serialize(row)


async def delete_task(user_id: str, task_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id",
            task_id,
            user_id,
        )
    if deleted is None:
        raise not_found("Tâche introuvable.")
