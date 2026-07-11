"""Schemas Pydantic de reponse pour l'agregat d'usage admin (Round 010).

Reponse strictement composee de COMPTEURS/metadonnees de compte : jamais de
contenu utilisateur (mails/notes/taches). `cost_usd` est stocke en `numeric`
cote Postgres (Decimal via asyncpg) : conversion explicite en `float` arrondi
a 4 decimales des la sortie du service, jamais de Decimal serialise brut.
"""

from pydantic import BaseModel


class WeekActivity(BaseModel):
    """Un bloc de 7 jours glissants dans la fenetre de 28 jours."""

    semaine: str
    jours_actifs: int


class UserActiveDays(BaseModel):
    """Jours distincts avec au moins un `dashboard_opened`, par semaine."""

    user_label: str
    weeks: list[WeekActivity]


class AgentCost(BaseModel):
    agent: str
    cost_usd: float
    tokens: int


class LlmCostResponse(BaseModel):
    total_usd: float
    prompt_tokens: int
    completion_tokens: int
    by_agent: list[AgentCost]


class AdminUsageResponse(BaseModel):
    active_days_by_user: list[UserActiveDays]
    events_by_type: dict[str, int]
    llm_cost: LlmCostResponse
    active_users: int
