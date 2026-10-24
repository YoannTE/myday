"""Accès « machine » de la page MIA : `/api/mia` (jeton Bearer, un seul compte).

Lecture de la journée, CRÉATION (tâche, rendez-vous, note) et MODIFICATION
restreinte (tâche : titre, priorité, échéance, statut ; rendez-vous : titre,
horaires, lieu), en déléguant aux services existants : mêmes validations, même
RLS, même remontée vers Google Agenda pour les rendez-vous. Aucune suppression
n'est exposée ici, volontairement.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ValidationError

from app.auth.mia import get_mia_user
from app.auth.session import AuthUser
from app.models.events import EventCreate, EventResponse, EventUpdate
from app.models.notes import NoteCreate, NoteResponse
from app.models.mia import MiaEventUpdate, MiaTaskUpdate
from app.models.tasks import TaskCreate, TaskResponse, TaskUpdate
from app.services import events as events_service
from app.services import mia as mia_service
from app.services import notes as notes_service
from app.services import tasks as tasks_service
from app.utils.errors import bad_request

router = APIRouter(prefix="/mia", tags=["mia"])

MiaUser = Annotated[AuthUser, Depends(get_mia_user)]


def _vers_modele_complet(modele: type[BaseModel], payload: BaseModel) -> BaseModel:
    """Applique les validations du modèle complet (priorité, statut, titre…)."""
    try:
        return modele(**payload.model_dump(exclude_unset=True))
    except ValidationError as exc:
        raise bad_request(exc.errors()[0]["msg"].removeprefix("Value error, ")) from exc


@router.get("/journee")
async def get_journee(user: MiaUser):
    return {"data": await mia_service.get_journee(user["id"])}


@router.post("/taches", status_code=status.HTTP_201_CREATED)
async def create_tache(payload: TaskCreate, user: MiaUser):
    task = await tasks_service.create_task(user["id"], payload)
    return {"data": TaskResponse(**task).model_dump()}


@router.post("/evenements", status_code=status.HTTP_201_CREATED)
async def create_evenement(
    payload: EventCreate, user: MiaUser
):
    event = await events_service.create_event(user["id"], payload)
    return {"data": EventResponse(**event).model_dump()}


@router.post("/notes", status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate, user: MiaUser):
    note = await notes_service.create_note(user["id"], payload)
    return {"data": NoteResponse(**note).model_dump()}


@router.patch("/taches/{task_id}")
async def update_tache(task_id: UUID, payload: MiaTaskUpdate, user: MiaUser):
    task = await tasks_service.update_task(
        user["id"], str(task_id), _vers_modele_complet(TaskUpdate, payload)
    )
    return {"data": TaskResponse(**task).model_dump()}


@router.patch("/evenements/{event_id}")
async def update_evenement(event_id: UUID, payload: MiaEventUpdate, user: MiaUser):
    event = await events_service.update_event(
        user["id"], str(event_id), _vers_modele_complet(EventUpdate, payload)
    )
    return {"data": EventResponse(**event).model_dump()}
