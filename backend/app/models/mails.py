"""Schemas Pydantic du domaine mails (liste triee, detail, feedback).

Contrat fige (plan Round 006) : reponses en snake_case, sans alias camelCase
(SOP `api-response-casing-contract`).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class MailResponse(BaseModel):
    """Un mail tel qu'expose au frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    expediteur: str
    sujet: str | None = None
    extrait: str | None = None
    resume_ia: str | None = None
    score: int | None = None
    raison_score: str | None = None
    statut: str
    lu: bool
    repondu: bool
    date_reception: datetime | None = None
    created_at: datetime
    updated_at: datetime


class MailListResponse(BaseModel):
    """Enveloppe de GET /api/mails : liste triee + compteur d'ecartes."""

    mails: list[MailResponse]
    ecartes: int


class MailUpdate(BaseModel):
    """Corps de PATCH /api/mails/{id} : mise a jour partielle."""

    lu: bool | None = None
    repondu: bool | None = None


class MailFeedback(BaseModel):
    """Corps de POST /api/mails/{id}/feedback."""

    valeur: Literal["important", "pas_important"]


class MailFeedbackResponse(BaseModel):
    """Retour du feedback : nouveau statut de preference expediteur."""

    statut: Literal["important", "muet"]
