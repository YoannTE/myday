"""Schemas Pydantic du domaine Google (echange OAuth + etat de connexion)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class ExchangeRequest(BaseModel):
    """Corps de POST /api/google/exchange (envoye par le Route Handler Next)."""

    code: str
    code_verifier: str

    @field_validator("code", "code_verifier")
    @classmethod
    def _non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Champ obligatoire manquant.")
        return cleaned


class GoogleStatusResponse(BaseModel):
    """Etat de connexion Google expose au frontend (jamais de jeton)."""

    model_config = ConfigDict(from_attributes=True)

    connected: bool
    status: str | None = None
    reauth_required: bool = False
    scopes: list[str] = []
    calendar_synced_at: datetime | None = None
    gmail_synced_at: datetime | None = None
    last_manual_sync_at: datetime | None = None
