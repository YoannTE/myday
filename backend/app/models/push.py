"""Schémas Pydantic du domaine Push (abonnements Web Push)."""

from __future__ import annotations

from pydantic import BaseModel, field_validator


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeys

    @field_validator("endpoint")
    @classmethod
    def _endpoint_non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("L'endpoint est obligatoire.")
        return cleaned


class PushUnsubscribeRequest(BaseModel):
    endpoint: str

    @field_validator("endpoint")
    @classmethod
    def _endpoint_non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("L'endpoint est obligatoire.")
        return cleaned
