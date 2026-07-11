"""Schémas Pydantic du domaine Recherche globale."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titre: str
    contenu: str | None = None


class TaskSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titre: str
    description: str | None = None
    statut: str


class EventSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titre: str
    lieu: str | None = None
    debut: datetime


class MailSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    expediteur: str
    sujet: str | None = None
    extrait: str | None = None


class SearchResponse(BaseModel):
    notes: list[NoteSearchResult]
    taches: list[TaskSearchResult]
    events: list[EventSearchResult]
    mails: list[MailSearchResult]
