"""Hachage du code d'acces au budget + jeton de deverrouillage (12 h).

Deux briques independantes :

1. `hacher_code` / `verifier_code` : derivation scrypt salee (stdlib `hashlib`,
   aucune dependance ajoutee). Le code a 4 chiffres n'est JAMAIS stocke en
   clair, ni journalise. Comparaison en temps constant (`hmac.compare_digest`).

2. `emettre_jeton` / `verifier_jeton` : jeton HMAC-SHA256 sans etat, signe avec
   `BETTER_AUTH_SECRET`, portant l'identifiant utilisateur et une expiration.
   Il est renvoye au navigateur apres saisie du code et reprsente sur chaque
   appel budget via l'en-tete `X-Budget-Acces`. Sans etat volontairement : pas
   de table de sessions a purger, et le jeton reste lie a l'appareil qui l'a
   obtenu (il vit dans le stockage local de ce navigateur).

Un code a 4 chiffres n'a que 10 000 combinaisons : la limitation du debit
d'essais (compteur + blocage temporaire en base, cf. `services/budget_acces.py`)
fait partie integrante de la protection, le hachage seul ne suffit pas.
"""

from __future__ import annotations

import base64
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import scrypt, sha256

from app.config import settings

# Parametres scrypt : n=2**14 tient largement sous les 100 ms sur le serveur,
# ce qui est confortable pour une saisie interactive tout en rendant une
# attaque hors-ligne couteuse.
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_LONGUEUR_CLE = 32

_PREFIXE = "scrypt"

#: Duree de validite du deverrouillage, choisie par l'utilisateur : 12 heures.
DUREE_ACCES = timedelta(hours=12)


def _b64(brut: bytes) -> str:
    return base64.urlsafe_b64encode(brut).decode().rstrip("=")


def _deb64(texte: str) -> bytes:
    rembourrage = "=" * (-len(texte) % 4)
    return base64.urlsafe_b64decode(texte + rembourrage)


def _deriver(code: str, sel: bytes) -> bytes:
    return scrypt(
        code.encode("utf-8"),
        salt=sel,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_LONGUEUR_CLE,
    )


def hacher_code(code: str) -> str:
    """Retourne `scrypt$n$r$p$<sel>$<derive>` (tout en base64url sans padding)."""
    sel = secrets.token_bytes(16)
    derive = _deriver(code, sel)
    return f"{_PREFIXE}${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(sel)}${_b64(derive)}"


def verifier_code(code: str, empreinte: str) -> bool:
    """Compare `code` a une empreinte produite par `hacher_code`.

    Toute empreinte illisible (format inattendu, base64 corrompue) renvoie
    False plutot que de lever : un enregistrement abime ne doit pas ouvrir
    l'acces, ni faire tomber l'endpoint en 500.
    """
    try:
        prefixe, n, r, p, sel_b64, derive_b64 = empreinte.split("$")
        if prefixe != _PREFIXE:
            return False
        attendu = _deb64(derive_b64)
        obtenu = scrypt(
            code.encode("utf-8"),
            salt=_deb64(sel_b64),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(attendu),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(obtenu, attendu)


def emettre_jeton(user_id: str) -> tuple[str, datetime]:
    """Signe un jeton `<user_id>.<expiration>.<signature>` valable 12 h."""
    expire_a = datetime.now(timezone.utc) + DUREE_ACCES
    horodatage = str(int(expire_a.timestamp()))
    charge = f"{user_id}.{horodatage}"
    return f"{charge}.{_signer(charge)}", expire_a


def verifier_jeton(jeton: str | None, user_id: str) -> bool:
    """Valide signature, appartenance et fraicheur du jeton.

    Le jeton porte l'identifiant utilisateur : un jeton valide obtenu par un
    autre compte ne deverrouille pas celui-ci.
    """
    if not jeton:
        return False
    morceaux = jeton.rsplit(".", 1)
    if len(morceaux) != 2:
        return False
    charge, signature = morceaux
    if not hmac.compare_digest(signature, _signer(charge)):
        return False

    proprietaire, _, horodatage = charge.rpartition(".")
    if proprietaire != user_id:
        return False
    try:
        expire_a = int(horodatage)
    except ValueError:
        return False
    return datetime.now(timezone.utc).timestamp() < expire_a


def _signer(charge: str) -> str:
    digest = hmac.new(
        settings.better_auth_secret.encode(), charge.encode(), sha256
    ).digest()
    return _b64(digest)
