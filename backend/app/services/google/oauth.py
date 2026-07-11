"""OAuth Google : echange de code, rafraichissement single-flight, revocation.

- `exchange_code` : appele par `POST /api/google/exchange` (delegue par le Route
  Handler Next). Echange le code PKCE contre les jetons, calcule `token_expiry`
  depuis `expires_in`, stocke chiffre via le repository.
- `refresh_access_token` : appele UNIQUEMENT par `load_connection` (jamais les
  branches), sous le verrou de sync. Single-flight intra-process : deux appels
  concurrents pour le meme utilisateur ne declenchent qu'un seul echange reseau.
  `invalid_grant` (refresh token revoque) → `set_reauth_required`.
- `revoke_token` : best-effort (deconnexion / suppression de compte), non bloquant.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings
from app.db.client import scoped_connection
from app.db.google_connection import read_tokens, set_reauth_required, upsert_tokens
from app.services.google.constants import GOOGLE_REVOKE_URL, GOOGLE_TOKEN_URL

# Marge de rafraichissement : on rafraichit un peu avant l'expiration reelle.
_REFRESH_MARGIN = timedelta(seconds=60)
_TOKEN_TIMEOUT = 15.0
_REVOKE_TIMEOUT = 3.0

# Verrous single-flight par (event loop, user_id) : evite un verrou lie a une
# loop fermee (les tests utilisent une loop dediee par appel).
_refresh_locks: dict[tuple[int, str], asyncio.Lock] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def needs_refresh(token_expiry: datetime | None) -> bool:
    """Vrai si le jeton d'acces est absent ou expire (avec marge de securite)."""
    if token_expiry is None:
        return True
    if token_expiry.tzinfo is None:
        token_expiry = token_expiry.replace(tzinfo=timezone.utc)
    return token_expiry <= _now() + _REFRESH_MARGIN


async def _get_refresh_lock(user_id: str) -> asyncio.Lock:
    key = (id(asyncio.get_running_loop()), user_id)
    lock = _refresh_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _refresh_locks[key] = lock
    return lock


async def _post_token(data: dict, http_client: httpx.AsyncClient | None) -> tuple[dict, int]:
    """POST vers l'endpoint token Google ; renvoie (corps JSON, code HTTP)."""
    close = http_client is None
    client = http_client or httpx.AsyncClient(timeout=_TOKEN_TIMEOUT)
    try:
        resp = await client.post(GOOGLE_TOKEN_URL, data=data)
    finally:
        if close:
            await client.aclose()
    try:
        body = resp.json()
    except ValueError:
        body = {}
    return body, resp.status_code


async def exchange_code(
    user_id: str,
    code: str,
    code_verifier: str,
    *,
    http_client: httpx.AsyncClient | None = None,
) -> dict:
    """Echange le code d'autorisation (PKCE) contre les jetons et les stocke.

    Renvoie `{"scopes": [...], "status": "connected"}` en cas de succes.
    Leve `ValueError` (message francais) si Google refuse l'echange.
    """
    body, status_code = await _post_token(
        {
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": code_verifier,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
        },
        http_client,
    )
    if status_code != 200 or "access_token" not in body:
        raise ValueError(body.get("error_description") or "Echec de l'echange OAuth Google.")

    scopes = body.get("scope", "").split() or None
    token_expiry = _now() + timedelta(seconds=int(body.get("expires_in", 3600)))
    await upsert_tokens(
        user_id,
        access_token=body["access_token"],
        refresh_token=body.get("refresh_token"),
        token_expiry=token_expiry,
        scopes=scopes,
    )
    return {"scopes": scopes or [], "status": "connected"}


async def refresh_access_token(
    user_id: str, *, http_client: httpx.AsyncClient | None = None
) -> bool:
    """Rafraichit le jeton d'acces (single-flight). Renvoie True si valide ensuite.

    `invalid_grant` (refresh token revoque) → `set_reauth_required` + False.
    """
    lock = await _get_refresh_lock(user_id)
    async with lock:
        tokens = await read_tokens(user_id)
        if tokens is None:
            return False
        # Un appel concurrent a deja bascule en reauth : ne pas re-tenter.
        if tokens.get("status") == "reauth_required":
            return False
        if not tokens.get("refresh_token"):
            await set_reauth_required(user_id)
            return False
        # Un appel concurrent a deja rafraichi : le jeton n'est plus expire.
        if not needs_refresh(tokens.get("token_expiry")):
            return True

        body, status_code = await _post_token(
            {
                "grant_type": "refresh_token",
                "refresh_token": tokens["refresh_token"],
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
            },
            http_client,
        )
        if status_code != 200 or "access_token" not in body:
            if body.get("error") == "invalid_grant":
                await set_reauth_required(user_id)
            return False

        token_expiry = _now() + timedelta(seconds=int(body.get("expires_in", 3600)))
        await upsert_tokens(
            user_id,
            access_token=body["access_token"],
            refresh_token=body.get("refresh_token"),
            token_expiry=token_expiry,
        )
        return True


async def revoke_token(user_id: str) -> None:
    """Revoque l'acces Google (best-effort, timeout court, jamais bloquant).

    Toute erreur (reseau, jeton deja invalide) est ignoree : la suppression
    locale de la connexion / du compte ne doit jamais dependre de Google.
    """
    try:
        tokens = await read_tokens(user_id)
        if tokens is None:
            return
        token = tokens.get("refresh_token") or tokens.get("access_token")
        if not token:
            return
        async with httpx.AsyncClient(timeout=_REVOKE_TIMEOUT) as client:
            await client.post(GOOGLE_REVOKE_URL, data={"token": token})
    except Exception:
        # Best-effort : on n'echoue jamais la deconnexion pour une revocation ratee.
        return


async def disconnect_google(user_id: str) -> bool:
    """Deconnecte Google : revocation best-effort puis suppression de la connexion.

    Renvoie False s'il n'y avait pas de connexion a supprimer.
    """
    await revoke_token(user_id)
    async with scoped_connection(user_id) as conn:
        res = await conn.execute(
            "DELETE FROM google_connections WHERE user_id = $1", user_id
        )
    return res.endswith(" 1")
