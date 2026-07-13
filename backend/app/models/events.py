"""Schemas Pydantic du domaine Events (agenda local + Google, snake_case).

La validation metier `fin > debut` n'est PAS faite ici (elle leverait un 422
Pydantic) mais dans `services/events.py`, qui renvoie un 400 explicite via
`app.utils.errors.bad_request` (contrat figé Round 004).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.event_categories import EventCategoryLite

# Délais de notification proposés (minutes avant le début) : 1 h, 30 min,
# 5 min, au moment même, ou -1 pour « aucune notification ».
RAPPEL_AVANCE_VALEURS = (-1, 0, 5, 30, 60)


def _valider_rappel_avance(value: int | None) -> int | None:
    if value is not None and value not in RAPPEL_AVANCE_VALEURS:
        raise ValueError(
            "Le délai de notification doit être 0, 5, 30 ou 60 minutes, "
            "ou -1 pour aucune notification."
        )
    return value


class EventCreate(BaseModel):
    titre: str
    debut: datetime
    fin: datetime
    lieu: str | None = None
    description: str | None = None
    categorie_id: UUID | None = None
    rappel_avance_minutes: int = 30

    _rappel = field_validator("rappel_avance_minutes")(_valider_rappel_avance)


class EventUpdate(BaseModel):
    titre: str | None = None
    debut: datetime | None = None
    fin: datetime | None = None
    lieu: str | None = None
    description: str | None = None
    categorie_id: UUID | None = None
    rappel_avance_minutes: int | None = None

    _rappel = field_validator("rappel_avance_minutes")(_valider_rappel_avance)


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
    rappel_avance_minutes: int = 30
    # Round 016 : nom du propriétaire si l'événement est partagé avec nous
    # (None pour nos propres événements). Lecture seule côté destinataire.
    partage_par: str | None = None
    created_at: datetime
    updated_at: datetime


class EventCountResponse(BaseModel):
    """Agregat jour/nombre d'evenements pour les vues mois/annee (Round 013)."""

    jour: str
    count: int
