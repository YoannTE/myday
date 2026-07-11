"""Schémas Pydantic du domaine Usage (journal d'évènements produit léger)."""

from pydantic import BaseModel

# `task_completed` est volontairement dans le CHECK BDD mais rejeté à l'écriture
# côté endpoint : il est émis exclusivement côté serveur (atomicité du PATCH tâche).
USAGE_EVENT_TYPES = (
    "dashboard_opened",
    "brief_generated",
    "brief_opened",
    "task_completed",
    "assistant_message_sent",
    "mail_replied",
)


class UsageEventCreate(BaseModel):
    type: str
    metadata: dict | None = None


class UsageEventResponse(BaseModel):
    id: str
