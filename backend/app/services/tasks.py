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

import calendar
from datetime import datetime, timedelta, timezone

import asyncpg

from app.db.client import scoped_connection
from app.models.tasks import TaskCreate, TaskPlanifier, TaskUpdate
from app.services import partages as partages_service
from app.services import task_categories as task_categories_service
from app.utils.errors import bad_request, not_found

_SELECT = """
    SELECT t.id, t.titre, t.description, t.priorite, t.echeance, t.categorie_id,
           t.statut, t.origine, t.mail_id, t.recurrence, t.rappel_at,
           t.planifie_debut, t.planifie_fin, t.rappel_avance_minutes,
           t.completed_at, t.created_at, t.updated_at,
           t.user_id AS proprietaire_id, prop.name AS proprietaire_nom,
           c.nom AS categorie_nom, c.couleur AS categorie_couleur
    FROM tasks t
    LEFT JOIN "user" prop ON prop.id = t.user_id
    LEFT JOIN task_categories c ON c.id = t.categorie_id
"""


def _ajouter_mois(dt: datetime, n: int) -> datetime:
    """Ajoute `n` mois en bornant le jour au dernier jour du mois cible
    (ex. 31 janvier + 1 mois -> 28/29 février)."""
    index = dt.month - 1 + n
    annee = dt.year + index // 12
    mois = index % 12 + 1
    jour = min(dt.day, calendar.monthrange(annee, mois)[1])
    return dt.replace(year=annee, month=mois, day=jour)


def _prochaine_echeance(echeance: datetime | None, recurrence: str) -> datetime:
    """Calcule la prochaine échéance d'une tâche récurrente. On avance depuis
    l'échéance si elle est future, sinon depuis maintenant (une tâche en retard
    repart donc dans le futur, jamais coincée dans le passé)."""
    maintenant = datetime.now(timezone.utc)
    base = echeance if echeance is not None and echeance > maintenant else maintenant
    if recurrence == "quotidienne":
        return base + timedelta(days=1)
    if recurrence == "hebdomadaire":
        return base + timedelta(days=7)
    if recurrence == "mensuelle":
        return _ajouter_mois(base, 1)
    return base


def _serialize(row: asyncpg.Record, user_id: str) -> dict:
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
        "recurrence": row["recurrence"],
        "rappel_at": row["rappel_at"],
        "planifie_debut": row["planifie_debut"],
        "planifie_fin": row["planifie_fin"],
        "rappel_avance_minutes": row["rappel_avance_minutes"],
        # Round 016 : nom du proprietaire si la tache est partagee avec nous.
        "partage_par": row["proprietaire_nom"]
        if row["proprietaire_id"] != user_id
        else None,
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
    return [_serialize(r, user_id) for r in rows]


async def create_task(user_id: str, payload: TaskCreate) -> dict:
    categorie_id = str(payload.categorie_id) if payload.categorie_id else None
    await _assert_categorie_valide(user_id, categorie_id)

    async with scoped_connection(user_id) as conn:
        task_id = await conn.fetchval(
            """
            INSERT INTO tasks
                (user_id, titre, description, priorite, echeance, categorie_id,
                 recurrence, rappel_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
            """,
            user_id,
            payload.titre,
            payload.description,
            payload.priorite,
            payload.echeance,
            categorie_id,
            payload.recurrence,
            payload.rappel_at,
        )
        row = await conn.fetchrow(f"{_SELECT} WHERE t.id = $1", task_id)
    return _serialize(row, user_id)


