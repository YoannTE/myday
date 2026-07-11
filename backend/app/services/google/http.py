"""Requetes HTTP Google avec backoff borne sur 429/5xx.

Les clients Agenda/Gmail passent par `google_request`, qui reessaie de facon
bornee sur les erreurs transitoires (quota 429, panne 5xx) puis rend la reponse
telle quelle. L'interpretation des codes (401/410/404/409) reste a la charge de
chaque client. Les appels sont deja dans un contexte @step-like (deterministe au
sens du design : lecture idempotente ou insertion reconciliee).
"""

from __future__ import annotations

import asyncio

import httpx

# Codes transitoires : on reessaie ; les autres remontent immediatement.
_RETRYABLE = {429, 500, 502, 503, 504}
_MAX_RETRIES = 3
_BASE_DELAY = 0.5
_MAX_DELAY = 8.0


async def google_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    params: dict | None = None,
    json: dict | None = None,
    max_retries: int = _MAX_RETRIES,
) -> httpx.Response:
    """Envoie une requete Google avec backoff exponentiel borne sur 429/5xx."""
    delay = _BASE_DELAY
    resp: httpx.Response | None = None
    for attempt in range(max_retries + 1):
        resp = await client.request(method, url, params=params, json=json)
        if resp.status_code in _RETRYABLE and attempt < max_retries:
            retry_after = _parse_retry_after(resp)
            await asyncio.sleep(retry_after if retry_after is not None else min(delay, _MAX_DELAY))
            delay *= 2
            continue
        return resp
    # Inatteignable (la boucle retourne toujours), garde-fou de typage.
    assert resp is not None
    return resp


def _parse_retry_after(resp: httpx.Response) -> float | None:
    """Lit l'en-tete Retry-After (secondes) si present et numerique."""
    raw = resp.headers.get("Retry-After")
    if raw is None:
        return None
    try:
        return min(float(raw), _MAX_DELAY)
    except ValueError:
        return None
