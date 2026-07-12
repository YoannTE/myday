"""Alertes déterministes du brief (Round 007) — calcul pur Python, sans appel
LLM ni effet de bord : conflit d'agenda (chevauchement), échéance proche
(< 24 h), synchronisation Google en retard (> 2 h). Le LLM ne fait que
reformuler ces alertes (jamais les inventer) — cf. plan correction #6.
Plafonnées à 3 (borne du schéma `BriefContentModel`).
"""

from __future__ import annotations

from datetime import datetime, timedelta

_MAX_ALERTS = 3
_STALE_SYNC_THRESHOLD = timedelta(hours=2)
_DUE_SOON_THRESHOLD = timedelta(hours=24)


def compute_deterministic_alerts(context: dict, now: datetime) -> list[str]:
    """`now` est fourni par l'appelant (fuseau utilisateur) — la fonction
    reste pure vis-à-vis de son entrée, aucune horloge interne."""
    alerts: list[str] = []
    alerts.extend(_conflict_alerts(context.get("events", [])))
    alerts.extend(_due_soon_alerts(context.get("tasks_today", []), now))
    sync_alert = _sync_alert(context.get("last_sync_at"), now)
    if sync_alert:
        alerts.append(sync_alert)
    return alerts[:_MAX_ALERTS]


def _conflict_alerts(events: list[dict]) -> list[str]:
    alerts = []
    for i, event_a in enumerate(events):
        a_start = datetime.fromisoformat(event_a["start"])
        a_end = datetime.fromisoformat(event_a["end"])
        for event_b in events[i + 1 :]:
            b_start = datetime.fromisoformat(event_b["start"])
            b_end = datetime.fromisoformat(event_b["end"])
            if a_start < b_end and b_start < a_end:
                alerts.append(
                    f"Conflit d'agenda entre « {event_a['title']} » et "
                    f"« {event_b['title']} »."
                )
    return alerts


def _due_soon_alerts(tasks: list[dict], now: datetime) -> list[str]:
    alerts = []
    for task in tasks:
        if task.get("overdue") or not task.get("due"):
            continue
        due = datetime.fromisoformat(task["due"])
        if timedelta(0) <= due - now <= _DUE_SOON_THRESHOLD:
            alerts.append(
                f"Échéance proche : « {task['title']} » attendue dans moins de 24 h."
            )
    return alerts


def _sync_alert(last_sync_at: str | None, now: datetime) -> str | None:
    if not last_sync_at:
        return None
    delta = now - datetime.fromisoformat(last_sync_at)
    if delta <= _STALE_SYNC_THRESHOLD:
        return None
    return f"Données non actualisées depuis {_format_duration(delta)}."


def _format_duration(delta: timedelta) -> str:
    total_hours = int(delta.total_seconds() // 3600)
    if total_hours < 1:
        return "moins d'une heure"
    if total_hours < 24:
        return f"{total_hours} h"
    return f"{total_hours // 24} j"
