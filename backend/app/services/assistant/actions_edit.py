"""Modification d'événements, de notes et d'éléments de liste par
l'assistant. Délègue aux services du socle (mêmes règles que l'interface :
partage, synchronisation, notifications). `target` est l'élément résolu
depuis la référence courte de la vue des données (`snapshot.refs`).
"""

from __future__ import annotations

from app.models.events import EventUpdate
from app.models.note_items import NoteItemCreate, NoteItemUpdate
from app.models.notes import NoteUpdate
from app.services import events as events_service
from app.services import note_items as note_items_service
from app.services import notes as notes_service
from app.services.assistant.dates_fr import moment_fr, parse_local_datetime


async def update_event_action(user_id: str, target: dict, params: dict) -> dict:
    current = await events_service.get_event(user_id, target["id"])
    fields: dict = {}
    details: list[str] = []
    if "title" in params:
        fields["titre"] = params["title"]
        details.append(f"renommé « {params['title']} »")
    if params.get("start"):
        debut = parse_local_datetime(params["start"])
        fields["debut"] = debut
        # Sans nouvelle fin, l'événement garde sa durée d'origine.
        fields["fin"] = (
            parse_local_datetime(params["end"]) if params.get("end")
            else debut + (current["fin"] - current["debut"])
        )
        details.append(f"déplacé au {moment_fr(debut)}")
    elif params.get("end"):
        fields["fin"] = parse_local_datetime(params["end"])
        details.append(f"se termine le {moment_fr(fields['fin'])}")
    if "location" in params:
        fields["lieu"] = params["location"]
        details.append(f"lieu {params['location']}" if params["location"] else "lieu retiré")
    if "description" in params:
        fields["description"] = params["description"]
        details.append("description mise à jour")

    event = await events_service.update_event(user_id, target["id"], EventUpdate(**fields))
    return {
        "type": "update_event", "ok": True, "event_id": event["id"],
        "label": f"Événement « {event['titre']} » : {', '.join(details) or 'inchangé'}",
    }


async def update_note_action(user_id: str, target: dict, params: dict) -> dict:
    fields: dict = {}
    details: list[str] = []
    if "title" in params:
        fields["titre"] = params["title"]
        details.append(f"renommée « {params['title']} »")
    if "content" in params:
        fields["contenu"] = params["content"]
        details.append("contenu réécrit")
    elif params.get("append"):
        notes = await notes_service.list_notes(user_id, archivee=False, q=None)
        actuel = next((n["contenu"] for n in notes if n["id"] == target["id"]), None) or ""
        fields["contenu"] = f"{actuel}\n{params['append']}".strip()
        details.append("texte ajouté")
    if "pinned" in params:
        fields["epinglee"] = params["pinned"]
        details.append("épinglée" if params["pinned"] else "désépinglée")
    if "archived" in params:
        fields["archivee"] = params["archived"]
        details.append("archivée" if params["archived"] else "désarchivée")

    note = await notes_service.update_note(user_id, target["id"], NoteUpdate(**fields))
    return {
        "type": "update_note", "ok": True, "note_id": note["id"],
        "label": f"Note « {note['titre']} » : {', '.join(details) or 'inchangée'}",
    }


async def add_note_items_action(user_id: str, target: dict, params: dict) -> dict:
    for contenu in params["items"]:
        await note_items_service.create_item(user_id, target["id"], NoteItemCreate(contenu=contenu))
    liste = ", ".join(f"« {c} »" for c in params["items"])
    return {
        "type": "add_note_items", "ok": True, "note_id": target["id"],
        "label": f"Ajouté à « {target['titre']} » : {liste}",
    }


async def update_note_item_action(user_id: str, target: dict, params: dict) -> dict:
    fields = {}
    if "content" in params:
        fields["contenu"] = params["content"]
    if "checked" in params:
        fields["coche"] = params["checked"]
    item = await note_items_service.update_item(user_id, target["id"], NoteItemUpdate(**fields))
    if "checked" in params and "content" not in params:
        verbe = "coché" if params["checked"] else "décoché"
        label = f"« {item['contenu']} » {verbe}"
    else:
        label = f"Élément « {target['titre']} » modifié en « {item['contenu']} »"
    return {"type": "update_note_item", "ok": True, "item_id": item["id"], "label": label}
