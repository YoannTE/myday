"""Schémas Pydantic du domaine Notes."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.note_categories import NoteCategoryLite
from app.models.note_items import NoteItemResponse


class NoteCreate(BaseModel):
    titre: str
    contenu: str | None = None
    categorie_id: UUID | None = None

    @field_validator("titre")
    @classmethod
    def _titre_non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le titre est obligatoire.")
        return cleaned


class NoteUpdate(BaseModel):
    titre: str | None = None
    contenu: str | None = None
    epinglee: bool | None = None
    archivee: bool | None = None
    categorie_id: UUID | None = None

    @field_validator("titre")
    @classmethod
    def _titre_non_vide(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le titre est obligatoire.")
        return cleaned


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titre: str
    contenu: str | None = None
    epinglee: bool
    archivee: bool
    origine: str
    categorie_id: str | None = None
    categorie: NoteCategoryLite | None = None
    items: list[NoteItemResponse] = []
    created_at: datetime
    updated_at: datetime
