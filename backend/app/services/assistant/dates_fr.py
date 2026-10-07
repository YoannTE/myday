"""Dates de l'assistant : lecture des dates/heures locales renvoyées par le
planificateur et formatage en français lisible (« jeudi 9 octobre à 21h00 »)
pour la vue des données et les confirmations. Sans dépendance à la locale
système (noms des jours et des mois écrits en dur).
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.config import settings

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = [
    "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
    "septembre", "octobre", "novembre", "décembre",
]


def fuseau() -> ZoneInfo:
    return ZoneInfo(settings.app_timezone)


def maintenant() -> datetime:
    return datetime.now(fuseau())


def parse_local_datetime(value: str) -> datetime:
    """« YYYY-MM-DDTHH:MM » (naïf = heure locale) -> datetime avec fuseau."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=fuseau())
    return parsed


def parse_due_date(value: str) -> datetime:
    """Échéance « YYYY-MM-DD » fixée à midi local, comme l'interface (évite
    tout glissement de jour lié au fuseau horaire)."""
    return datetime.combine(date.fromisoformat(value), time(12, 0), tzinfo=fuseau())


def jour_fr(value: datetime | date) -> str:
    """« jeudi 9 octobre »."""
    if isinstance(value, datetime):
        value = value.astimezone(fuseau())
    return f"{JOURS[value.weekday()]} {value.day} {MOIS[value.month - 1]}"


def heure_fr(value: datetime) -> str:
    """« 21h00 »."""
    local = value.astimezone(fuseau())
    return f"{local.hour}h{local.minute:02d}"


def moment_fr(value: datetime) -> str:
    """« jeudi 9 octobre à 21h00 »."""
    return f"{jour_fr(value)} à {heure_fr(value)}"


def iso_local(value: datetime) -> str:
    """« 2026-10-09T21:00 » en heure locale (format attendu du planificateur)."""
    return value.astimezone(fuseau()).strftime("%Y-%m-%dT%H:%M")


def calendrier_fr(jours: int = 21) -> str:
    """Correspondance jour -> date des prochaines semaines, pour que le
    planificateur ne se trompe jamais sur « jeudi » ou « mardi prochain »."""
    debut = maintenant().date() - timedelta(days=7)
    lignes = []
    for i in range(jours + 7):
        d = debut + timedelta(days=i)
        lignes.append(f"{JOURS[d.weekday()]} {d.isoformat()}")
    return ", ".join(lignes)
