"""Endpoints Google figes + scopes OAuth demandes.

Les URL sont centralisees ici (jamais hardcodees dans les services) pour que le
perimetre d'acces Google soit lisible d'un coup d'oeil et audite facilement.
"""

from __future__ import annotations

# Points de terminaison OAuth (figes cote Google).
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"

# Bases API (v3 Agenda, v1 Gmail).
CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"
GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1"

# Scopes demandes : Agenda en lecture + ecriture (remontee des evenements locaux),
# Gmail en LECTURE + ENVOI uniquement. MyDay ne supprime JAMAIS rien dans Gmail :
# aucun scope de modification/suppression n'est demande.
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"

GOOGLE_SCOPES: list[str] = [
    CALENDAR_SCOPE,
    GMAIL_READONLY_SCOPE,
    GMAIL_SEND_SCOPE,
]
