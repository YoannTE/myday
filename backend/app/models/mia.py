"""Modifications autorisées par l'accès « machine » MIA (`/api/mia`).

Sous-ensembles volontairement réduits de `TaskUpdate` / `EventUpdate` : un
champ hors liste est refusé (422) plutôt qu'ignoré. Les validations métier
restent celles des modèles complets, appliquées à la conversion.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MiaTaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titre: str | None = None
    priorite: str | None = None
    echeance: datetime | None = None
    statut: str | None = None


class MiaEventUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titre: str | None = None
    debut: datetime | None = None
    fin: datetime | None = None
    lieu: str | None = None
