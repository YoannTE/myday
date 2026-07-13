"""Rappels de tâches (Round 015) : notifie à l'heure du rappel (`rappel_at`)
d'une tâche encore à faire, une seule fois (idempotent via l'unique
`(user_id, ref_id, type)` sur `notifications`). Calqué sur `event_reminders`.

Fenêtre = `[now - 2*delta, now]` : on notifie quand l'heure du rappel vient de
passer (jamais en avance), en couvrant l'écart entre deux ticks. Lecture
cross-tenant légitime (id/user_id/titre uniquement, aucun contenu sensible)
via `get_admin_pool()` ; l'INSERT de la notification est ensuite scopé à
`task.user_id` (RLS).
"""

from __future__ import annotations

from app.db.client import get_admin_pool, scoped_connection
from app.services.push.sender import dispatch_push

_DUE_TASKS_SQL = """
    SELECT t.id::text AS task_id, t.user_id, t.titre
    FROM tasks t
    WHERE t.rappel_at IS NOT NULL
      AND t.statut = 'a_faire'
      AND t.rappel_at BETWEEN
          now() - ($1::int * 2) * interval '1 minute' AND now()
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.ref_id = t.id AND n.type = 'rappel_tache'
      )
"""


async def _due_tasks(delta_minutes: int) -> list[dict]:
    pool = get_admin_pool()
    rows = await pool.fetch(_DUE_TASKS_SQL, delta_minutes)
    return [dict(r) for r in rows]


async def run_task_reminders(delta_minutes: int) -> int:
    """Un cycle : crée le rappel + push pour chaque tâche dont l'heure de rappel
    vient d'arriver. Retourne le nombre de rappels créés (idempotence BDD)."""
    tasks = await _due_tasks(delta_minutes)
    created = 0
    for task in tasks:
        contenu = f"Rappel : {task['titre']}"
        async with scoped_connection(task["user_id"]) as conn:
            result = await conn.execute(
                """
                INSERT INTO notifications (user_id, type, contenu, ref_id)
                VALUES ($1, 'rappel_tache', $2, $3::uuid)
                ON CONFLICT (user_id, ref_id, type) DO NOTHING
                """,
                task["user_id"], contenu, task["task_id"],
            )
        if not result.endswith(" 1"):
            continue
        created += 1
        try:
            await dispatch_push(
                task["user_id"], "rappel_tache", "Rappel", contenu, "/taches"
            )
        except Exception:  # best-effort : ne jamais casser le cycle de rappels
            pass
    return created
