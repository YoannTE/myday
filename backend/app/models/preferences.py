"""Schémas Pydantic du domaine Préférences (brief, notifications, onboarding).

Contrat figé (plan Round 005) : réponses en snake_case, sans alias camelCase
(SOP `api-response-casing-contract`). Sémantique `onboarding_step` figée :
0 = non démarré, 1..4 = étape courante affichée, `onboarding_completed=true`
= terminé.

La validation métier de `brief_hour` (format `HH:MM`) et `onboarding_step`
(0..4) n'est PAS faite ici via `field_validator` (elle lèverait un 422
Pydantic) mais dans `services/preferences.py`, qui renvoie un 400 explicite
via `app.utils.errors.bad_request` (même contrat figé que `events.py`,
Round 004).
"""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict

BRIEF_HOUR_RE = re.compile(r"^[0-2][0-9]:[0-5][0-9]$")
BRIEF_TONE_VALUES = ("neutre", "motivant", "direct")


class PreferencesUpdate(BaseModel):
    """Corps partiel de PATCH /api/preferences (tous les champs optionnels)."""

    brief_hour: str | None = None
    brief_tone: str | None = None
    timezone: str | None = None
    notif_important_mail: bool | None = None
    notif_event_reminder: bool | None = None
    notif_brief_ready: bool | None = None
    onboarding_completed: bool | None = None
    onboarding_step: int | None = None


class PreferencesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    brief_hour: str
    brief_tone: str
    timezone: str
    notif_important_mail: bool
    notif_event_reminder: bool
    notif_brief_ready: bool
    onboarding_completed: bool
    onboarding_step: int
    created_at: datetime
    updated_at: datetime
