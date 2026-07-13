"""Logique métier des partages (Round 016) : un élément précis (événement,
tâche ou note) partagé en LECTURE SEULE avec un contact accepté.

La lecture côté destinataire est ouverte par les policies RLS `FOR SELECT`
(migration 0019) — aucune écriture possible pour lui (les policies
d'isolation propriétaire restent seules à couvrir INSERT/UPDATE/DELETE).
"""

import asyncpg

from app.db.client import get_admin_pool, scoped_connection
from app.models.partages import PartageCreate
from app.services.push.sender import dispatch_push
from app.utils.errors import bad_request, not_found

# type d'élément -> (table, url de notification côté destinataire)
_ELEMENTS = {
    "event": ("events", "/planning"),
    "task": ("tasks", "/taches"),
    "note": ("notes", "/notes"),
}

_SELECT = """
    SELECT p.id::text, p.element_type, p.element_id::text, p.created_at,
           u.name AS cible_nom, u.email AS cible_email
    FROM partages p
    JOIN "user" u ON u.id = p.cible_id
"""


def _serialize(row: asyncpg.Record) -> dict:
    return {
        "id": row["id"],
        "element_type": row["element_type"],
        "element_id": row["element_id"],
        "cible": {"nom": row["cible_nom"], "email": row["cible_email"]},
        "created_at": row["created_at"],
    }


async def list_for_element(
    user_id: str, element_type: str, element_id: str
) -> list[dict]:
    """Les partages d'un élément, vus par son propriétaire (pour l'UI)."""
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            f"{_SELECT} WHERE p.proprietaire_id = $1 AND p.element_type = $2 "
            "AND p.element_id = $3::uuid ORDER BY p.created_at ASC",
            user_id,
            element_type,
            element_id,
        )
    return [_serialize(r) for r in rows]


async def create_partage(user_id: str, payload: PartageCreate) -> dict:
    table, url = _ELEMENTS[payload.element_type]

    async with scoped_connection(user_id) as conn:
        # 1. Le contact doit exister, être ACCEPTÉ, et impliquer l'utilisateur.
        contact = await conn.fetchrow(
            "SELECT demandeur_id, destinataire_id FROM contacts "
            "WHERE id = $1::uuid AND statut = 'accepte' "
            "AND (demandeur_id = $2 OR destinataire_id = $2)",
            str(payload.contact_id),
            user_id,
        )
        if contact is None:
            raise bad_request("Ce contact n'est pas disponible pour le partage.")
        cible_id = (
            contact["destinataire_id"]
            if contact["demandeur_id"] == user_id
            else contact["demandeur_id"]
        )

        # 2. L'élément doit appartenir à l'utilisateur (filtre user_id explicite :
        #    les policies de partage rendent visibles des lignes d'autrui en
        #    lecture — on ne repartage jamais l'élément d'un autre).
        titre = await conn.fetchval(
            f"SELECT titre FROM {table} WHERE id = $1::uuid AND user_id = $2",
            str(payload.element_id),
            user_id,
        )
        if titre is None:
            raise not_found("Élément introuvable.")

        row = await conn.fetchrow(
            """
            INSERT INTO partages (proprietaire_id, cible_id, element_type, element_id)
            VALUES ($1, $2, $3, $4::uuid)
            ON CONFLICT (proprietaire_id, cible_id, element_type, element_id)
            DO UPDATE SET created_at = partages.created_at
            RETURNING id::text, created_at
            """,
            user_id,
            cible_id,
            payload.element_type,
            str(payload.element_id),
        )

    pool = get_admin_pool()
    proprietaire_nom = await pool.fetchval(
        'SELECT name FROM "user" WHERE id = $1', user_id
    )
    contenu = f"{proprietaire_nom} a partagé « {titre} » avec toi"
    async with scoped_connection(cible_id) as conn:
        await conn.execute(
            "INSERT INTO notifications (user_id, type, contenu, ref_id) "
            "VALUES ($1, 'partage_recu', $2, $3::uuid) "
            "ON CONFLICT (user_id, ref_id, type) DO NOTHING",
            cible_id,
            contenu,
            row["id"],
        )
    try:
        await dispatch_push(cible_id, "partage_recu", "MyDay", contenu, url)
    except Exception:  # best-effort
        pass

    partages = await list_for_element(
        user_id, payload.element_type, str(payload.element_id)
    )
    return next(p for p in partages if p["id"] == row["id"])


async def delete_partage(user_id: str, partage_id: str) -> None:
    """Retire un partage (réservé au propriétaire de l'élément)."""
    async with scoped_connection(user_id) as conn:
        deleted = await conn.fetchval(
            "DELETE FROM partages WHERE id = $1::uuid AND proprietaire_id = $2 "
            "RETURNING id",
            partage_id,
            user_id,
        )
    if deleted is None:
        raise not_found("Partage introuvable.")


async def supprimer_partages_element(
    conn: asyncpg.Connection, user_id: str, element_type: str, element_id: str
) -> None:
    """Nettoie les partages d'un élément au moment de sa suppression (appelé
    par les services events/tasks/notes, dans leur connexion scopée)."""
    await conn.execute(
        "DELETE FROM partages WHERE proprietaire_id = $1 AND element_type = $2 "
        "AND element_id = $3::uuid",
        user_id,
        element_type,
        element_id,
    )
