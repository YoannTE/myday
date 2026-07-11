"""Tests du chiffrement enveloppe des jetons Google (AES-256-GCM)."""

import base64

import pytest

from app.security import token_cipher
from app.security.token_cipher import TokenCipherError, decrypt, encrypt


def test_round_trip_preserve_le_texte():
    """encrypt puis decrypt redonne exactement le texte d'origine."""
    secret = "ya29.a0AfB_faux_jeton_dacces_google-123456"
    assert decrypt(encrypt(secret)) == secret


def test_round_trip_texte_unicode():
    """Les caracteres accentues et UTF-8 sont preserves."""
    secret = "jeton-éàçùô-🔐-refresh"
    assert decrypt(encrypt(secret)) == secret


def test_round_trip_chaine_vide():
    """Une chaine vide est chiffrable et redonne une chaine vide."""
    assert decrypt(encrypt("")) == ""


def test_nonce_aleatoire_produit_des_sorties_differentes():
    """Deux chiffrements du meme texte different (nonce aleatoire)."""
    a = encrypt("meme-secret")
    b = encrypt("meme-secret")
    assert a != b
    assert decrypt(a) == decrypt(b) == "meme-secret"


def test_tampering_du_ciphertext_leve_une_exception():
    """Modifier un octet du ciphertext fait echouer l'authentification GCM."""
    token = encrypt("jeton-sensible")
    blob = bytearray(base64.b64decode(token))
    # Flip un octet dans le corps du ciphertext (apres version + nonce)
    blob[1 + 12 + 1] ^= 0x01
    falsifie = base64.b64encode(bytes(blob)).decode()
    with pytest.raises(TokenCipherError):
        decrypt(falsifie)


def test_tampering_du_nonce_leve_une_exception():
    """Modifier le nonce fait echouer le dechiffrement authentifie."""
    token = encrypt("jeton-sensible")
    blob = bytearray(base64.b64decode(token))
    # Flip un octet du nonce (juste apres l'octet de version)
    blob[1] ^= 0x01
    falsifie = base64.b64encode(bytes(blob)).decode()
    with pytest.raises(TokenCipherError):
        decrypt(falsifie)


def test_tampering_du_tag_leve_une_exception():
    """Modifier le tag d'authentification (dernier octet) leve une exception."""
    token = encrypt("jeton-sensible")
    blob = bytearray(base64.b64decode(token))
    blob[-1] ^= 0x01
    falsifie = base64.b64encode(bytes(blob)).decode()
    with pytest.raises(TokenCipherError):
        decrypt(falsifie)


def test_version_inconnue_leve_une_exception():
    """Un octet de version different est rejete."""
    token = encrypt("jeton-sensible")
    blob = bytearray(base64.b64decode(token))
    blob[0] = 99
    falsifie = base64.b64encode(bytes(blob)).decode()
    with pytest.raises(TokenCipherError):
        decrypt(falsifie)


def test_jeton_non_base64_leve_une_exception():
    """Une entree qui n'est pas du base64 valide est rejetee proprement."""
    with pytest.raises(TokenCipherError):
        decrypt("pas du base64 !!!")


def test_jeton_trop_court_leve_une_exception():
    """Un blob plus court que version+nonce+tag est rejete."""
    trop_court = base64.b64encode(b"\x01\x00\x00").decode()
    with pytest.raises(TokenCipherError):
        decrypt(trop_court)


def test_cle_absente_erreur_claire():
    """Une cle vide leve une erreur explicite (fail-fast)."""
    with pytest.raises(TokenCipherError, match="absente"):
        token_cipher._decode_key("")


def test_cle_mauvaise_longueur_erreur_claire():
    """Une cle qui ne fait pas 32 octets est rejetee avec un message clair."""
    cle_16 = base64.b64encode(b"\x00" * 16).decode()
    with pytest.raises(TokenCipherError, match="32 octets"):
        token_cipher._decode_key(cle_16)


def test_cle_non_base64_erreur_claire():
    """Une cle qui n'est pas du base64 est rejetee."""
    with pytest.raises(TokenCipherError, match="base64"):
        token_cipher._decode_key("!!! pas base64 !!!")


def test_cle_valide_decodee_fait_32_octets():
    """Une cle base64 correcte est decodee en 32 octets."""
    cle = base64.b64encode(b"\x2a" * 32).decode()
    assert token_cipher._decode_key(cle) == b"\x2a" * 32
