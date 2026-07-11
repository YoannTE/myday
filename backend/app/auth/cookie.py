"""Verification du cookie de session Better-auth (v1.6.23).

Format reel verifie par login local :
    valeur = "<token>.<signature>"
    - <token>      : identifiant stocke tel quel dans session.token (BDD)
    - <signature>  : base64 standard de HMAC-SHA256(secret_utf8, token_utf8)

Le cookie est URL-encode en transit (`+`->`%2B`, `/`->`%2F`, `=`->`%3D`).
On le decode d'abord, puis on separe token/signature sur le DERNIER point
(le token Better-auth ne contient pas de point, mais on reste defensif).
"""

import base64
import hmac
from hashlib import sha256
from urllib.parse import unquote

# Nom du cookie en dev ; en prod HTTPS Better-auth le prefixe __Secure-.
COOKIE_NAME = "better-auth.session_token"
COOKIE_NAME_SECURE = f"__Secure-{COOKIE_NAME}"


def _expected_signature(token: str, secret: str) -> str:
    digest = hmac.new(secret.encode(), token.encode(), sha256).digest()
    return base64.b64encode(digest).decode()


def verify_session_cookie(raw_value: str, secret: str) -> str | None:
    """Retourne le token si la signature est valide, sinon None.

    Ne fait AUCUN acces BDD : verifie uniquement l'integrite cryptographique.
    """
    if not raw_value or not secret:
        return None

    value = unquote(raw_value)
    if "." not in value:
        return None

    token, _, signature = value.rpartition(".")
    if not token or not signature:
        return None

    expected = _expected_signature(token, secret)
    # compare_digest : comparaison a temps constant (anti timing attack).
    if not hmac.compare_digest(signature, expected):
        return None

    return token


def extract_cookie_value(cookies: dict[str, str]) -> str | None:
    """Recupere la valeur brute du cookie de session (dev ou prod __Secure-)."""
    return cookies.get(COOKIE_NAME) or cookies.get(COOKIE_NAME_SECURE)
