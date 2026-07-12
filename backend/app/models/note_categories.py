"""Schémas Pydantic du domaine Catégories de notes (miroir des catégories de
tâches, Round 015)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class NoteCategoryCreate(BaseModel):
    nom: str
    couleur: str | None = None

    @field_validator("nom")
    @classmethod
    def _nom_non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le nom de la catégorie est obligatoire.")
        return cleaned

    @field_validator("couleur")
    @classmethod
    def _couleur_non_vide(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("La couleur ne peut pas être vide.")
        return cleaned


class NoteCategoryUpdate(BaseModel):
    nom: str | None = None
    couleur: str | None = None

    @field_validator("nom")
    @classmethod
    def _nom_non_vide(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le nom de la catégorie est obligatoire.")
        return cleaned

    @field_validator("couleur")
    @classmethod
    def _couleur_non_vide(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("La couleur ne peut pas être vide.")
        return cleaned


class NoteCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nom: str
    couleur: str
    created_at: datetime
    updated_at: datetime


class NoteCategoryLite(BaseModel):
    """Représentation légère jointe dans la réponse d'une note."""

    id: str
    nom: str
    couleur: str
