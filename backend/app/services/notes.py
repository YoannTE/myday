"""Logique métier des notes.

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS). La liste
filtre `archivee` (défaut False), recherche `q` en `ILIKE` sur titre+contenu,
et trie par ordre manuel (`position`) puis par `updated_at` décroissant
(la fonctionnalité épingle a été retirée du produit, cf. `decisions.md`
« Refonte Cockpit unique »).

`categorie_id` est une FK nullable vers `note_categories`. La contrainte FK
Postgres ne vérifie que l'existence de la ligne, PAS son isolation par
`user_id` (elle contourne la RLS) : toute affectation passe donc par
`note_categories_service.category_belongs_to_user` avant d'être écrite.
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.notes import NoteCreate, NoteUpdate
from app.services import note_categories as note_categories_service
from app.services import note_items as note_items_service
from app.services import partages as partages_service
from app.utils.errors import bad_request, not_found

_SELECT = """
    SELECT n.id, n.titre, n.contenu, n.epinglee, n.archivee, n.origine,
           n.categorie_id, n.position, n.created_at, n.updated_at,
           n.user_id AS proprietaire_id, prop.name AS proprietaire_nom,
           c.nom AS categorie_nom, c.couleur AS categorie_couleur
    FROM notes n
    LEFT JOIN "user" prop ON prop.id = n.user_id
    LEFT JOIN note_categories c ON c.id = n.categorie_id
"""

_ORDER_BY = "ORDER BY n.position ASC NULLS LAST, n.updated_at DESC"


def _serialize(row: asyncpg.Record, user_id: str, items: list[dict] | None = None) -> dict:
    categorie = None
    if row["categorie_id"] is not None and row["categorie_nom"] is not None:
        categorie = {
            "id": str(row["categorie_id"]),
            "nom": row["categorie_nom"],
            "couleur": row["categorie_couleur"],
        }
    return {
        "id": str(row["id"]),
        "titre": row["titre"],
        "contenu": row["contenu"],
        "epinglee": row["epinglee"],
        "archivee": row["archivee"],
        "origine": row["origine"],
        "categorie_id": str(row["categorie_id"]) if row["categorie_id"] else None,
        "categorie": categorie,
        "position": row["position"],
        "items": items or [],
        # Round 016 : nom du proprietaire si la note est partagee avec nous.
        "partage_par": row["proprietaire_nom"]
        if row["proprietaire_id"] != user_id
        else None,
        "proprietaire_id": row["proprietaire_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# Champs qu'un NON-proprietaire peut modifier sur une note partagee
# (epingler/archiver/categorie restent des reglages du proprietaire).
_CHAMPS_PARTAGE_NOTE = {"titre", "contenu"}


async def _assert_categorie_valide(user_id: str, categorie_id: str | None) -> None:
    if categorie_id is None:
        return
    appartient = await note_categories_service.category_belongs_to_user(
        user_id, categorie_id
    )
    if not appartient:
        raise bad_request("Catégorie invalide ou appartenant à un autre utilisateur.")


async def list_notes(user_id: str, archivee: bool, q: str | None) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        if q:
            pattern = f"%{q}%"
            rows = await conn.fetch(
                f"""
                {_SELECT}
                WHERE n.archivee = $1 AND (n.titre ILIKE $2 OR n.contenu ILIKE $2)
                {_ORDER_BY}
                """,
                archivee,
                pattern,
            )
        else:
            rows = await conn.fetch(
                f"""
                {_SELECT}
                WHERE n.archivee = $1
                {_ORDER_BY}
                """,
                archivee,
            )
        note_ids = [str(r["id"]) for r in rows]
        items_par_note = await note_items_service.list_for_notes(conn, note_ids)
    return [_serialize(r, user_id, items_par_note.get(str(r["id"]), [])) for r in rows]


async def create_note(user_id: str, payload: NoteCreate) -> dict:
    categorie_id = str(payload.categorie_id) if payload.categorie_id else None
    await _assert_categorie_valide(user_id, categorie_id)

    async with scoped_connection(user_id) as conn:
        note_id = await conn.fetchval(
            """
            INSERT INTO notes (user_id, titre, contenu, categorie_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            user_id,
            payload.titre,
            payload.contenu,
            categorie_id,
        )
        row = await conn.fetchrow(f"{_SELECT} WHERE n.id = $1", note_id)
    return _serialize(row, user_id, [])


