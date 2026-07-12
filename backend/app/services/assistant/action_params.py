"""Schémas Pydantic des `params` par type d'action planifiée (correction #10
review Round 008) : validés APRÈS le plan LLM, avant tout dispatch. Un type
d'action inconnu ou des params invalides -> action écartée proprement, jamais
de crash (whitelist stricte via `ACTION_PARAM_MODELS`).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class TaskParams(BaseModel):
    title: str = Field(min_length=1)
    priority: Literal["haute", "normale", "basse"] = "normale"
    due: str | None = None

    @field_validator("title")
    @classmethod
    def _titre_tronque(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Titre vide.")
        return cleaned[:200]


class NoteParams(BaseModel):
    note_title: str = Field(min_length=1)
    content_to_add: str = Field(min_length=1)

    @field_validator("note_title")
    @classmethod
    def _titre_non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Titre de note vide.")
        return cleaned

    @field_validator("content_to_add")
    @classmethod
    def _contenu_tronque(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Contenu vide.")
        return cleaned[:2000]


class EventParams(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    start: str
    end: str
    location: str | None = None
    # Informations complémentaires fournies par l'utilisateur, reportées dans
    # la description de l'événement (ex. contexte, personnes, ordre du jour).
    description: str | None = Field(default=None, max_length=2000)


class QueryParams(BaseModel):
    entity: Literal["events", "tasks", "notes", "mails"]
    question: str = Field(min_length=1)


class DraftParams(BaseModel):
    to: str | None = None
    subject: str | None = None
    instruction: str = Field(min_length=1)
    reply_to_ref: bool = False


ACTION_PARAM_MODELS: dict[str, type[BaseModel]] = {
    "create_task": TaskParams,
    "create_note": NoteParams,
    "create_event": EventParams,
    "query_data": QueryParams,
    "draft_email": DraftParams,
}
