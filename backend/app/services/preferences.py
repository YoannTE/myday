"""Logique métier des préférences utilisateur (brief, notifications, onboarding).

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS) — jamais le
pool admin. La ligne est créée à la demande (« create-or-default ») via
`INSERT ... ON CONFLICT (user_id) DO NOTHING` : l'unicité `UNIQUE(user_id)`
garantit l'idempotence même en cas de create-or-default concurrent.
"""

import asyncpg

from app.db.client import scoped_connection
from app.models.preferences import BRIEF_HOUR_RE, BRIEF_TONE_VALUES, PreferencesUpdate
from app.utils.errors import bad_request

_COLUMNS = (
    "brief_hour, brief_tone, timezone, meteo_ville, notif_important_mail, "
    "notif_event_reminder, notif_brief_ready, onboarding_completed, "
    "onboarding_step, created_at, updated_at"
)

_METEO_VILLE_MAX = 120

_ENSURE_ROW_SQL = (
    "INSERT INTO user_preferences (user_id) VALUES ($1) "
    "ON CONFLICT (user_id) DO NOTHING"
)


def _valider_champs(fields: dict) -> None:
    """Valide les champs métier envoyés au PATCH (400 explicite, pas un 422
    Pydantic — cf. docstring de `models/preferences.py`)."""
    brief_hour = fields.get("brief_hour")
    if brief_hour is not None and not BRIEF_HOUR_RE.match(brief_hour):
        raise bad_request("L'heure du brief doit être au format HH:MM.")

    onboarding_step = fields.get("onboarding_step")
    if onboarding_step is not None and not (0 <= onboarding_step <= 4):
        raise bad_request("L'étape d'onboarding doit être comprise entre 0 et 4.")

    brief_tone = fields.get("brief_tone")
    if brief_tone is not None and brief_tone not in BRIEF_TONE_VALUES:
        raise bad_request("Le ton du brief doit être neutre, motivant ou direct.")

    meteo_ville = fields.get("meteo_ville")
    if meteo_ville is not None:
        ville = meteo_ville.strip()
        if not ville:
            raise bad_request("La ville météo ne peut pas être vide.")
        if len(ville) > _METEO_VILLE_MAX:
            raise bad_request(
                f"La ville météo ne peut pas dépasser {_METEO_VILLE_MAX} caractères."
            )
        # Normalisation : on stocke la valeur nettoyée (sans espaces superflus).
        fields["meteo_ville"] = ville


def _serialize(row: asyncpg.Record) -> dict:
    return {
        "brief_hour": row["brief_hour"],
        "brief_tone": row["brief_tone"],
        "timezone": row["timezone"],
        "meteo_ville": row["meteo_ville"],
        "notif_important_mail": row["notif_important_mail"],
        "notif_event_reminder": row["notif_event_reminder"],
        "notif_brief_ready": row["notif_brief_ready"],
        "onboarding_completed": row["onboarding_completed"],
        "onboarding_step": row["onboarding_step"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def get_or_create_preferences(user_id: str) -> dict:
    """Retourne les préférences de l'utilisateur, en créant la ligne par défaut
    si elle n'existe pas encore (idempotent grâce à `UNIQUE(user_id)`)."""
    async with scoped_connection(user_id) as conn:
        await conn.execute(_ENSURE_ROW_SQL, user_id)
        row = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM user_preferences WHERE user_id = $1", user_id
        )
    return _serialize(row)


async def update_preferences(user_id: str, payload: PreferencesUpdate) -> dict:
    """Applique un patch partiel. Crée la ligne par défaut si nécessaire, puis
    fusionne les champs fournis avec les valeurs actuelles. `updated_at` est
    posé explicitement à `now()` (le `defaultNow()` Drizzle ne vaut qu'à
    l'INSERT)."""
    fields = payload.model_dump(exclude_unset=True)
    _valider_champs(fields)
    async with scoped_connection(user_id) as conn:
        await conn.execute(_ENSURE_ROW_SQL, user_id)
        current = await conn.fetchrow(
            f"SELECT {_COLUMNS} FROM user_preferences WHERE user_id = $1", user_id
        )
        if not fields:
            return _serialize(current)

        row = await conn.fetchrow(
            f"""
            UPDATE user_preferences
            SET brief_hour = $2, brief_tone = $3, timezone = $4,
                meteo_ville = $5, notif_important_mail = $6,
                notif_event_reminder = $7, notif_brief_ready = $8,
                onboarding_completed = $9, onboarding_step = $10,
                updated_at = now()
            WHERE user_id = $1
            RETURNING {_COLUMNS}
            """,
            user_id,
            fields.get("brief_hour", current["brief_hour"]),
            fields.get("brief_tone", current["brief_tone"]),
            fields.get("timezone", current["timezone"]),
            fields.get("meteo_ville", current["meteo_ville"]),
            fields.get("notif_important_mail", current["notif_important_mail"]),
            fields.get("notif_event_reminder", current["notif_event_reminder"]),
            fields.get("notif_brief_ready", current["notif_brief_ready"]),
            fields.get("onboarding_completed", current["onboarding_completed"]),
            fields.get("onboarding_step", current["onboarding_step"]),
        )
    return _serialize(row)
