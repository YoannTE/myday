"""Modification d'une tâche par l'assistant (titre, échéance, statut,
créneau dans le planning, rappel, répétition, catégorie...). Délègue aux
services du socle (`tasks.update_task`, `planifier_task`, `deplanifier_task`)
pour garder exactement les mêmes règles que l'interface (partage,
récurrence cochée, notifications replanifiées).

Aussi utilisé juste après une création (`create_task`) pour appliquer les
compléments demandés dans la même phrase (« ... jeudi à 21h »).
"""

from __future__ import annotations

from datetime import timedelta

from app.models.tasks import TaskPlanifier, TaskUpdate
from app.services import task_categories as task_categories_service
from app.services import tasks as tasks_service
from app.services.assistant.dates_fr import (
    heure_fr,
    jour_fr,
    moment_fr,
    parse_due_date,
    parse_local_datetime,
)

_DUREE_CRENEAU_DEFAUT = timedelta(hours=1)


async def _categorie_id(user_id: str, nom: str | None) -> str | None:
    if nom is None:
        return None
    for categorie in await task_categories_service.list_categories(user_id):
        if categorie["nom"].strip().lower() == nom.strip().lower():
            return str(categorie["id"])
    raise ValueError(f"Catégorie « {nom} » introuvable")


async def apply_task_changes(user_id: str, task_id: str, changes: dict) -> tuple[dict, list[str]]:
    """Applique `changes` (champs déjà validés, seuls ceux envoyés) et renvoie
    la tâche à jour + la liste des changements lisibles pour la confirmation."""
    fields: dict = {}
    details: list[str] = []
    if "title" in changes:
        fields["titre"] = changes["title"]
        details.append(f"renommée « {changes['title']} »")
    if "description" in changes:
        fields["description"] = changes["description"]
        details.append("description mise à jour")
    if "priority" in changes:
        fields["priorite"] = changes["priority"]
        details.append(f"priorité {changes['priority']}")
    if "recurrence" in changes:
        fields["recurrence"] = changes["recurrence"] or "aucune"
        details.append(f"répétition {fields['recurrence']}")
    if "category" in changes:
        fields["categorie_id"] = await _categorie_id(user_id, changes["category"])
        details.append(f"catégorie {changes['category'] or 'retirée'}")
    if "reminder_at" in changes:
        rappel = changes["reminder_at"]
        fields["rappel_at"] = parse_local_datetime(rappel) if rappel else None
        details.append(f"rappel {moment_fr(fields['rappel_at'])}" if rappel else "rappel retiré")

    debut_creneau = changes.get("scheduled_start")
    if "due" in changes:
        fields["echeance"] = parse_due_date(changes["due"]) if changes["due"] else None
    elif debut_creneau:
        # Un créneau sans date limite explicite : l'échéance suit le jour du créneau.
        fields["echeance"] = parse_due_date(debut_creneau[:10])
    if "echeance" in fields:
        details.append(
            f"échéance {jour_fr(fields['echeance'])}" if fields["echeance"] else "échéance retirée"
        )
    if "status" in changes:
        fields["statut"] = changes["status"]
        details.append("cochée" if changes["status"] == "faite" else "décochée")

    task = await tasks_service.update_task(user_id, task_id, TaskUpdate(**fields))

    if "scheduled_start" in changes:
        if debut_creneau:
            debut = parse_local_datetime(debut_creneau)
            fin_brute = changes.get("scheduled_end")
            fin = parse_local_datetime(fin_brute) if fin_brute else debut + _DUREE_CRENEAU_DEFAUT
            if fin <= debut:
                fin = debut + _DUREE_CRENEAU_DEFAUT
            task = await tasks_service.planifier_task(
                user_id, task_id,
                TaskPlanifier(debut=debut, fin=fin, rappel_avance_minutes=task["rappel_avance_minutes"]),
            )
            details.append(f"placée dans le planning {moment_fr(debut)}-{heure_fr(fin)}")
        else:
            task = await tasks_service.deplanifier_task(user_id, task_id)
            details.append("retirée du planning")
    return task, details


async def update_task_action(user_id: str, target: dict, params: dict) -> dict:
    changes = {k: v for k, v in params.items() if k != "ref"}
    task, details = await apply_task_changes(user_id, target["id"], changes)
    resume = ", ".join(details) or "inchangée"
    return {
        "type": "update_task", "ok": True, "task_id": task["id"],
        "label": f"Tâche « {task['titre']} » : {resume}",
    }
