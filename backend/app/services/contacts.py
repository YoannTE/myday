"""Logique métier des contacts (liens de partage entre comptes, Round 016).

Les lignes `contacts` sont lues/écrites via `scoped_connection` (RLS :
visibles par les deux participants). La recherche d'un utilisateur par email
passe par le pool admin (lookup cross-tenant légitime et minimal : id + nom
uniquement, pour créer le lien — même pattern que `invitations.py`).
"""

import asyncpg

from app.db.client import get_admin_pool, scoped_connection
from app.services.push.sender import dispatch_push
from app.utils.errors import bad_request, conflict, not_found

_SELECT = """
    SELECT c.id::text, c.demandeur_id, c.destinataire_id, c.statut, c.created_at,
           d.name AS demandeur_nom, d.email AS demandeur_email,
           r.name AS destinataire_nom, r.email AS destinataire_email
    FROM contacts c
    JOIN "user" d ON d.id = c.demandeur_id
    JOIN "user" r ON r.id = c.destinataire_id
"""


def _serialize(row: asyncpg.Record, user_id: str) -> dict:
    est_demandeur = row["demandeur_id"] == user_id
    return {
        "id": row["id"],
        "statut": row["statut"],
        "direction": "envoyee" if est_demandeur else "recue",
        "autre_utilisateur": {
            "nom": row["destinataire_nom"] if est_demandeur else row["demandeur_nom"],
            "email": row["destinataire_email"]
            if est_demandeur
            else row["demandeur_email"],
        },
        "created_at": row["created_at"],
    }


async def list_contacts(user_id: str) -> list[dict]:
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(f"{_SELECT} ORDER BY c.created_at DESC")
    return [_serialize(r, user_id) for r in rows]


async def create_contact(user_id: str, email: str) -> dict:
    """Envoie une demande de lien à un autre utilisateur MyDay (par email)."""
    pool = get_admin_pool()
    cible = await pool.fetchrow(
        'SELECT id, name FROM "user" WHERE lower(email) = $1', email
    )
    if cible is None:
        raise not_found(
            "Aucun compte MyDay avec cette adresse. La personne doit d'abord "
            "être invitée sur MyDay."
        )
    if cible["id"] == user_id:
        raise bad_request("Tu ne peux pas t'ajouter toi-même.")

    async with scoped_connection(user_id) as conn:
        existant = await conn.fetchrow(
            "SELECT id FROM contacts WHERE (demandeur_id = $1 AND destinataire_id = $2) "
            "OR (demandeur_id = $2 AND destinataire_id = $1)",
            user_id,
            cible["id"],
        )
        if existant is not None:
            raise conflict("Un lien existe déjà avec cette personne.")
        row = await conn.fetchrow(
            "INSERT INTO contacts (demandeur_id, destinataire_id) VALUES ($1, $2) "
            "RETURNING id::text, created_at",
            user_id,
            cible["id"],
        )

    demandeur_nom = await pool.fetchval('SELECT name FROM "user" WHERE id = $1', user_id)
    contenu = f"{demandeur_nom} souhaite pouvoir partager avec toi"
    async with scoped_connection(cible["id"]) as conn:
        await conn.execute(
            "INSERT INTO notifications (user_id, type, contenu, ref_id) "
            "VALUES ($1, 'contact_demande', $2, $3::uuid) "
            "ON CONFLICT (user_id, ref_id, type) DO NOTHING",
            cible["id"],
            contenu,
            row["id"],
        )
    try:
        await dispatch_push(cible["id"], "contact_demande", "MyDay", contenu, "/reglages")
    except Exception:  # best-effort
        pass

    contacts = await list_contacts(user_id)
    return next(c for c in contacts if c["id"] == row["id"])


async def accept_contact(user_id: str, contact_id: str) -> dict:
    """Le destinataire accepte la demande (le demandeur est notifié)."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "UPDATE contacts SET statut = 'accepte', updated_at = now() "
            "WHERE id = $1::uuid AND destinataire_id = $2 AND statut = 'en_attente' "
            "RETURNING id::text, demandeur_id",
            contact_id,
            user_id,
        )
    if row is None:
        raise not_found("Demande introuvable.")

    pool = get_admin_pool()
    accepteur_nom = await pool.fetchval('SELECT name FROM "user" WHERE id = $1', user_id)
    contenu = f"{accepteur_nom} a accepté ta demande de partage"
    async with scoped_connection(row["demandeur_id"]) as conn:
        await conn.execute(
            "INSERT INTO notifications (user_id, type, contenu, ref_id) "
            "VALUES ($1, 'contact_accepte', $2, $3::uuid) "
            "ON CONFLICT (user_id, ref_id, type) DO NOTHING",
            row["demandeur_id"],
            contenu,
            row["id"],
        )
    try:
        await dispatch_push(
            row["demandeur_id"], "contact_accepte", "MyDay", contenu, "/reglages"
        )
    except Exception:  # best-effort
        pass

    contacts = await list_contacts(user_id)
    return next(c for c in contacts if c["id"] == row["id"])


async def delete_contact(user_id: str, contact_id: str) -> None:
    """Refuse une demande ou rompt un lien : supprime aussi TOUS les partages
    entre les deux comptes (dans les deux sens)."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "DELETE FROM contacts WHERE id = $1::uuid "
            "AND (demandeur_id = $2 OR destinataire_id = $2) "
            "RETURNING demandeur_id, destinataire_id",
            contact_id,
            user_id,
        )
        if row is None:
            raise not_found("Contact introuvable.")
        autre_id = (
            row["destinataire_id"]
            if row["demandeur_id"] == user_id
            else row["demandeur_id"]
        )
        # Nos partages vers l'autre (la RLS de cette connexion couvre nos lignes).
        await conn.execute(
            "DELETE FROM partages WHERE proprietaire_id = $1 AND cible_id = $2",
            user_id,
            autre_id,
        )
    # Les partages de l'autre vers nous (scopés sur l'autre utilisateur).
    async with scoped_connection(autre_id) as conn:
        await conn.execute(
            "DELETE FROM partages WHERE proprietaire_id = $1 AND cible_id = $2",
            autre_id,
            user_id,
        )


async def contact_accepte_entre(user_id: str, autre_id: str) -> bool:
    """Vrai si un lien ACCEPTÉ existe entre les deux comptes (peu importe le sens)."""
    async with scoped_connection(user_id) as conn:
        existe = await conn.fetchval(
            "SELECT 1 FROM contacts WHERE statut = 'accepte' AND ("
            "(demandeur_id = $1 AND destinataire_id = $2) OR "
            "(demandeur_id = $2 AND destinataire_id = $1))",
            user_id,
            autre_id,
        )
    return existe is not None
