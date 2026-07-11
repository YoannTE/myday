"""Exceptions du domaine Google.

Ces exceptions modelisent les cas de recuperation prevus par le design :
- `ReauthRequired` : jeton invalide (401) → la branche echoue, curseur intact.
- `SyncTokenExpired` : syncToken Agenda expire (410) → resync borne.
- `HistoryIdExpired` : historyId Gmail expire (404) → resync borne.
- `DuplicateEvent` : insertion Agenda d'un id deja connu (409) → reconciliation.
- `GoogleApiError` : erreur non recuperable (autre 4xx/5xx apres backoff).
"""

from __future__ import annotations


class GoogleApiError(Exception):
    """Erreur d'appel Google non recuperable (apres backoff borne)."""


class ReauthRequired(GoogleApiError):
    """Le jeton d'acces est invalide (401) : reconnexion utilisateur necessaire."""


class SyncTokenExpired(GoogleApiError):
    """Le syncToken Agenda est expire (410) : declenche un resync complet borne."""


class HistoryIdExpired(GoogleApiError):
    """L'historyId Gmail est expire (404) : declenche un resync borne."""


class DuplicateEvent(GoogleApiError):
    """L'evenement pousse existe deja cote Google (409) : reconciliation par id."""
