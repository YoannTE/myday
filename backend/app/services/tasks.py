"""Logique métier des tâches.

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS). Le passage
au statut `faite` est ATOMIQUE (`WHERE statut <> 'faite'`) : sur double
clic/toggle optimiste, un seul `usage_events` de type `task_completed` est
inséré et `completed_at` n'est jamais écrasé. Le repassage à `a_faire` remet
`completed_at` à `NULL`.

Round 012 : `categorie_id` est une FK nullable vers `task_categories`. La
contrainte FK Postgres ne vérifie que l'existence de la ligne, PAS son
isolation par `user_id` (elle contourne la RLS) : toute affectation passe donc
par `task_categories_service.category_belongs_to_user` avant d'être écrite.
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.tasks import TaskCreate, TaskUpdate
from app.services import task_categories as task_categories_service
from app.utils.errors import bad_request, not_found

_SELECT = """
    SELECT t.id, t.titre, t.description, t.priorite, t.echeance, t.categorie_id,
           t.statut, t.origine, t.mail_id, t.completed_at, t.created_at, t.updated_at,
           c.nom AS categorie_nom, c.couleur AS categorie_couleur
    FROM tasks t
    LEFT JOIN task_categories c ON c.id = t.categorie_id
"""


def _serialize(row: asyncpg.Record) -> dict:
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
        "description": row["description"],
        "priorite": row["priorite"],
        "echeance": row["echeance"],
        "categorie_id": str(row["categorie_id"]) if row["categorie_id"] else None,
        "categorie": categorie,
        "statut": row["statut"],
        "origine": row["origine"],
        "mail_id": str(row["mail_id"]) if row["mail_id"] else None,
        "completed_at": row["completed_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def _assert_categorie_valide(user_id: str, categorie_id: str | None) -> None:
    if categorie_id is None:
        return
    appartient = await task_categories_service.category_belongs_to_user(
        user_id, categorie_id
    )
    if not appartient:
        raise bad_request("Catégorie invalide ou appartenant à un autre utilisateur.")


async def _reload(conn: asyncpg.Connection, task_id: str, user_id: str) -> asyncpg.Record:
    return await conn.fetchrow(
        f"{_SELECT} WHERE t.id = $1 AND t.user_id = $2", task_id, user_id
    )


async def list_tasks(user_id: str, statut: str | None) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        if statut is not None:
            rows = await conn.fetch(
                f"{_SELECT} WHERE t.statut = $1 "
                "ORDER BY t.echeance ASC NULLS LAST, t.created_at DESC",
                statut,
            )
        else:
            rows = await conn.fetch(
                f"{_SELECT} ORDER BY t.echeance ASC NULLS LAST, t.created_at DESC"
            )
    return [_serialize(r) for r in rows]


async def create_task(user_id: str, payload: TaskCreate) -> dict:
    categorie_id = str(payload.categorie_id) if payload.categorie_id else None
    await _assert_categorie_valide(user_id, categorie_id)

    async with scoped_connection(user_id) as conn:
        task_id = await conn.fetchval(
            """
            INSERT INTO tasks (user_id, titre, description, priorite, echeance, categorie_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            """,
            user_id,
            payload.titre,
            payload.description,
            payload.priorite,
            payload.echeance,
            categorie_id,
        )
        row = await conn.fetchrow(f"{_SELECT} WHERE t.id = $1", task_id)
    return _serialize(row)


async def update_task(user_id: str, task_id: str, payload: TaskUpdate) -> dict:
    fields = payload.model_dump(exclude_unset=True)
    statut_cible = fields.pop("statut", None)

    async with scoped_connection(user_id) as conn:
        current = await _reload(conn, task_id, user_id)
        if current is None:
            raise not_found("Tâche introuvable.")
        if not fields and statut_cible is None:
            return _serialize(current)

        titre = fields.get("titre", current["titre"])
        description = fields["description"] if "description" in fields else current["description"]
        priorite = fields.get("priorite", current["priorite"])
        echeance = fields["echeance"] if "echeance" in fields else current["echeance"]

        if "categorie_id" in fields:
            categorie_id = str(fields["categorie_id"]) if fields["categorie_id"] else None
            await _assert_categorie_valide(user_id, categorie_id)
        else:
            categorie_id = current["categorie_id"]

        devient_faite = statut_cible == "faite" and current["statut"] != "faite"
        devient_a_faire = statut_cible == "a_faire" and current["statut"] != "a_faire"
        nouveau_statut = statut_cible if statut_cible is not None else current["statut"]

        if devient_faite:
            updated_id = await conn.fetchval(
                """
                UPDATE tasks
                SET titre = $3, description = $4, priorite = $5, echeance = $6,
                    categorie_id = $7, statut = 'faite', completed_at = now(),
                    updated_at = now()
                WHERE id = $1 AND user_id = $2 AND statut <> 'faite'
                RETURNING id
                """,
                task_id,
                user_id,
                titre,
                description,
                priorite,
                echeance,
                categorie_id,
            )
            if updated_id is not None:
                await conn.execute(
                    "INSERT INTO usage_events (user_id, type) VALUES ($1, 'task_completed')",
                    user_id,
                )
            # Si updated_id est None (course perdue : déjà "faite" entre-temps),
            # on ne réémet pas d'usage_event et on relit simplement l'état réel.
            row = await _reload(conn, task_id, user_id)
        else:
            completed_at = None if devient_a_faire else current["completed_at"]
            await conn.execute(
                """
                UPDATE tasks
                SET titre = $3, description = $4, priorite = $5, echeance = $6,
                    categorie_id = $7, statut = $8, completed_at = $9,
                    updated_at = now()
                WHERE id = $1 AND user_id = $2
                """,
                task_id,
                user_id,
                titre,
                description,
                priorite,
                echeance,
                categorie_id,
                nouveau_statut,
                completed_at,
            )
            row = await _reload(conn, task_id, user_id)
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
