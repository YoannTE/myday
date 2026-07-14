"""Rappels de tâches (Round 015), calqués sur `event_reminders`. Deux cas :

1. Rappel manuel (`rappel_at`) : notifie à l'heure choisie, fenêtre
   `[now - 2*delta, now]` (jamais en avance), type `rappel_tache`.
2. Créneau planifié (`planifie_debut`, time-blocking) : notifie
   `event_reminder_minutes` AVANT le début du créneau (même règle que les
   événements), fenêtre `[cible - delta, cible + delta]`, type
   `tache_planifiee`.

Idempotence via l'unique `(user_id, ref_id, type)` sur `notifications` ; si
le rappel ou le créneau est reprogrammé, le service `tasks` supprime la
notification précédente pour permettre une nouvelle alerte. Lecture
cross-tenant légitime (id/user_id/titre/horaire uniquement) via
`get_admin_pool()` ; l'INSERT est ensuite scopé au user (RLS).
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings
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

# Le délai est PAR tâche (`rappel_avance_minutes` : 60/30/5/0 min avant le
# créneau, choisi par l'utilisateur ; -1 = aucune notification, exclu ici).
# Instant cible = planifie_debut - avance.
_DUE_PLANNED_SQL = """
    SELECT t.id::text AS task_id, t.user_id, t.titre, t.planifie_debut
    FROM tasks t
    WHERE t.planifie_debut IS NOT NULL
      AND t.statut = 'a_faire'
      AND t.rappel_avance_minutes >= 0
      AND (t.planifie_debut - t.rappel_avance_minutes * interval '1 minute')
          BETWEEN now() - $1::int * interval '1 minute'
          AND now() + $1::int * interval '1 minute'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.ref_id = t.id AND n.type = 'tache_planifiee'
      )
"""


def _format_heure(debut: datetime) -> str:
    return debut.astimezone(ZoneInfo(settings.app_timezone)).strftime("%H:%M")


async def _fetch_due(sql: str, *params) -> list[dict]:
    pool = get_admin_pool()
    rows = await pool.fetch(sql, *params)
    return [dict(r) for r in rows]


async def _notifier(user_id: str, type_notif: str, contenu: str, ref_id: str) -> bool:
    async with scoped_connection(user_id) as conn:
        result = await conn.execute(
            """
            INSERT INTO notifications (user_id, type, contenu, ref_id)
            VALUES ($1, $2, $3, $4::uuid)
            ON CONFLICT (user_id, ref_id, type) DO NOTHING
            """,
            user_id, type_notif, contenu, ref_id,
        )
    if not result.endswith(" 1"):
        return False
    try:
        # Lien direct vers la tâche concernée (ouvre son détail au clic).
        await dispatch_push(
            user_id, type_notif, "MyDay", contenu, f"/taches?task={ref_id}"
        )
    except Exception:  # best-effort : ne jamais casser le cycle de rappels
        pass
    return True


async def run_task_reminders(delta_minutes: int) -> int:
    """Un cycle : rappels manuels dus + créneaux planifiés imminents. Retourne
    le nombre de notifications créées (idempotence BDD)."""
    created = 0
    for task in await _fetch_due(_DUE_TASKS_SQL, delta_minutes):
        contenu = f"Rappel : {task['titre']}"
        if await _notifier(task["user_id"], "rappel_tache", contenu, task["task_id"]):
            created += 1
    for task in await _fetch_due(_DUE_PLANNED_SQL, delta_minutes):
        contenu = (
            f"Tâche planifiée : {task['titre']} "
            f"à {_format_heure(task['planifie_debut'])}"
        )
        if await _notifier(
            task["user_id"], "tache_planifiee", contenu, task["task_id"]
        ):
            created += 1
    return created
