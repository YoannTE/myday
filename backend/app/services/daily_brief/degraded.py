"""Brief dégradé déterministe (Round 007) — CHEMIN NOMINAL tant qu'aucune clé
`ANTHROPIC_API_KEY` n'est configurée : listes brutes assemblées en phrases
simples par template Python, même schéma que le brief rédigé par IA
(compatible UI sans cas spécial, `degraded=true`). Contexte totalement vide
→ brief « journée calme ».

Round 014 (F5), notes ajoutées Refonte Cockpit unique : `BRIEF_BLOCK_ORDER`
est la SOURCE UNIQUE de l'ordre de lecture du brief - (a) rendez-vous du
jour, (b) tâches du jour, (c) notes récentes, (d) mails importants (si
actifs). `compose.py` importe cette constante (au lieu de dupliquer l'ordre)
pour garantir que le chemin IA et le chemin dégradé produisent toujours les
mêmes blocs dans le même ordre. Chaque bloc gère explicitement son état vide
(jamais de bloc fantôme). `mails_summary` est OMIS du dict quand
`context["include_mails"]` est faux (retrait temporaire de Google - mails
désactivés par défaut).
"""

from __future__ import annotations

_GENERIC_HEADLINE = "Voici ta journée en un coup d'œil."
_CALM_HEADLINE = "Journée calme : rien d'urgent à signaler aujourd'hui."

# Ordre de lecture naturel du brief (Round 014, F5 ; notes Refonte Cockpit
# unique) : (a) rendez-vous du jour, (b) tâches du jour, (c) notes récentes,
# (d) mails importants. `compose.py` vérifie à l'import que
# `BriefContentModel` respecte ce même ordre (garde-fou anti-divergence).
BRIEF_BLOCK_ORDER: tuple[str, ...] = (
    "schedule_summary", "tasks_summary", "notes_summary", "mails_summary"
)


def is_context_empty(context: dict) -> bool:
    return not (
        context["events"]
        or context["tasks_today"]
        or context.get("notes_recentes")
        or context["important_mails"]
    )


def deterministic_priorities(context: dict, max_priorities: int) -> list[str]:
    items = []
    for task in context["tasks_today"]:
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
    """Bloc (a) : rendez-vous du jour. Vide → phrase explicite (jamais de
    bloc fantôme, cf. spec Round 014 F5)."""
    events = context["events"]
    if not events:
        return "Aucun rendez-vous aujourd'hui."
    titres = ", ".join(e["title"] for e in events[:3])
    return f"Au programme aujourd'hui : {titres}."


def _tasks_summary(context: dict) -> str:
    """Bloc (b) : tâches dont l'échéance tombe aujourd'hui. Vide → « Rien
    d'urgent » (cf. spec Round 014 F5)."""
    tasks = context["tasks_today"]
    if not tasks:
        return "Rien d'urgent aujourd'hui."
    overdue = sum(1 for t in tasks if t.get("overdue"))
    if overdue:
        return f"{len(tasks)} tâche(s) à traiter aujourd'hui, dont {overdue} en retard."
    return f"{len(tasks)} tâche(s) à traiter aujourd'hui."


def _notes_summary(context: dict) -> str:
    """Bloc (c) : notes récentes non archivées de l'utilisateur (0 à 5,
    jamais de bloc fantôme)."""
    notes = context.get("notes_recentes", [])
    if not notes:
        return "Aucune note récente."
    if len(notes) == 1:
        return f"Une note à garder en tête : « {notes[0]['title']} »."
    titres = ", ".join(n["title"] for n in notes[:3])
    return f"{len(notes)} note(s) récente(s) à garder en tête : {titres}."


def mails_summary_fallback(context: dict) -> str:
    """Bloc (d) : jusqu'à 3 mails les plus importants reçus dans les 5
    derniers jours (0 à 3, jamais de bloc fantôme). Exposé publiquement pour
    servir de repli au chemin IA quand le LLM omet `mails_summary` alors que
    les mails sont actifs (cf. `compose.py`)."""
    mails = context["important_mails"]
    if not mails:
        return "Aucun mail important n'attend de réponse."
    return f"{len(mails)} mail(s) important(s) attend(ent) une réponse."


def build_degraded_brief(context: dict, alerts: list[str], max_priorities: int) -> dict:
    """Assemble un brief déterministe sans IA (même schéma `BriefContent`).
    Les blocs de synthèse sont construits dans l'ordre `BRIEF_BLOCK_ORDER`
    via les helpers dédiés - aucune duplication de la logique d'état vide.
    `mails_summary` n'est présent que si `context["include_mails"]` est vrai
    (absent, pas `null`, quand les mails sont désactivés)."""
    if is_context_empty(context):
        headline = _CALM_HEADLINE
        priorities = ["Profiter du temps disponible, rien d'urgent aujourd'hui."]
    else:
        headline = _GENERIC_HEADLINE
        priorities = deterministic_priorities(context, max_priorities)

    brief = {
        "headline": headline,
        "priorities": priorities,
        "schedule_summary": _schedule_summary(context),
        "tasks_summary": _tasks_summary(context),
        "notes_summary": _notes_summary(context),
    }
    if context.get("include_mails"):
        brief["mails_summary"] = mails_summary_fallback(context)
    brief["alerts"] = alerts[:3]
    return brief
