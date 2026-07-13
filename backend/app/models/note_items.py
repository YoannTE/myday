"""Schémas Pydantic des éléments (cases à cocher) d'une note."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class NoteItemCreate(BaseModel):
    contenu: str

    @field_validator("contenu")
    @classmethod
    def _contenu_non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("L'élément ne peut pas être vide.")
        return cleaned


class NoteItemUpdate(BaseModel):
    contenu: str | None = None
    coche: bool | None = None

    @field_validator("contenu")
    @classmethod
    def _contenu_non_vide(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("L'élément ne peut pas être vide.")
        return cleaned


class NoteItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contenu: str
    coche: bool
    position: int
    created_at: datetime
    updated_at: datetime
