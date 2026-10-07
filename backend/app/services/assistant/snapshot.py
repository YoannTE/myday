"""`load_snapshot` : vue compacte des données de l'utilisateur (tâches,
événements, notes et leurs éléments de liste) transmise au planificateur,
pour qu'il retrouve l'élément visé par une demande (« décale la tâche
rendez-vous médicaux de mardi ») au lieu de ne savoir que créer.

Chaque élément reçoit une référence courte (T1, E1, N1, I1) : le LLM ne
manipule jamais d'UUID, l'orchestrateur résout la référence via `refs`. Une
référence absente de `refs` (inventée) est simplement refusée.
"""

from __future__ import annotations

from datetime import timedelta

from app.services import events as events_service
from app.services import notes as notes_service
from app.services import tasks as tasks_service
from app.services.assistant.dates_fr import heure_fr, jour_fr, maintenant, moment_fr

_EVENTS_PASSES_JOURS = 14
_EVENTS_FUTURS_JOURS = 120
_TACHES_FAITES_JOURS = 14
_MAX_EVENTS = 200
_MAX_TACHES = 200
_MAX_ITEMS_PAR_NOTE = 40
_EXTRAIT_NOTE = 300


def _ligne_tache(ref: str, t: dict) -> str:
    morceaux = [f"{ref} | « {t['titre']} »", "faite" if t["statut"] == "faite" else "à faire"]
    if t["echeance"]:
        morceaux.append(f"échéance {jour_fr(t['echeance'])}")
    if t["planifie_debut"] and t["planifie_fin"]:
        morceaux.append(
            f"créneau {moment_fr(t['planifie_debut'])}-{heure_fr(t['planifie_fin'])}"
        )
    morceaux.append(f"priorité {t['priorite']}")
    if t["categorie"]:
        morceaux.append(f"catégorie {t['categorie']['nom']}")
    if t["recurrence"] != "aucune":
        morceaux.append(f"répétition {t['recurrence']}")
    if t["rappel_at"]:
        morceaux.append(f"rappel {moment_fr(t['rappel_at'])}")
    if t["description"]:
        morceaux.append(f"description : {t['description'][:150]}")
    if t["partage_par"]:
        morceaux.append(f"partagée par {t['partage_par']}")
    return " | ".join(morceaux)


def _ligne_event(ref: str, e: dict) -> str:
    morceaux = [f"{ref} | « {e['titre']} »", f"{moment_fr(e['debut'])} → {moment_fr(e['fin'])}"]
    if e["lieu"]:
        morceaux.append(f"lieu {e['lieu']}")
    if e["description"]:
        morceaux.append(f"description : {e['description'][:150]}")
    if e["partage_par"]:
        morceaux.append(f"partagé par {e['partage_par']}")
    return " | ".join(morceaux)


def _ref(refs: dict, prefixe: str, kind: str, element_id: str, titre: str) -> str:
    ref = f"{prefixe}{sum(1 for v in refs.values() if v['kind'] == kind) + 1}"
    refs[ref] = {"kind": kind, "id": str(element_id), "titre": titre}
    return ref


async def load_snapshot(user_id: str) -> dict:
    now = maintenant()
    refs: dict[str, dict] = {}

    a_faire = await tasks_service.list_tasks(user_id, "a_faire")
    faites = [
        t for t in await tasks_service.list_tasks(user_id, "faite")
        if t["completed_at"] and t["completed_at"] >= now - timedelta(days=_TACHES_FAITES_JOURS)
    ]
    lignes_taches = [
        _ligne_tache(_ref(refs, "T", "task", t["id"], t["titre"]), t)
        for t in (a_faire + faites)[:_MAX_TACHES]
    ]

    events = await events_service.list_events(
        user_id,
        now - timedelta(days=_EVENTS_PASSES_JOURS),
        now + timedelta(days=_EVENTS_FUTURS_JOURS),
    )
    lignes_events = [
        _ligne_event(_ref(refs, "E", "event", e["id"], e["titre"]), e)
        for e in events[:_MAX_EVENTS]
    ]

    lignes_notes: list[str] = []
    for n in await notes_service.list_notes(user_id, archivee=False, q=None):
        ligne = f"{_ref(refs, 'N', 'note', n['id'], n['titre'])} | « {n['titre']} »"
        if n["epinglee"]:
            ligne += " | épinglée"
        if n["contenu"]:
            ligne += f" | contenu : {n['contenu'][:_EXTRAIT_NOTE]}"
        lignes_notes.append(ligne)
        for item in n["items"][:_MAX_ITEMS_PAR_NOTE]:
            ref_item = _ref(refs, "I", "note_item", item["id"], item["contenu"])
            coche = "x" if item["coche"] else " "
            lignes_notes.append(f"    {ref_item} [{coche}] {item['contenu']}")

    texte = (
        "TÂCHES :\n" + ("\n".join(lignes_taches) or "(aucune)")
        + "\n\nÉVÉNEMENTS DU PLANNING :\n" + ("\n".join(lignes_events) or "(aucun)")
        + "\n\nNOTES (et éléments de liste, [x] = coché) :\n"
        + ("\n".join(lignes_notes) or "(aucune)")
    )
    return {"text": texte, "refs": refs}
