"""Chiffrement enveloppe des jetons Google OAuth (AES-256-GCM).

Les jetons d'acces et de rafraichissement Google ne sont JAMAIS stockes en clair :
ils sont chiffres avec AES-256-GCM (chiffrement authentifie) avant d'etre ecrits
dans les colonnes `access_token` / `refresh_token` de `google_connections`, et
dechiffres uniquement au moment de l'appel Google.

Format du jeton chiffre (avant encodage base64) :

    version (1 octet) || nonce (12 octets) || ciphertext+tag (n octets)

AES-GCM place son tag d'authentification (16 octets) a la fin du ciphertext :
`ciphertext+tag` couvre donc le `|| ciphertext || tag` du format. L'octet de
version prepare une eventuelle rotation d'algorithme sans casser les anciens
jetons. Le tout est encode en base64 pour tenir dans une colonne `text`.

La cle `TOKEN_ENCRYPTION_KEY` (32 octets encodes en base64) est lue hors BDD.
Elle est validee au CHARGEMENT du module (fail-fast) : une cle absente ou de
mauvaise longueur fait echouer l'import, donc le boot FastAPI.
"""

from __future__ import annotations

import base64
import binascii
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

# Version du format d'enveloppe (permet une rotation d'algorithme ulterieure).
_VERSION = 1
# Taille du nonce AES-GCM recommandee (96 bits).
_NONCE_SIZE = 12
# Taille attendue de la cle AES-256 (256 bits).
_KEY_SIZE = 32


class TokenCipherError(Exception):
    """Erreur de configuration ou de dechiffrement des jetons chiffres."""


def _decode_key(raw: str) -> bytes:
    """Decode et valide la cle base64 (fail-fast, message explicite)."""
    if not raw:
        raise TokenCipherError(
            "TOKEN_ENCRYPTION_KEY absente : definir une cle de 32 octets "
            "encodee en base64 dans .env.local."
        )
    try:
        key = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise TokenCipherError(
            "TOKEN_ENCRYPTION_KEY invalide : base64 attendu."
        ) from exc
    if len(key) != _KEY_SIZE:
        raise TokenCipherError(
            "TOKEN_ENCRYPTION_KEY doit faire 32 octets une fois decodee "
            f"(recu {len(key)})."
        )
    return key


# Fail-fast au chargement du module : cle validee une seule fois, gardee en
# memoire pour la duree du process (jamais loggee).
_KEY: bytes = _decode_key(settings.token_encryption_key)
_AESGCM = AESGCM(_KEY)


def encrypt(plaintext: str) -> str:
    """Chiffre une chaine et renvoie le jeton chiffre encode en base64.

    Un nonce aleatoire est genere a chaque appel : deux chiffrements du meme
    texte produisent des sorties differentes (pas de fuite par egalite).
    """
    nonce = os.urandom(_NONCE_SIZE)
    ciphertext = _AESGCM.encrypt(nonce, plaintext.encode("utf-8"), None)
    blob = bytes([_VERSION]) + nonce + ciphertext
    return base64.b64encode(blob).decode("ascii")


def decrypt(token: str) -> str:
    """Dechiffre un jeton produit par `encrypt` et renvoie le texte d'origine.

    Leve `TokenCipherError` si le jeton est malforme, si la version est inconnue
    ou si l'authentification GCM echoue (nonce, ciphertext ou tag falsifie).
    """
    try:
        blob = base64.b64decode(token, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise TokenCipherError("Jeton chiffre invalide : base64 attendu.") from exc

    if len(blob) < 1 + _NONCE_SIZE + 16:
        raise TokenCipherError("Jeton chiffre invalide : trop court.")

    version = blob[0]
    if version != _VERSION:
        raise TokenCipherError(f"Version de jeton chiffre inconnue : {version}.")

    nonce = blob[1 : 1 + _NONCE_SIZE]
    ciphertext = blob[1 + _NONCE_SIZE :]
    try:
        plaintext = _AESGCM.decrypt(nonce, ciphertext, None)
    except InvalidTag as exc:
        raise TokenCipherError(
            "Echec du dechiffrement : jeton falsifie ou mauvaise cle."
        ) from exc
    return plaintext.decode("utf-8")
