"""Suppressions demandées à l'assistant, TOUJOURS en deux temps :

1. `delete` ne supprime rien : il enregistre une suppression « en attente »
   (`delete_pending`, stockée avec le tour de conversation) et demande
   confirmation à l'utilisateur.
2. Au message suivant, `confirm_delete` exécute uniquement les suppressions
   en attente relues EN BASE depuis le dernier tour (`context.pending_deletions`),
   jamais une cible fournie par le LLM : il ne peut pas contourner la
   confirmation ni changer d'élément entre-temps.
"""

from __future__ import annotations

from app.services import events as events_service
from app.services import note_items as note_items_service
from app.services import notes as notes_service
from app.services import tasks as tasks_service

_NOMS = {
    "task": "la tâche",
    "event": "l'événement",
    "note": "la note",
    "note_item": "l'élément",
}

_SUPPRESSEURS = {
    "task": tasks_service.delete_task,
    "event": events_service.delete_event,
    "note": notes_service.delete_note,
    "note_item": note_items_service.delete_item,
}


def request_deletion(target: dict) -> dict:
    nom = f"{_NOMS[target['kind']]} « {target['titre']} »"
    return {
        "type": "delete_pending",
        "ok": True,
        "kind": target["kind"],
        "id": target["id"],
        "titre": target["titre"],
        "label": f"Je supprime {nom} ? Réponds « oui » pour confirmer",
    }


async def confirm_deletions(user_id: str, pending: list[dict]) -> list[dict]:
    if not pending:
        return [{
            "type": "confirm_delete", "ok": False,
            "label": "Aucune suppression n'était en attente de confirmation.",
        }]
    resultats = []
    for item in pending:
        nom = f"{_NOMS[item['kind']]} « {item['titre']} »"
        try:
            await _SUPPRESSEURS[item["kind"]](user_id, item["id"])
            resultats.append({"type": "delete", "ok": True, "label": f"J'ai supprimé {nom}"})
        except Exception:  # élément déjà supprimé, ou partagé (non propriétaire)
            resultats.append({
                "type": "delete", "ok": False,
                "label": f"Je n'ai pas pu supprimer {nom}",
            })
    return resultats


def cancel_deletions(pending: list[dict]) -> dict:
    return {
        "type": "cancel_delete", "ok": True,
        "label": "D'accord, je ne supprime rien" if pending else "Rien à annuler",
    }
