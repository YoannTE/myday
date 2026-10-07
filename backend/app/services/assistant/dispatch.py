"""Dispatch déterministe des actions de MODIFICATION / SUPPRESSION / RÉPONSE
planifiées (les créations historiques restent dans `orchestrator._dispatch`).

La référence courte (`ref`) est résolue via `refs` de la vue des données :
une référence inconnue ou du mauvais type est refusée proprement, jamais
d'accès à un élément hors de la vue de l'utilisateur.
"""

from __future__ import annotations

from app.services.assistant import actions_delete
from app.services.assistant.actions_edit import (
    add_note_items_action,
    update_event_action,
    update_note_action,
    update_note_item_action,
)
from app.services.assistant.actions_task_edit import (
    apply_task_changes,
    update_task_action,
)

_EDITEURS = {
    "update_task": ("task", update_task_action),
    "update_event": ("event", update_event_action),
    "update_note": ("note", update_note_action),
    "add_note_items": ("note", add_note_items_action),
    "update_note_item": ("note_item", update_note_item_action),
}

EDIT_TYPES = set(_EDITEURS) | {"delete", "confirm_delete", "cancel_delete", "answer"}

_TASK_EXTRAS = (
    "description", "scheduled_start", "scheduled_end", "reminder_at", "recurrence", "category",
)


def _introuvable(atype: str) -> dict:
    return {
        "type": atype, "ok": False,
        "label": "Je n'ai pas retrouvé l'élément à modifier.",
    }


async def dispatch_edit(
    user_id: str, atype: str, params: dict, refs: dict, pending: list[dict]
) -> list[dict]:
    """Exécute une action d'édition ; renvoie une liste de résultats (une
    confirmation de suppression peut en produire plusieurs)."""
    if atype == "answer":
        return [{"type": "answer", "ok": True, "label": params["text"]}]
    if atype == "confirm_delete":
        return await actions_delete.confirm_deletions(user_id, pending)
    if atype == "cancel_delete":
        return [actions_delete.cancel_deletions(pending)]

    target = refs.get(params.get("ref", ""))
    if atype == "delete":
        return [actions_delete.request_deletion(target)] if target else [_introuvable(atype)]

    kind, editeur = _EDITEURS[atype]
    if target is None or target["kind"] != kind:
        return [_introuvable(atype)]
    return [await editeur(user_id, target, params)]


async def apply_task_extras(user_id: str, result: dict, params: dict) -> dict:
    """Après `create_task` : applique créneau, rappel, répétition... demandés
    dans la même phrase. Un complément refusé n'annule pas la création."""
    extras = {k: params[k] for k in _TASK_EXTRAS if params.get(k)}
    if not extras or not result.get("ok"):
        return result
    try:
        _, details = await apply_task_changes(user_id, result["task_id"], extras)
    except Exception:
        return {**result, "label": f"{result['label']} (sans les détails demandés)"}
    return {**result, "label": f"{result['label']} : {', '.join(details)}"}
