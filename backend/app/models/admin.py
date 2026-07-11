"""Schemas Pydantic pour l'administration : invitations et comptes."""

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

# Validation email simple (email_validator n'est pas une dependance du projet).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class InvitationCreate(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not _EMAIL_RE.match(cleaned):
            raise ValueError("Adresse email invalide")
        return cleaned


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    statut: str
    expiration: datetime
    created_at: datetime
    accepted_at: datetime | None = None
    accepted_by: str | None = None
    invite_url: str


class AccountUpdate(BaseModel):
    active: bool


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str
    active: bool
    last_connexion: datetime | None = None
