"""Schémas Pydantic de l'API assistant conversationnel (Round 008)."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

_MAX_MESSAGE_LENGTH = 4000


class AssistantMessageRequest(BaseModel):
    conversation_id: UUID
    message: str
    context_ref: dict | None = None
    turn_key: str | None = None

    @field_validator("message")
    @classmethod
    def _message_non_vide(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le message ne peut pas être vide.")
        if len(cleaned) > _MAX_MESSAGE_LENGTH:
            raise ValueError("Le message est trop long (4000 caractères maximum).")
        return cleaned


class AssistantMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reply: str
    actions_done: list[dict] = Field(default_factory=list)
    draft: dict | None = None
    clarification_needed: bool = False


class ConversationCreateResponse(BaseModel):
    conversation_id: str


class ConversationTurnResponse(BaseModel):
    role: str
    contenu: str
    actions: dict | None = None


class ConversationDetailResponse(BaseModel):
    conversation_id: str
    turns: list[ConversationTurnResponse]
