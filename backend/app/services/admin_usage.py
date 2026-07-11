"""Agregats admin du journal d'usage (Round 010).

Lecture cross-user de METADONNEES/compteurs uniquement, via le pool admin
(whitelist etendue dans `app.db.client.create_admin_pool`) : jamais de
contenu utilisateur. `usage_events.metadata` (jsonb) n'est JAMAIS selectionne
ici, meme implicitement (pas de `SELECT *`).
"""

from app.db.client import get_admin_pool
from app.models.admin_usage import (
    AdminUsageResponse,
    AgentCost,
    LlmCostResponse,
    UserActiveDays,
    WeekActivity,
)

# Fenetre glissante de 28 jours (4 semaines de 7 jours), regroupee par jour
# civil en Europe/Paris (sinon les ouvertures autour de minuit tombent sur le
# mauvais jour). `generate_series` + LEFT JOIN comblent les jours sans
# ouverture a 0 : c'est justement ce qui compte pour le critere "5j/7".
_ACTIVE_DAYS_QUERY = """
WITH bounds AS (
    SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS today,
           (now() AT TIME ZONE 'Europe/Paris')::date - 27 AS start_day
),
days AS (
    SELECT generate_series(start_day, today, interval '1 day')::date AS jour
    FROM bounds
),
weeks AS (
    SELECT d.jour,
           b.start_day + ((d.jour - b.start_day) / 7) * 7 AS semaine_debut
    FROM days d, bounds b
),
grid AS (
    SELECT u.id AS user_id, u.email AS user_label, w.jour, w.semaine_debut
    FROM "user" u
    CROSS JOIN weeks w
),
actifs AS (
    SELECT DISTINCT
        user_id,
        (date_trunc('day', created_at AT TIME ZONE 'Europe/Paris'))::date AS jour
    FROM usage_events
    WHERE type = 'dashboard_opened'
      AND created_at >= now() - interval '35 days'
)
SELECT g.user_id, g.user_label, g.semaine_debut,
       count(*) FILTER (WHERE a.jour IS NOT NULL) AS jours_actifs
FROM grid g
LEFT JOIN actifs a ON a.user_id = g.user_id AND a.jour = g.jour
GROUP BY g.user_id, g.user_label, g.semaine_debut
ORDER BY g.user_label, g.semaine_debut
"""

_EVENTS_BY_TYPE_QUERY = """
SELECT type, count(*) AS count
FROM usage_events
GROUP BY type
ORDER BY type
"""

_LLM_COST_GLOBAL_QUERY = """
SELECT
    coalesce(sum(cost_usd), 0) AS total_usd,
    coalesce(sum(prompt_tokens), 0) AS prompt_tokens,
    coalesce(sum(completion_tokens), 0) AS completion_tokens
FROM llm_usage
"""

_LLM_COST_BY_AGENT_QUERY = """
SELECT agent,
       coalesce(sum(cost_usd), 0) AS cost_usd,
       coalesce(sum(prompt_tokens + completion_tokens), 0) AS tokens
FROM llm_usage
GROUP BY agent
ORDER BY agent
"""

_ACTIVE_USERS_QUERY = """
SELECT count(DISTINCT user_id) AS active_users
FROM usage_events
WHERE created_at >= now() - interval '7 days'
"""


async def _fetch_active_days_by_user(pool) -> list[UserActiveDays]:
    rows = await pool.fetch(_ACTIVE_DAYS_QUERY)
    par_user: dict[str, UserActiveDays] = {}
    for row in rows:
        label = row["user_label"]
        if label not in par_user:
            par_user[label] = UserActiveDays(user_label=label, weeks=[])
        par_user[label].weeks.append(
            WeekActivity(
                semaine=row["semaine_debut"].isoformat(),
                jours_actifs=row["jours_actifs"],
            )
        )
    return list(par_user.values())


async def _fetch_events_by_type(pool) -> dict[str, int]:
    rows = await pool.fetch(_EVENTS_BY_TYPE_QUERY)
    return {row["type"]: row["count"] for row in rows}


async def _fetch_llm_cost(pool) -> LlmCostResponse:
    global_row = await pool.fetchrow(_LLM_COST_GLOBAL_QUERY)
    agent_rows = await pool.fetch(_LLM_COST_BY_AGENT_QUERY)
    return LlmCostResponse(
        total_usd=round(float(global_row["total_usd"]), 4),
        prompt_tokens=global_row["prompt_tokens"],
        completion_tokens=global_row["completion_tokens"],
        by_agent=[
            AgentCost(
                agent=row["agent"],
                cost_usd=round(float(row["cost_usd"]), 4),
                tokens=row["tokens"],
            )
            for row in agent_rows
        ],
    )


async def get_admin_usage() -> AdminUsageResponse:
    pool = get_admin_pool()
    active_days_by_user = await _fetch_active_days_by_user(pool)
    events_by_type = await _fetch_events_by_type(pool)
    llm_cost = await _fetch_llm_cost(pool)
    active_users = await pool.fetchval(_ACTIVE_USERS_QUERY)

    return AdminUsageResponse(
        active_days_by_user=active_days_by_user,
        events_by_type=events_by_type,
        llm_cost=llm_cost,
        active_users=active_users,
    )
