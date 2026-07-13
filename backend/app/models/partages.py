"""Schémas Pydantic du domaine Partages (éléments partagés en lecture seule,
Round 016)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

ELEMENT_TYPES = ("event", "task", "note")


class PartageCreate(BaseModel):
    element_type: str
    element_id: UUID
    contact_id: UUID

    @field_validator("element_type")
    @classmethod
    def _type_valide(cls, value: str) -> str:
        if value not in ELEMENT_TYPES:
            raise ValueError("Type d'élément invalide.")
        return value


class PartageCible(BaseModel):
    nom: str
    email: str


class PartageResponse(BaseModel):
    id: str
    element_type: str
    element_id: str
    cible: PartageCible
    created_at: datetime
