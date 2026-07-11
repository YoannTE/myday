"""Schémas Pydantic du domaine Notifications."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

TYPES = ("mail_important", "rappel_evenement", "brief_pret")


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    contenu: str
    ref_id: str
    lue: bool
    date_envoi: datetime


class NotificationsReadRequest(BaseModel):
    """Corps de POST /api/notifications/read - `ids` absent = tout marquer lu."""

    ids: list[UUID] | None = None
