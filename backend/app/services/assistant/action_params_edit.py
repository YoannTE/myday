"""Schémas Pydantic des actions de MODIFICATION et de SUPPRESSION de
l'assistant. Seuls les champs réellement envoyés par le planificateur sont
appliqués (`model_dump(exclude_unset=True)`) : un champ absent ne change
rien, un champ à `null` efface la valeur (ex. retirer l'échéance).

`ref` est la référence courte d'un élément de la vue des données (T3, E1,
N2, I7), résolue par l'orchestrateur - jamais un UUID.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def _date_valide(value: str | None) -> str | None:
    if value is not None:
        date.fromisoformat(value)
    return value


def _datetime_valide(value: str | None) -> str | None:
    if value is not None:
        datetime.fromisoformat(value)
    return value


class _AvecRef(BaseModel):
    ref: str = Field(min_length=2, max_length=10)


class UpdateTaskParams(_AvecRef):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: Literal["haute", "normale", "basse"] | None = None
    due: str | None = None
    status: Literal["a_faire", "faite"] | None = None
    recurrence: Literal["aucune", "quotidienne", "hebdomadaire", "mensuelle"] | None = None
    reminder_at: str | None = None
    scheduled_start: str | None = None
    scheduled_end: str | None = None
    category: str | None = None

    _due = field_validator("due")(_date_valide)
    _dt = field_validator("reminder_at", "scheduled_start", "scheduled_end")(_datetime_valide)


class UpdateEventParams(_AvecRef):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    start: str | None = None
    end: str | None = None
    location: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=2000)

    _dt = field_validator("start", "end")(_datetime_valide)


class UpdateNoteParams(_AvecRef):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=20000)
    append: str | None = Field(default=None, min_length=1, max_length=2000)
    pinned: bool | None = None
    archived: bool | None = None


class AddNoteItemsParams(_AvecRef):
    items: list[str] = Field(min_length=1, max_length=30)

    @field_validator("items")
    @classmethod
    def _items_non_vides(cls, value: list[str]) -> list[str]:
        cleaned = [v.strip()[:300] for v in value if v and v.strip()]
        if not cleaned:
            raise ValueError("Aucun élément à ajouter.")
        return cleaned


class UpdateNoteItemParams(_AvecRef):
    content: str | None = Field(default=None, min_length=1, max_length=300)
    checked: bool | None = None


class DeleteParams(_AvecRef):
    pass


class ConfirmDeleteParams(BaseModel):
    pass


class AnswerParams(BaseModel):
    text: str = Field(min_length=1, max_length=1500)


EDIT_PARAM_MODELS: dict[str, type[BaseModel]] = {
    "update_task": UpdateTaskParams,
    "update_event": UpdateEventParams,
    "update_note": UpdateNoteParams,
    "add_note_items": AddNoteItemsParams,
    "update_note_item": UpdateNoteItemParams,
    "delete": DeleteParams,
    "confirm_delete": ConfirmDeleteParams,
    "cancel_delete": ConfirmDeleteParams,
    "answer": AnswerParams,
}
