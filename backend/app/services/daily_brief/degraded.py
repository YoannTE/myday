"""Brief dégradé déterministe (Round 007) — CHEMIN NOMINAL tant qu'aucune clé
`ANTHROPIC_API_KEY` n'est configurée : listes brutes assemblées en phrases
simples par template Python, même schéma que le brief rédigé par IA
(compatible UI sans cas spécial, `degraded=true`). Contexte totalement vide
→ brief « journée calme ».
"""

from __future__ import annotations

_GENERIC_HEADLINE = "Voici ta journée en un coup d'œil."
_CALM_HEADLINE = "Journée calme : rien d'urgent à signaler aujourd'hui."


def is_context_empty(context: dict) -> bool:
    return not (
        context["events"] or context["tasks_due"] or context["important_mails"]
    )


def deterministic_priorities(context: dict, max_priorities: int) -> list[str]:
    items = []
    for task in context["tasks_due"]:
        verbe = "Rattraper" if task.get("overdue") else "Terminer"
        items.append(f"{verbe} la tâche « {task['title']} »")
    for mail in context["important_mails"]:
        sujet = mail.get("subject") or "un mail"
        items.append(f"Répondre au mail de {mail['from']} : « {sujet} »")
    if not items:
        items = [f"Te préparer pour « {e['title']} »" for e in context["events"]]
    return items[:max_priorities] or [
        "Profiter d'une journée sans urgence particulière."
    ]


def _schedule_summary(context: dict) -> str:
    events = context["events"]
    if not events:
        return "Aucun évènement prévu aujourd'hui."
    titres = ", ".join(e["title"] for e in events[:3])
    return f"Au programme aujourd'hui : {titres}."


def _tasks_summary(context: dict) -> str:
    tasks = context["tasks_due"]
    if not tasks:
        return "Aucune tâche en attente."
    overdue = sum(1 for t in tasks if t.get("overdue"))
    if overdue:
        return f"{len(tasks)} tâche(s) à traiter, dont {overdue} en retard."
    return f"{len(tasks)} tâche(s) à traiter aujourd'hui."


def _mails_summary(context: dict) -> str:
    mails = context["important_mails"]
    if not mails:
        return "Aucun mail important n'attend de réponse."
    return f"{len(mails)} mail(s) important(s) attend(ent) une réponse."


def build_degraded_brief(context: dict, alerts: list[str], max_priorities: int) -> dict:
    """Assemble un brief déterministe sans IA (même schéma `BriefContent`)."""
    if is_context_empty(context):
        return {
            "headline": _CALM_HEADLINE,
            "priorities": ["Profiter du temps disponible, rien d'urgent aujourd'hui."],
            "schedule_summary": "Aucun évènement prévu aujourd'hui.",
            "tasks_summary": "Aucune tâche en attente.",
            "mails_summary": "Aucun mail important n'attend de réponse.",
            "alerts": alerts[:3],
        }
    return {
        "headline": _GENERIC_HEADLINE,
        "priorities": deterministic_priorities(context, max_priorities),
        "schedule_summary": _schedule_summary(context),
        "tasks_summary": _tasks_summary(context),
        "mails_summary": _mails_summary(context),
        "alerts": alerts[:3],
    }
