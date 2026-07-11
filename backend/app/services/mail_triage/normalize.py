"""Normalisation de l'expéditeur d'un mail vers une adresse email canonique.

Fonction UNIQUE utilisée partout où une adresse expéditeur doit être comparée :
la clé `sender_preferences`, le lookup du pré-filtre, les regex newsletter,
et l'endpoint feedback (correction #5 - review Round 006). Ne jamais dupliquer
cette logique ailleurs.
"""

from __future__ import annotations

import re

_EMAIL_IN_BRACKETS_RE = re.compile(r"<([^<>]+)>")
_BARE_EMAIL_RE = re.compile(r"[^\s<>]+@[^\s<>]+")


def email_expediteur(from_brut: str | None) -> str:
    """Extrait l'adresse email d'un en-tête `From` brut, en minuscule.

    Gère les deux formats Gmail courants : `Nom <email>` et une adresse brute
    sans nom affiché. Retourne une chaîne vide si aucune adresse n'est
    trouvée (défensif : ne lève jamais d'exception).
    """
    if not from_brut:
        return ""
    match = _EMAIL_IN_BRACKETS_RE.search(from_brut)
    candidate = match.group(1) if match else from_brut
    bare = _BARE_EMAIL_RE.search(candidate)
    if bare:
        return bare.group(0).strip().lower()
    return candidate.strip().lower()
