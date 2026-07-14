"""Logique metier des evenements (CRUD local + synchronisation Google best-effort).

Toutes les lectures/ecritures passent par `scoped_connection(user_id)` (RLS).
La remontee/mise a jour/suppression cote Google est deleguee a
`services/events_google.py`, qui reutilise le socle Round 003.
"""

from __future__ import annotations

from datetime import datetime

from app.config import settings
from app.db.client import scoped_connection
from app.db.google_connection import get_connection
from app.models.events import EventCreate, EventUpdate
from app.services import event_categories as event_categories_service
from app.services import events_google
from app.services import partages as partages_service
from app.utils.errors import bad_request, not_found

_SELECT = """
    SELECT e.id::text, e.titre, e.debut, e.fin, e.lieu, e.description,
           e.google_event_id, e.source, e.sync_status, e.categorie_id::text,
           e.rappel_avance_minutes, e.created_at, e.updated_at,
           e.user_id AS proprietaire_id, prop.name AS proprietaire_nom,
           c.nom AS categorie_nom, c.couleur AS categorie_couleur
    FROM events e
    LEFT JOIN "user" prop ON prop.id = e.user_id
    LEFT JOIN event_categories c ON c.id = e.categorie_id
"""


def _serialize(row, user_id: str) -> dict:
    categorie = None
    if row["categorie_id"] is not None and row["categorie_nom"] is not None:
        categorie = {
            "id": row["categorie_id"],
            "nom": row["categorie_nom"],
            "couleur": row["categorie_couleur"],
        }
    return {
        "id": row["id"],
        "titre": row["titre"],
        "debut": row["debut"],
        "fin": row["fin"],
        "lieu": row["lieu"],
        "description": row["description"],
        "google_event_id": row["google_event_id"],
        "source": row["source"],
        "sync_status": row["sync_status"],
        "categorie_id": row["categorie_id"],
        "categorie": categorie,
        "rappel_avance_minutes": row["rappel_avance_minutes"],
        # Round 016 : nom du proprietaire si l'element est partage avec nous.
        "partage_par": row["proprietaire_nom"]
        if row["proprietaire_id"] != user_id
        else None,
        # Usage interne (push Google via la connexion du proprietaire) —
        # ignore par EventResponse (extra='ignore' par defaut en Pydantic v2).
        "proprietaire_id": row["proprietaire_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# Prédicat « je peux modifier » : je suis proprietaire OU l'element est
# partage avec moi (partage collaboratif, Round 016 v2). La suppression,
# elle, reste filtree proprietaire uniquement.
_PEUT_MODIFIER = (
    "(e.user_id = {p} OR EXISTS (SELECT 1 FROM partages pa "
    "WHERE pa.element_type = 'event' AND pa.element_id = e.id "
    "AND pa.cible_id = {p}))"
)

# Champs qu'un NON-proprietaire peut modifier sur un evenement partage. Les
# reglages personnels (categorie du proprietaire, delai de notification)
# restent au proprietaire.
_CHAMPS_PARTAGE_EVENT = {"titre", "debut", "fin", "lieu", "description"}


async def _assert_categorie_valide(user_id: str, categorie_id: str | None) -> None:
    if categorie_id is None:
        return
    appartient = await event_categories_service.category_belongs_to_user(
        user_id, categorie_id
    )
    if not appartient:
        raise bad_request("Catégorie invalide ou appartenant à un autre utilisateur.")


def _check_window(date_from: datetime | None, date_to: datetime | None) -> None:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise bad_request("La date de debut de la fenetre doit preceder la date de fin.")


async def list_events(
    user_id: str, date_from: datetime | None, date_to: datetime | None
) -> list[dict]:
    """Liste les evenements, filtres par chevauchement avec la fenetre [date_from, date_to].

    Chevauchement (et non `debut BETWEEN ...`) pour conserver les evenements
    multi-jours ou demarres avant la borne basse (Round 013).
    """
    _check_window(date_from, date_to)
    # Round 016 : plus de filtre user_id explicite ici — la RLS renvoie les
    # evenements de l'utilisateur PLUS ceux partages avec lui (policy
    # events_partages_select, lecture seule).
    conditions = ["TRUE"]
    params: list = []
    if date_from is not None:
        params.append(date_from)
        conditions.append(f"e.fin >= ${len(params)}")
    if date_to is not None:
        params.append(date_to)
        conditions.append(f"e.debut <= ${len(params)}")
    where = " AND ".join(conditions)
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            f"{_SELECT} WHERE {where} ORDER BY e.debut ASC",
            *params,
        )
    return [_serialize(r, user_id) for r in rows]


async def get_event_counts(
    user_id: str, date_from: datetime, date_to: datetime
) -> list[dict]:
    """Agrege le nombre d'evenements par jour civil (fuseau applicatif).

    Utilise pour les vues mois/annee du planning : ne charge jamais les
    evenements complets, seulement un `GROUP BY jour, COUNT`. Meme filtre de
    chevauchement que `list_events` pour rester coherent (Round 013).
    """
    _check_window(date_from, date_to)
    # Round 016 : pas de filtre user_id — la RLS inclut les evenements partages.
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(
            """
            SELECT (date_trunc('day', debut AT TIME ZONE $3))::date AS jour,
                   count(*) AS count
            FROM events
            WHERE fin >= $1 AND debut <= $2
            GROUP BY jour
            ORDER BY jour
            """,
            date_from, date_to, settings.app_timezone,
        )
    return [{"jour": r["jour"].isoformat(), "count": r["count"]} for r in rows]


async def _fetch_event(user_id: str, event_id: str) -> dict | None:
    """Retourne l'evenement s'il est visible pour l'utilisateur (le sien OU
    partage avec lui — la RLS fait foi)."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"{_SELECT} WHERE e.id = $1::uuid",
            event_id,
        )
    return _serialize(row, user_id) if row is not None else None


async def create_event(user_id: str, payload: EventCreate) -> dict:
    if payload.fin <= payload.debut:
        raise bad_request("La date de fin doit etre apres la date de debut.")

    categorie_id = str(payload.categorie_id) if payload.categorie_id else None
    await _assert_categorie_valide(user_id, categorie_id)

    connected = await get_connection(user_id) is not None
    sync_status = "sync_pending" if connected else "synced"

    async with scoped_connection(user_id) as conn:
        event_id = await conn.fetchval(
            """
            INSERT INTO events (user_id, titre, debut, fin, lieu, description,
                                 source, sync_status, categorie_id,
                                 rappel_avance_minutes)
            VALUES ($1, $2, $3, $4, $5, $6, 'myday', $7, $8, $9)
            RETURNING id::text
            """,
            user_id, payload.titre, payload.debut, payload.fin,
            payload.lieu, payload.description, sync_status, categorie_id,
            payload.rappel_avance_minutes,
        )
    event = await _fetch_event(user_id, event_id)

    if connected:
        # Best-effort, inline : ne fait jamais echouer la sauvegarde locale.
        await events_google.push_new_event(user_id, event["id"])
        refreshed = await _fetch_event(user_id, event["id"])
        if refreshed is not None:
            event = refreshed

    return event


async def update_event(user_id: str, event_id: str, payload: EventUpdate) -> dict:
    current = await _fetch_event(user_id, event_id)
    if current is None:
        raise not_found("Evenement introuvable.")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return current

    proprietaire_id = current["proprietaire_id"]
    est_proprietaire = proprietaire_id == user_id
    if not est_proprietaire:
        # Partage collaboratif : le destinataire modifie le contenu, mais pas
        # les reglages personnels du proprietaire (categorie, notification).
        interdits = set(updates) - _CHAMPS_PARTAGE_EVENT
        if interdits:
            raise bad_request(
                "Sur un événement partagé, tu peux modifier le titre, les "
                "horaires, le lieu et la description uniquement."
            )

    new_debut = updates.get("debut", current["debut"])
    new_fin = updates.get("fin", current["fin"])
    if ("debut" in updates or "fin" in updates) and new_fin <= new_debut:
        raise bad_request("La date de fin doit etre apres la date de debut.")

    if "categorie_id" in updates:
        cid = str(updates["categorie_id"]) if updates["categorie_id"] else None
        await _assert_categorie_valide(user_id, cid)

    set_clauses = []
    values: list = []
    for key, value in updates.items():
        values.append(value)
        set_clauses.append(f"{key} = ${len(values)}")
    values.append(event_id)
    idx_id = len(values)
    values.append(user_id)
    idx_user = len(values)

    peut_modifier = _PEUT_MODIFIER.format(p=f"${idx_user}")
    async with scoped_connection(user_id) as conn:
        updated_id = await conn.fetchval(
            f"UPDATE events e SET {', '.join(set_clauses)}, updated_at = now() "
            f"WHERE e.id = ${idx_id}::uuid AND {peut_modifier} "
            f"RETURNING e.id::text",
            *values,
        )
    if updated_id is None:
        raise not_found("Evenement introuvable.")
    if "debut" in updates or "rappel_avance_minutes" in updates:
        # Horaire ou délai modifié : on retire le rappel déjà envoyé (il
        # appartient au PROPRIETAIRE) pour qu'une nouvelle alerte parte.
        async with scoped_connection(proprietaire_id) as conn:
            await conn.execute(
                "DELETE FROM notifications "
                "WHERE user_id = $1 AND ref_id = $2::uuid AND type = 'rappel_evenement'",
                proprietaire_id, event_id,
            )
    event = await _fetch_event(user_id, event_id)

    if event["google_event_id"]:
        # Push via la connexion Google du PROPRIETAIRE : un evenement partage
        # modifie par le destinataire doit se propager sur l'agenda du
        # proprietaire (le sien ne connait pas cet evenement).
        await events_google.push_update(proprietaire_id, event)
        refreshed = await _fetch_event(user_id, event_id)
        if refreshed is not None:
            event = refreshed

    return event


async def delete_event(user_id: str, event_id: str) -> None:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "DELETE FROM events WHERE id = $1::uuid AND user_id = $2 "
            "RETURNING google_event_id",
            event_id, user_id,
        )
        if row is not None:
            # Round 016 : les partages de l'element suivent sa suppression.
            await partages_service.supprimer_partages_element(
                conn, user_id, "event", event_id
            )
    if row is None:
        raise not_found("Evenement introuvable.")
    google_event_id = row["google_event_id"]
    if google_event_id:
        await events_google.delete_remote(user_id, google_event_id)
