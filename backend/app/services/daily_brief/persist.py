"""Persistance du brief (Round 007) : upsert idempotent pour les runs
planifiés (`quotidien`), insertion simple pour `manual`/`onboarding`
(`a_la_demande`). Notification « brief prêt » uniquement pour `scheduled` +
`brief_notify_ready` + `user_preferences.notif_brief_ready`. Écriture jsonb
explicite (`json.dumps` + `$n::jsonb` — correction #2 review) : asyncpg ne
sérialise pas les dict Python en jsonb automatiquement.
"""

from __future__ import annotations

import json
from datetime import date

from app.config import settings
from app.db.client import scoped_connection
from app.services.push.sender import dispatch_push

_UPSERT_SCHEDULED_SQL = """
    INSERT INTO briefs (user_id, brief_date, type, contenu, degraded)
    VALUES ($1, $2, 'quotidien', $3::jsonb, $4)
    ON CONFLICT (user_id, brief_date) WHERE type = 'quotidien'
    DO UPDATE SET contenu = EXCLUDED.contenu, degraded = EXCLUDED.degraded,
                  generated_at = now()
    RETURNING id::text
"""

_INSERT_ON_DEMAND_SQL = """
    INSERT INTO briefs (user_id, brief_date, type, contenu, degraded)
    VALUES ($1, $2, 'a_la_demande', $3::jsonb, $4)
    RETURNING id::text
"""


async def persist_brief(
    user_id: str, brief_date: str, trigger: str, content: dict, degraded: bool
) -> str:
    contenu_json = json.dumps(content)
    # asyncpg exige un objet `date` natif pour la colonne `date` - pas de
    # cast SQL ni de parsing implicite d'un ISO string cote serveur.
    brief_date_value = date.fromisoformat(brief_date)
    async with scoped_connection(user_id) as conn:
        if trigger == "scheduled":
            row = await conn.fetchrow(
                _UPSERT_SCHEDULED_SQL, user_id, brief_date_value, contenu_json, degraded
            )
        else:
            row = await conn.fetchrow(
                _INSERT_ON_DEMAND_SQL, user_id, brief_date_value, contenu_json, degraded
            )
        brief_id = row["id"]

        notify = False
        if trigger == "scheduled" and settings.brief_notify_ready:
            notif_active = await conn.fetchval(
                "SELECT notif_brief_ready FROM user_preferences WHERE user_id = $1",
                user_id,
            )
            if notif_active is not False:
                result = await conn.execute(
                    """
                    INSERT INTO notifications (user_id, type, contenu, ref_id)
                    VALUES ($1, 'brief_pret', $2, $3::uuid)
                    ON CONFLICT (user_id, ref_id, type) DO NOTHING
                    """,
                    user_id, content["headline"], brief_id,
                )
                notify = result.endswith(" 1")

        await conn.execute(
            "INSERT INTO usage_events (user_id, type) VALUES ($1, 'brief_generated')",
            user_id,
        )

    # Push (Round 009, correction #3 du plan) : pont PUSH-ONLY, APRÈS la
    # fermeture de la connexion BDD (transaction commitée) - best-effort.
    if notify:
        try:
            await dispatch_push(
                user_id, "brief_pret", "Brief prêt", content["headline"], "/"
            )
        except Exception:  # best-effort : ne jamais casser la génération du brief
            pass
    return brief_id
