"""Accès « machine » de la page MIA : `/api/mia` (jeton Bearer, un seul compte).

Lecture de la journée et CRÉATION seulement (tâche, rendez-vous, note), en
déléguant aux services existants : mêmes validations, même RLS, même remontée
vers Google Agenda pour les rendez-vous. Aucune modification ni suppression
n'est exposée ici, volontairement.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.auth.mia import get_mia_user
from app.auth.session import AuthUser
from app.models.events import EventCreate, EventResponse
from app.models.notes import NoteCreate, NoteResponse
from app.models.tasks import TaskCreate, TaskResponse
from app.services import events as events_service
from app.services import mia as mia_service
from app.services import notes as notes_service
from app.services import tasks as tasks_service

router = APIRouter(prefix="/mia", tags=["mia"])

MiaUser = Annotated[AuthUser, Depends(get_mia_user)]


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