async def update_task(user_id: str, task_id: str, payload: TaskUpdate) -> dict:
    fields = payload.model_dump(exclude_unset=True)
    statut_cible = fields.pop("statut", None)

    async with scoped_connection(user_id) as conn:
        current = await _reload(conn, task_id, user_id)
        if current is None:
            raise not_found("Tâche introuvable.")
        if not fields and statut_cible is None:
            return _serialize(current, user_id)

        titre = fields.get("titre", current["titre"])
        description = fields["description"] if "description" in fields else current["description"]
        priorite = fields.get("priorite", current["priorite"])
        echeance = fields["echeance"] if "echeance" in fields else current["echeance"]
        recurrence = fields.get("recurrence", current["recurrence"])
        rappel_at = fields["rappel_at"] if "rappel_at" in fields else current["rappel_at"]

        if "categorie_id" in fields:
            categorie_id = str(fields["categorie_id"]) if fields["categorie_id"] else None
            await _assert_categorie_valide(user_id, categorie_id)
        else:
            categorie_id = current["categorie_id"]

        # Rappel modifié : on retire la notification précédente pour qu'une
        # nouvelle alerte parte à la nouvelle heure (sinon l'unique
        # (user_id, ref_id, type) bloquerait toute re-notification).
        if "rappel_at" in fields and fields["rappel_at"] != current["rappel_at"]:
            await conn.execute(
                "DELETE FROM notifications "
                "WHERE user_id = $1 AND ref_id = $2::uuid AND type = 'rappel_tache'",
                user_id,
                task_id,
            )

        devient_faite = statut_cible == "faite" and current["statut"] != "faite"
        devient_a_faire = statut_cible == "a_faire" and current["statut"] != "a_faire"
        nouveau_statut = statut_cible if statut_cible is not None else current["statut"]

        if devient_faite and recurrence != "aucune":
            # Tâche récurrente cochée : au lieu de la marquer « faite », on la
            # reprogramme à la prochaine échéance et elle reste « à faire ». Le
            # pointage compte comme une occurrence terminée (usage_event).
            nouvelle_echeance = _prochaine_echeance(echeance, recurrence)
            updated_id = await conn.fetchval(
                """
                UPDATE tasks
                SET titre = $3, description = $4, priorite = $5, echeance = $6,
                    categorie_id = $7, recurrence = $8, rappel_at = $9,
                    statut = 'a_faire', completed_at = NULL, updated_at = now()
                WHERE id = $1 AND user_id = $2 AND statut <> 'faite'
                RETURNING id
                """,
                task_id,
                user_id,
                titre,
                description,
                priorite,
                nouvelle_echeance,
                categorie_id,
                recurrence,
                rappel_at,
            )
            if updated_id is not None:
                await conn.execute(
                    "INSERT INTO usage_events (user_id, type) VALUES ($1, 'task_completed')",
                    user_id,
                )
            row = await _reload(conn, task_id, user_id)
        elif devient_faite:
            updated_id = await conn.fetchval(
                """
                UPDATE tasks
                SET titre = $3, description = $4, priorite = $5, echeance = $6,
                    categorie_id = $7, recurrence = $8, rappel_at = $9,
                    statut = 'faite', completed_at = now(), updated_at = now()
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
                recurrence,
                rappel_at,
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
                    categorie_id = $7, recurrence = $8, rappel_at = $9,
                    statut = $10, completed_at = $11, updated_at = now()
                WHERE id = $1 AND user_id = $2
                """,
                task_id,
                user_id,
                titre,
                description,
                priorite,
                echeance,
                categorie_id,
                recurrence,
                rappel_at,
                nouveau_statut,
                completed_at,
            )
            row = await _reload(conn, task_id, user_id)
    return _serialize(row, user_id)


async def planifier_task(
    user_id: str, task_id: str, payload: TaskPlanifier
) -> dict:
    """Réserve un créneau (planifie_debut/fin) pour faire la tâche (time-blocking)."""
    if payload.fin <= payload.debut:
        raise bad_request("L'heure de fin doit être après l'heure de début.")
    async with scoped_connection(user_id) as conn:
        updated = await conn.fetchval(
            """
            UPDATE tasks
            SET planifie_debut = $3, planifie_fin = $4,
                rappel_avance_minutes = $5, updated_at = now()
            WHERE id = $1 AND user_id = $2
            RETURNING id
            """,
            task_id,
            user_id,
            payload.debut,
            payload.fin,
            payload.rappel_avance_minutes,
        )
        if updated is None:
            raise not_found("Tâche introuvable.")
        # Replanification : on retire la notification du créneau précédent pour
        # qu'une nouvelle alerte parte avant le nouveau créneau (l'unique
        # (user_id, ref_id, type) bloquerait sinon toute nouvelle notification).
        await conn.execute(
            "DELETE FROM notifications "
            "WHERE user_id = $1 AND ref_id = $2::uuid AND type = 'tache_planifiee'",
            user_id,
            task_id,
        )
        row = await _reload(conn, task_id, user_id)
    return _serialize(row, user_id)


async def deplanifier_task(user_id: str, task_id: str) -> dict:
    """Retire la tâche du planning (planifie_debut/fin repassent à NULL)."""
    async with scoped_connection(user_id) as conn:
        updated = await conn.fetchval(
            """
            UPDATE tasks
            SET planifie_debut = NULL, planifie_fin = NULL, updated_at = now()
            WHERE id = $1 AND user_id = $2
            RETURNING id
            """,
            task_id,
            user_id,
        )
        if updated is None:
            raise not_found("Tâche introuvable.")
        row = await _reload(conn, task_id, user_id)
    return _serialize(row, user_id)


async def list_planned_tasks(
    user_id: str, date_from: datetime, date_to: datetime
) -> list[dict]:
    """Tâches ayant un créneau planifié qui chevauche la fenêtre [from, to]."""
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            f"{_SELECT} "
            "WHERE t.planifie_debut IS NOT NULL "
            "AND t.planifie_fin >= $1 AND t.planifie_debut <= $2 "
            "ORDER BY t.planifie_debut ASC",
            date_from,
            date_to,
        )
    return [_serialize(r, user_id) for r in rows]


async def delete_task(user_id: str, task_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id",
            task_id,
            user_id,
        )
        if deleted is not None:
            # Round 016 : les partages de l'element suivent sa suppression.
            await partages_service.supprimer_partages_element(
                conn, user_id, "task", task_id
            )
    if deleted is None:
        raise not_found("Tâche introuvable.")
