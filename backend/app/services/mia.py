"""Lecture « Ma journée » pour l'accès machine de la page MIA (`/api/mia`).

Vue volontairement réduite à ce dont la page MIA a besoin (titres, dates,
noms de catégories), sans identifiants internes ni brief. Tout passe par
`scoped_connection(user_id)` : la RLS s'applique exactement comme pour une
session du site (données propres + éléments partagés avec l'utilisateur).

Mêmes règles que le cockpit (`services/cockpit.py`) :
  - prochains : rendez-vous à venir (`debut >= maintenant`), tri croissant,
    limités à `_PROCHAINS_LIMIT` ;
  - tâches : statut `a_faire`, échéance la plus proche d'abord (sans échéance
    en dernier), puis priorité haute > normale > basse.
Notes : toutes celles qui ne sont pas archivées (le cockpit, lui, ne montre
que les épinglées), dans l'ordre de la page Notes, avec leurs éléments de
liste triés par position.
"""

from __future__ import annotations

from app.db.client import scoped_connection
from app.services.cockpit import _PROCHAINS_LIMIT, _now_local


async def get_journee(user_id: str) -> dict:
    now = _now_local()
    async with scoped_connection(user_id) as conn:
        prochains = await conn.fetch(
            "SELECT e.titre, e.debut, e.fin, e.lieu FROM events e "
            "WHERE e.debut >= $1 ORDER BY e.debut ASC LIMIT $2",
            now, _PROCHAINS_LIMIT,
        )
        taches = await conn.fetch(
            "SELECT t.titre, t.priorite, t.echeance, c.nom AS categorie "
            "FROM tasks t "
            "LEFT JOIN task_categories c ON c.id = t.categorie_id "
            "WHERE t.statut = 'a_faire' "
            "ORDER BY t.echeance ASC NULLS LAST, "
            "CASE t.priorite WHEN 'haute' THEN 0 WHEN 'normale' THEN 1 ELSE 2 END ASC"
        )
        notes = await conn.fetch(
            "SELECT n.id::text, n.titre, n.contenu, n.epinglee, c.nom AS categorie "
            "FROM notes n "
            "LEFT JOIN note_categories c ON c.id = n.categorie_id "
            "WHERE n.archivee = false "
            "ORDER BY n.position ASC NULLS LAST, n.updated_at DESC"
        )
        note_ids = [n["id"] for n in notes]
        items = (
            await conn.fetch(
                "SELECT note_id::text, contenu, coche FROM note_items "
                "WHERE note_id = ANY($1::uuid[]) "
                "ORDER BY position ASC, created_at ASC",
                note_ids,
            )
            if note_ids
            else []
        )

    items_par_note: dict[str, list[dict]] = {nid: [] for nid in note_ids}
    for item in items:
        items_par_note[item["note_id"]].append(
            {"contenu": item["contenu"], "coche": item["coche"]}
        )

    return {
        "prochains": [dict(r) for r in prochains],
        "taches": [dict(r) for r in taches],
        "notes": [
            {
                "titre": n["titre"],
                "categorie": n["categorie"],
                "epinglee": n["epinglee"],
                "contenu": n["contenu"],
                "items": items_par_note[n["id"]],
            }
            for n in notes
        ],
    }
