"""Envoi Web Push (VAPID) + orchestration best-effort par utilisateur.

`pywebpush.webpush` est SYNCHRONE et bloquant (requête HTTP) : appelé
UNIQUEMENT via `anyio.to_thread.run_sync` (correction #1 du plan) pour ne
jamais geler l'event loop partagé avec les 3 schedulers du process.

`dispatch_push` est HORS transaction BDD pendant l'envoi réseau (correction
#2) : la lecture (préférence, plafond, abonnements) se fait dans UNE
`scoped_connection` qui est refermée AVANT l'envoi ; les abonnements morts
sont purgés dans une connexion séparée après coup. Un pool `max_size=10`
partagé avec tous les endpoints ne doit jamais être bloqué par un envoi
réseau lent.

Pas de fallback email (correction #4) : envoyer un mail au user via Gmail
créerait une boucle d'auto-ingestion (le mail serait resynchronisé puis
re-trié par mail_triage) et dépend d'un token Google potentiellement absent.
Différé hors périmètre de ce round - push uniquement.
"""

from __future__ import annotations

import json
import logging

import anyio
from pywebpush import WebPushException, webpush

from app.config import settings
from app.db.client import scoped_connection

logger = logging.getLogger("myday.push")

# Type de notification -> colonne de préférence (user_preferences). Défaut
# actif (true) si la ligne de préférences n'existe pas encore (create-or-
# default paresseux, même pattern que mail_triage/daily_brief).
_PREF_COLUMN = {
    "mail_important": "notif_important_mail",
    "rappel_evenement": "notif_event_reminder",
    "brief_pret": "notif_brief_ready",
}


class DeadSubscriptionError(Exception):
    """L'abonnement push est mort (404/410) : à purger côté appelant."""


async def send_web_push(sub: dict, payload: dict) -> None:
    """Envoie une notification push à un abonnement unique.

    Format de clé VAPID (correction #5) : `settings.vapid_private_key` est le
    base64url des 32 octets bruts. Vérifié manuellement - `pywebpush.webpush`
    délègue à `py_vapid.Vapid.from_string(...)`, qui détecte le format RAW
    quand le décodage base64url fait 32 octets et construit la clé sans
    conversion supplémentaire. Pas besoin de construire `Vapid01.from_raw`.
    """

    def _send() -> None:
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            data=_encode_payload(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
        )

    try:
        await anyio.to_thread.run_sync(_send)
    except WebPushException as exc:
        status_code = getattr(exc.response, "status_code", None)
        if status_code in (404, 410):
            raise DeadSubscriptionError(str(exc)) from exc
        raise


def _encode_payload(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)


async def dispatch_push(
    user_id: str, type_notif: str, title: str, body: str, url: str | None = None
) -> int:
    """Envoi best-effort à tous les abonnements du user, si la préférence par
    type est active et le plafond `push_max_per_hour` non atteint. Ne lève
    jamais - un échec réseau isolé n'interrompt jamais l'appelant (bridge
    mail/brief/rappels). Retourne le nombre d'envois réussis."""
    pref_column = _PREF_COLUMN.get(type_notif)
    async with scoped_connection(user_id) as conn:
        if pref_column is not None:
            notif_active = await conn.fetchval(
                f"SELECT {pref_column} FROM user_preferences WHERE user_id = $1",
                user_id,
            )
            if notif_active is False:
                return 0
        already_sent = await conn.fetchval(
            """
            SELECT count(*) FROM notifications
            WHERE user_id = $1 AND date_envoi > now() - interval '1 hour'
            """,
            user_id,
        )
        if already_sent >= settings.push_max_per_hour:
            return 0
        subs = [
            dict(r)
            for r in await conn.fetch(
                "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
                user_id,
            )
        ]
    if not subs:
        return 0

    # Connexion BDD refermée : l'envoi réseau qui suit ne tient plus de slot du pool.
    payload = {"title": title, "body": body[:200], "url": url or "/"}
    sent = 0
    dead_endpoints: list[str] = []
    for sub in subs:
        try:
            await send_web_push(sub, payload)
            sent += 1
        except DeadSubscriptionError:
            dead_endpoints.append(sub["endpoint"])
        except Exception as exc:  # best-effort : jamais bloquant pour l'appelant
            logger.warning("push: envoi échoué user=%s: %r", user_id, exc)

    if dead_endpoints:
        async with scoped_connection(user_id) as conn:
            for endpoint in dead_endpoints:
                await conn.execute(
                    "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
                    user_id, endpoint,
                )
    return sent
