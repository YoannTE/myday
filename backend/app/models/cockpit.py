"""Schemas Pydantic du domaine Cockpit (agregation de la page d'accueil `/`).

Les sous-schemas Note/Tache sont redefinis ici en miroir du contrat figé
(`.project/rounds/004/plan.md`) plutot qu'importes depuis les modules de
BACK-1 (tasks/notes), pour eviter tout couplage d'import entre agents.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.events import EventResponse


class NoteSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titre: str
    contenu: str | None = None
    epinglee: bool
    archivee: bool
    origine: str
    created_at: datetime
    updated_at: datetime


class TaskSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titre: str
    description: str | None = None
    priorite: str
    echeance: datetime | None = None
    statut: str
    origine: str
    mail_id: str | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class BriefSummary(BaseModel):
    # `contenu` = structure BriefContent (headline/priorities/schedule_summary/
    # tasks_summary/mails_summary/alerts) - type `dict` souple (pas de
    # sous-modele) : deja valide par BriefContentModel au moment de la
    # generation (compose.py), pas besoin de re-valider ici.
    contenu: dict
    degraded: bool
    generated_at: datetime
    type: str


class CockpitResponse(BaseModel):
    notes_epinglees: list[NoteSummary]
    journee: list[EventResponse]
    taches: list[TaskSummary]
    # Round 006 : forme variable ({"placeholder": True} tant qu'aucun mail
    # n'est encore trie, sinon {"placeholder": False, "mails": [mail, ...]}).
    # Type `dict` volontairement souple (pas de sous-modele) pour ne pas
    # re-ajouter une cle `mails` vide en etat placeholder (contrat fige du
    # plan Round 006).
    mails_importants: dict
    # Round 007 : brief du jour (quotidien du jour, sinon dernier a_la_demande
    # du jour, sinon null si aucun brief n'existe encore pour l'utilisateur).
    brief: BriefSummary | None = None
