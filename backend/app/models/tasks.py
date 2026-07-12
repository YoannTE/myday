"""Schémas Pydantic du domaine Tâches."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.task_categories import TaskCategoryLite

PRIORITES = ("basse", "normale", "haute")
STATUTS = ("a_faire", "faite")


class TaskCreate(BaseModel):
    titre: str
    description: str | None = None
    priorite: str = "normale"
    echeance: datetime | None = None
    categorie_id: UUID | None = None

    @field_validator("titre")
    @classmethod
    def _titre_non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le titre est obligatoire.")
        return cleaned

    @field_validator("priorite")
    @classmethod
    def _priorite_valide(cls, value: str) -> str:
        if value not in PRIORITES:
            raise ValueError("Priorité invalide.")
        return value


class TaskUpdate(BaseModel):
    titre: str | None = None
    description: str | None = None
    priorite: str | None = None
    echeance: datetime | None = None
    categorie_id: UUID | None = None
    statut: str | None = None

    @field_validator("titre")
    @classmethod
    def _titre_non_vide(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le titre est obligatoire.")
        return cleaned

    @field_validator("priorite")
    @classmethod
    def _priorite_valide(cls, value: str | None) -> str | None:
        if value is not None and value not in PRIORITES:
            raise ValueError("Priorité invalide.")
        return value

    @field_validator("statut")
    @classmethod
    def _statut_valide(cls, value: str | None) -> str | None:
        if value is not None and value not in STATUTS:
            raise ValueError("Statut invalide.")
        return value


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titre: str
    description: str | None = None
    priorite: str
    echeance: datetime | None = None
    categorie_id: str | None = None
    categorie: TaskCategoryLite | None = None
    statut: str
    origine: str
    mail_id: str | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
