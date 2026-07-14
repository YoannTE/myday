"""Rappels d'événements (Round 009) : notifie `event_reminder_minutes` avant
le début d'un événement, une seule fois (idempotent via unique
`(user_id, ref_id, type)` sur `notifications`).

Requête sur `events`, PAS sur les utilisateurs (correction #6 du plan) :
fenêtre = `[now + minutes - delta, now + minutes + delta]` où `delta` est
l'intervalle du tick, pour ne ni rater ni doubler un rappel entre deux
cycles. Lecture cross-tenant légitime (uniquement id/user_id/titre/debut,
aucun contenu sensible) via `get_admin_pool()`, même pattern que
`google/scheduler.py` et `brief_scheduler.py`. L'INSERT de la notification
est ensuite scopé à `event.user_id` via `scoped_connection` (RLS).
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings
from app.db.client import get_admin_pool, scoped_connection
from app.services.push.sender import dispatch_push

# Le délai est PAR événement (`rappel_avance_minutes` : 60/30/5/0 min avant
# le début, choisi par l'utilisateur ; -1 = aucune notification, exclu ici).
# L'instant cible est `debut - avance`, notifié dans la fenêtre
# [now - delta, now + delta].
_DUE_EVENTS_SQL = """
    SELECT e.id::text AS event_id, e.user_id, e.titre, e.debut
    FROM events e
    WHERE e.rappel_avance_minutes >= 0
      AND (e.debut - e.rappel_avance_minutes * interval '1 minute') BETWEEN
        now() - $1::int * interval '1 minute'
        AND now() + $1::int * interval '1 minute'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.ref_id = e.id AND n.type = 'rappel_evenement'
      )
"""


async def _due_events(delta_minutes: int) -> list[dict]:
    pool = get_admin_pool()
    rows = await pool.fetch(_DUE_EVENTS_SQL, delta_minutes)
    return [dict(r) for r in rows]


def _format_heure(debut: datetime, timezone_str: str) -> str:
    return debut.astimezone(ZoneInfo(timezone_str)).strftime("%H:%M")


async def run_event_reminders(delta_minutes: int) -> int:
    """Un cycle : crée le rappel + push pour chaque événement dû. Retourne le
    nombre de rappels effectivement créés (idempotence garantie en BDD)."""
    events = await _due_events(delta_minutes)
    created = 0
    for event in events:
        contenu = f"{event['titre']} à {_format_heure(event['debut'], settings.app_timezone)}"
        async with scoped_connection(event["user_id"]) as conn:
            result = await conn.execute(
                """
                INSERT INTO notifications (user_id, type, contenu, ref_id)
                VALUES ($1, 'rappel_evenement', $2, $3::uuid)
                ON CONFLICT (user_id, ref_id, type) DO NOTHING
                """,
                event["user_id"], contenu, event["event_id"],
            )
        if not result.endswith(" 1"):
            continue
        created += 1
        try:
            await dispatch_push(
                event["user_id"], "rappel_evenement", "MyDay", contenu, "/planning"
            )
        except Exception:  # best-effort : ne jamais casser le cycle de rappels
            pass
    return created
