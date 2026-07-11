"""Pré-filtre déterministe (pur, sans IA) : classe chaque mail en score
automatique ou candidat pour le scoring LLM.

Règles adaptées du design `mail_triage.md` SANS `to_type` (Round 003 ne
fournit pas To/Cc sur les mails synchronisés) : la règle Cc est retirée.
Ordre de priorité :
  1. expéditeur en `muet` (sender_preferences)       -> score 5
  2. expéditeur en `important` (sender_preferences)  -> score 85
  3. newsletter / no-reply (regex sur l'email normalisé) -> score 15
  4. sinon -> candidat LLM (signaux `known_sender` + `action_keywords`)
"""

from __future__ import annotations

import re
from collections import Counter

from app.services.mail_triage.normalize import email_expediteur

_NEWSLETTER_RE = re.compile(
    r"no-?reply@|newsletter@|mailer-daemon|notifications?@", re.IGNORECASE
)
_ACTION_KEYWORDS = (
    "merci de", "peux-tu", "urgent", "avant le", "confirme",
    "réponds", "facture", "paiement", "rendez-vous",
)


def _action_keywords_found(sujet: str | None, extrait: str | None) -> list[str]:
    haystack = f"{sujet or ''} {extrait or ''}".lower()
    return [kw for kw in _ACTION_KEYWORDS if kw in haystack]


def _scored(mail: dict, score: int, reason: str) -> dict:
    return {
        "mail_id": mail["mail_id"],
        "score": score,
        "reason": reason,
        "source": "prefilter",
    }


def prefilter_mails(mails: list[dict], sender_prefs: dict[str, str]) -> dict:
    """Retourne `{"auto_scored": [ScoredMail], "candidates": [mail + signaux]}`.

    `known_sender` (signal fourni aux candidats) : l'expéditeur normalisé
    apparaît plus d'une fois dans le lot chargé (déjà vu récemment) - seul
    signal calculable sans accès BDD dans cette fonction pure.
    """
    emails = [email_expediteur(m.get("expediteur")) for m in mails]
    frequency = Counter(emails)

    auto_scored: list[dict] = []
    candidates: list[dict] = []

    for mail, email in zip(mails, emails):
        pref = sender_prefs.get(email)

        if pref == "muet":
            auto_scored.append(_scored(mail, 5, "Expéditeur en sourdine"))
            continue
        if pref == "important":
            auto_scored.append(_scored(mail, 85, "Expéditeur marqué important"))
            continue
        if email and _NEWSLETTER_RE.search(email):
            auto_scored.append(
                _scored(mail, 15, "Newsletter / notification automatique")
            )
            continue

        candidates.append(
            {
                **mail,
                "known_sender": frequency[email] > 1,
                "action_keywords": _action_keywords_found(
                    mail.get("sujet"), mail.get("extrait")
                ),
            }
        )

    return {"auto_scored": auto_scored, "candidates": candidates}
