"""Schémas Pydantic du domaine Contacts (liens de partage entre comptes,
Round 016)."""

import re
from datetime import datetime

from pydantic import BaseModel, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactCreate(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _email_valide(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not _EMAIL_RE.match(cleaned):
            raise ValueError("Adresse email invalide.")
        return cleaned


class ContactUtilisateur(BaseModel):
    """L'autre participant du lien (jamais d'identifiant interne exposé)."""

    nom: str
    email: str


class ContactResponse(BaseModel):
    id: str
    statut: str
    # "envoyee" si l'utilisateur courant est le demandeur, "recue" sinon
    # (une demande "recue" en attente affiche les boutons accepter/refuser).
    direction: str
    autre_utilisateur: ContactUtilisateur
    created_at: datetime
