"""Schémas Pydantic des brouillons de mail assistant (snake_case, contrat figé
plan Round 008 - SOP `api-response-casing-contract`)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class MailDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    destinataire: str
    objet: str | None = None
    corps: str
    statut: str
    sent_gmail_id: str | None = None
    mail_origine_id: str | None = None
    created_at: datetime
    updated_at: datetime


class DraftEdited(BaseModel):
    """Version éditée du brouillon soumise avec la décision (tous champs optionnels
    : seuls les champs fournis remplacent ceux du brouillon d'origine)."""

    to: str | None = None
    subject: str | None = None
    body: str | None = None


class DraftDecisionRequest(BaseModel):
    decision: Literal["approve", "reject"]
    edited: DraftEdited | None = None


class DraftDecisionResponse(BaseModel):
    statut: str
    sent_gmail_id: str | None = None
    message: str | None = None