async def update_note(user_id: str, note_id: str, payload: NoteUpdate) -> dict:
    fields = payload.model_dump(exclude_unset=True)
    async with scoped_connection(user_id) as conn:
        # Visibilite RLS : la sienne OU partagee avec lui (Round 016 v2).
        current = await conn.fetchrow(
            f"{_SELECT} WHERE n.id = $1", note_id
        )
        if current is None:
            raise not_found("Note introuvable.")
        items = await note_items_service.list_for_note(conn, note_id)
        if not fields:
            return _serialize(current, user_id, items)

        if current["proprietaire_id"] != user_id:
            interdits = set(fields) - _CHAMPS_PARTAGE_NOTE
            if interdits:
                raise bad_request(
                    "Sur une note partagée, tu peux modifier le titre et le "
                    "contenu uniquement."
                )

        titre = fields.get("titre", current["titre"])
        contenu = fields["contenu"] if "contenu" in fields else current["contenu"]
        epinglee = fields.get("epinglee", current["epinglee"])
        archivee = fields.get("archivee", current["archivee"])

        if "categorie_id" in fields:
            categorie_id = (
                str(fields["categorie_id"]) if fields["categorie_id"] else None
            )
            await _assert_categorie_valide(user_id, categorie_id)
        else:
            categorie_id = current["categorie_id"]

        await conn.execute(
            """
            UPDATE notes
            SET titre = $3, contenu = $4, epinglee = $5, archivee = $6,
                categorie_id = $7, updated_at = now()
            WHERE id = $1
              AND (user_id = $2 OR EXISTS (SELECT 1 FROM partages pa
                   WHERE pa.element_type = 'note' AND pa.element_id = notes.id
                   AND pa.cible_id = $2))
            """,
            note_id,
            user_id,
            titre,
            contenu,
            epinglee,
            archivee,
            categorie_id,
        )
        row = await conn.fetchrow(f"{_SELECT} WHERE n.id = $1", note_id)
    return _serialize(row, user_id, items)


async def deplacer_note(user_id: str, note_id: str, direction: str) -> list[dict]:
    """Déplace une note vers le haut/bas dans l'ordre manuel de l'utilisateur
    (Refonte Cockpit unique). Périmètre du déplacement : toutes les notes non
    archivées de l'utilisateur, même ordre que la liste par défaut. No-op si
    la note est déjà en première/dernière position ; renvoie dans tous les cas
    la liste complète des notes (même forme que `GET /api/notes` sans filtre)."""
    async with scoped_connection(user_id) as conn:
        async with conn.transaction():
            note = await conn.fetchrow(
                "SELECT id FROM notes WHERE id = $1 AND user_id = $2",
                note_id,
                user_id,
            )
            if note is None:
                raise not_found("Note introuvable.")

            group = await conn.fetch(
                f"SELECT id::text AS id, position FROM notes n "
                f"WHERE n.user_id = $1 AND n.archivee = false {_ORDER_BY}",
                user_id,
            )
            ordered_ids = [r["id"] for r in group]
            positions_avant = {r["id"]: r["position"] for r in group}

            index = ordered_ids.index(note_id)
            voisin_index = index - 1 if direction == "haut" else index + 1
            if 0 <= voisin_index < len(ordered_ids):
                ordered_ids[index], ordered_ids[voisin_index] = (
                    ordered_ids[voisin_index],
                    ordered_ids[index],
                )

            for position, nid in enumerate(ordered_ids):
                if positions_avant[nid] != position:
                    await conn.execute(
                        "UPDATE notes SET position = $2, updated_at = now() WHERE id = $1",
                        nid,
                        position,
                    )

    return await list_notes(user_id, False, None)


async def delete_note(user_id: str, note_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id",
            note_id,
            user_id,
        )
        if deleted is not None:
            # Round 016 : les partages de l'element suivent sa suppression.
            await partages_service.supprimer_partages_element(
                conn, user_id, "note", note_id
            )
    if deleted is None:
        raise not_found("Note introuvable.")
