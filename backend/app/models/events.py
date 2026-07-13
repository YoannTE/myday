"""Schemas Pydantic du domaine Events (agenda local + Google, snake_case).

La validation metier `fin > debut` n'est PAS faite ici (elle leverait un 422
Pydantic) mais dans `services/events.py`, qui renvoie un 400 explicite via
`app.utils.errors.bad_request` (contrat figé Round 004).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.event_categories import EventCategoryLite


class EventCreate(BaseModel):
    titre: str
    debut: datetime
    fin: datetime
    lieu: str | None = None
    description: str | None = None
    categorie_id: UUID | None = None


class EventUpdate(BaseModel):
    titre: str | None = None
    debut: datetime | None = None
    fin: datetime | None = None
    lieu: str | None = None
    description: str | None = None
    categorie_id: UUID | None = None


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titre: str
    debut: datetime
    fin: datetime
    lieu: str | None = None
    description: str | None = None
    google_event_id: str | None = None
    source: str
    sync_status: str
    categorie_id: str | None = None
    categorie: EventCategoryLite | None = None
    created_at: datetime
    updated_at: datetime


class EventCountResponse(BaseModel):
    """Agregat jour/nombre d'evenements pour les vues mois/annee (Round 013)."""

    jour: str
    count: int
