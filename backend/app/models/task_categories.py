"""Schémas Pydantic du domaine Catégories de tâches (Round 012)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class TaskCategoryCreate(BaseModel):
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


class TaskCategoryUpdate(BaseModel):
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


class TaskCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nom: str
    couleur: str
    created_at: datetime
    updated_at: datetime
    # Ordre manuel des catégories (haut/bas) : nul tant que la catégorie n'a
    # jamais été déplacée, le tri retombe alors sur le nom alphabétique.
    position: int | None = None


class TaskCategoryLite(BaseModel):
    """Représentation légère jointe dans la réponse d'une tâche."""

    id: str
    nom: str
    couleur: str


class TaskCategoryDeplacer(BaseModel):
    """Déplacement manuel (haut/bas) d'une catégorie de tâches (Refonte
    Cockpit unique)."""

    direction: Literal["haut", "bas"]
