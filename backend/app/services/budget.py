"""Logique métier du budget : récurrents, opérations, prévisions, comptes.

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS) — jamais le
pool admin : ce sont des données de contenu utilisateur, parmi les plus
sensibles de l'application.

Deux conversions se font ici, à la frontière :

- **argent** : `numeric(12,2)` en base ↔ `Decimal` côté asyncpg ↔ `float` sur le
  fil JSON. On convertit en `Decimal` AVANT l'écriture (jamais un float envoyé
  tel quel à Postgres) et on quantifie à 2 décimales, pour qu'un `19.999`
  arrivant du navigateur ne soit pas rejeté par la colonne.
- **UUID** : asyncpg renvoie des objets `UUID`, sérialisés en `str`.

Les mises à jour partielles utilisent le motif « SELECT courant puis UPDATE de
toutes les colonnes » déjà en place dans `services/preferences.py` : simple,
sans SQL dynamique, et `model_dump(exclude_unset=True)` distingue « champ
absent » de « champ mis à null » (indispensable pour déplanifier une prévision
en passant `echeance: null`).
"""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation

import asyncpg

from app.db.client import scoped_connection
from app.models.budget import (
    BudgetCompteCreate,
    BudgetCompteUpdate,
    BudgetOperationCreate,
    BudgetOperationUpdate,
    BudgetPrevisionCreate,
    BudgetPrevisionUpdate,
    BudgetRecurrentCreate,
    BudgetRecurrentUpdate,
)
from app.utils.errors import bad_request, not_found

ECHEANCE_RE = re.compile(r"^[0-9]{4}-(0[1-9]|1[0-2])$")

#: numeric(12,2) : 10 chiffres avant la virgule au maximum.
MONTANT_MAX = Decimal("9999999999.99")

LIBELLE_MAX = 160
CENTIMES = Decimal("0.01")

_COLS_RECURRENT = (
    "id, libelle, categorie, montant, sens, actif, created_at, updated_at"
)
_COLS_OPERATION = (
    "id, date_operation, libelle, categorie, montant, sens, created_at, updated_at"
)
_COLS_PREVISION = (
    "id, libelle, categorie, montant, sens, echeance, fait, note, "
    "created_at, updated_at"
)
_COLS_COMPTE = "id, libelle, montant, date_releve, created_at, updated_at"


# ====================================================================
# Validation et conversion
# ====================================================================


def _montant(valeur: float | int | Decimal, *, signe_libre: bool = False) -> Decimal:
    """Convertit un montant du fil vers un `Decimal` à 2 décimales.

    `signe_libre=True` pour les comptes uniquement : un solde peut être négatif
    (découvert, crédit en cours). Partout ailleurs le montant est positif, c'est
    `sens` qui porte le signe.
    """
    try:
        montant = Decimal(str(valeur)).quantize(CENTIMES)
    except (InvalidOperation, ValueError):
        raise bad_request("Le montant n'est pas un nombre valide.") from None
    if not signe_libre and montant < 0:
        raise bad_request("Le montant doit être positif.")
    if abs(montant) > MONTANT_MAX:
        raise bad_request("Le montant est trop élevé.")
    return montant


def _libelle(valeur: str, *, champ: str = "libellé") -> str:
    nettoye = valeur.strip()
    if not nettoye:
        raise bad_request(f"Le {champ} est obligatoire.")
    if len(nettoye) > LIBELLE_MAX:
        raise bad_request(f"Le {champ} ne peut pas dépasser {LIBELLE_MAX} caractères.")
    return nettoye


def _echeance(valeur: str | None) -> str | None:
    """Une échéance est un mois `AAAA-MM`, ou rien du tout (non planifié)."""
    if valeur is None:
        return None
    nettoye = valeur.strip()
    if not nettoye:
        return None
    if not ECHEANCE_RE.match(nettoye):
        raise bad_request("L'échéance doit être un mois au format AAAA-MM.")
    return nettoye


def _f(valeur: Decimal | None) -> float:
    return float(valeur) if valeur is not None else 0.0


# ====================================================================
# Sérialisation
# ====================================================================


def _recurrent(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "libelle": row["libelle"],
        "categorie": row["categorie"],
        "montant": _f(row["montant"]),
        "sens": row["sens"],
        "actif": row["actif"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _operation(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "date_operation": row["date_operation"],
        "libelle": row["libelle"],
        "categorie": row["categorie"],
        "montant": _f(row["montant"]),
        "sens": row["sens"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _prevision(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "libelle": row["libelle"],
        "categorie": row["categorie"],
        "montant": _f(row["montant"]),
        "sens": row["sens"],
        "echeance": row["echeance"],
        "fait": row["fait"],
        "note": row["note"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _compte(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "libelle": row["libelle"],
        "montant": _f(row["montant"]),
        "date_releve": row["date_releve"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# ====================================================================
# Lecture globale
# ====================================================================


async def lire_tout(user_id: str) -> dict:
    """Renvoie l'intégralité du budget en un seul aller-retour.

    La page calcule tout côté client (soldes du mois, projection 12 mois,
    répartition par poste) : lui livrer l'ensemble d'un coup évite une cascade
    de requêtes et rend la navigation entre mois instantanée. Le volume reste
    celui d'un budget familial (quelques milliers de lignes au pire).
    """
    async with scoped_connection(user_id) as conn:
        recurrents = await conn.fetch(
            f"SELECT {_COLS_RECURRENT} FROM budget_recurrents WHERE user_id = $1 "
            "ORDER BY montant DESC, libelle",
            user_id,
        )
        operations = await conn.fetch(
            f"SELECT {_COLS_OPERATION} FROM budget_operations WHERE user_id = $1 "
            "ORDER BY date_operation DESC, created_at DESC",
            user_id,
        )
        previsions = await conn.fetch(
            f"SELECT {_COLS_PREVISION} FROM budget_previsions WHERE user_id = $1 "
            "ORDER BY echeance NULLS LAST, montant DESC",
            user_id,
        )
        comptes = await conn.fetch(
            f"SELECT {_COLS_COMPTE} FROM budget_comptes WHERE user_id = $1 "
            "ORDER BY created_at",
            user_id,
        )
    return {
        "recurrents": [_recurrent(r) for r in recurrents],
        "operations": [_operation(r) for r in operations],
        "previsions": [_prevision(r) for r in previsions],
        "comptes": [_compte(r) for r in comptes],
    }


# ====================================================================
# Récurrents
# ====================================================================


async def creer_recurrent(user_id: str, payload: BudgetRecurrentCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"""
            INSERT INTO budget_recurrents
              (user_id, libelle, categorie, montant, sens, actif)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING {_COLS_RECURRENT}
            """,
            user_id,
            _libelle(payload.libelle),
            _libelle(payload.categorie, champ="nom de catégorie"),
            _montant(payload.montant),
            payload.sens,
            payload.actif,
        )
    return _recurrent(row)


async def modifier_recurrent(
    user_id: str, recurrent_id: str, payload: BudgetRecurrentUpdate
) -> dict:
    champs = payload.model_dump(exclude_unset=True)
    async with scoped_connection(user_id) as conn:
        actuel = await _courant(conn, "budget_recurrents", _COLS_RECURRENT, recurrent_id)
        row = await conn.fetchrow(
            f"""
            UPDATE budget_recurrents
            SET libelle = $2, categorie = $3, montant = $4, sens = $5, actif = $6,
                updated_at = now()
            WHERE id = $1
            RETURNING {_COLS_RECURRENT}
            """,
            actuel["id"],
            _libelle(champs.get("libelle", actuel["libelle"])),
            _libelle(
                champs.get("categorie", actuel["categorie"]), champ="nom de catégorie"
            ),
            _montant(champs.get("montant", actuel["montant"])),
            champs.get("sens", actuel["sens"]),
            champs.get("actif", actuel["actif"]),
        )
    return _recurrent(row)


async def supprimer_recurrent(user_id: str, recurrent_id: str) -> None:
    await _supprimer(user_id, "budget_recurrents", recurrent_id)


# ====================================================================
# Opérations ponctuelles
# ====================================================================


async def creer_operation(user_id: str, payload: BudgetOperationCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"""
            INSERT INTO budget_operations
              (user_id, date_operation, libelle, categorie, montant, sens)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING {_COLS_OPERATION}
            """,
            user_id,
            payload.date_operation,
            _libelle(payload.libelle),
            _libelle(payload.categorie, champ="nom de catégorie"),
            _montant(payload.montant),
            payload.sens,
        )
    return _operation(row)


async def modifier_operation(
    user_id: str, operation_id: str, payload: BudgetOperationUpdate
) -> dict:
    champs = payload.model_dump(exclude_unset=True)
    async with scoped_connection(user_id) as conn:
        actuel = await _courant(conn, "budget_operations", _COLS_OPERATION, operation_id)
        nouvelle_date = champs.get("date_operation", actuel["date_operation"])
        if not isinstance(nouvelle_date, date):
            raise bad_request("La date de l'opération est invalide.")
        row = await conn.fetchrow(
            f"""
            UPDATE budget_operations
            SET date_operation = $2, libelle = $3, categorie = $4, montant = $5,
                sens = $6, updated_at = now()
            WHERE id = $1
            RETURNING {_COLS_OPERATION}
            """,
            actuel["id"],
            nouvelle_date,
            _libelle(champs.get("libelle", actuel["libelle"])),
            _libelle(
                champs.get("categorie", actuel["categorie"]), champ="nom de catégorie"
            ),
            _montant(champs.get("montant", actuel["montant"])),
            champs.get("sens", actuel["sens"]),
        )
    return _operation(row)


async def supprimer_operation(user_id: str, operation_id: str) -> None:
    await _supprimer(user_id, "budget_operations", operation_id)


# ====================================================================
# Prévisions
# ====================================================================


async def creer_prevision(user_id: str, payload: BudgetPrevisionCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"""
            INSERT INTO budget_previsions
              (user_id, libelle, categorie, montant, sens, echeance, fait, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING {_COLS_PREVISION}
            """,
            user_id,
            _libelle(payload.libelle),
            _libelle(payload.categorie, champ="nom de catégorie"),
            _montant(payload.montant),
            payload.sens,
            _echeance(payload.echeance),
            payload.fait,
            (payload.note or "").strip() or None,
        )
    return _prevision(row)


async def modifier_prevision(
    user_id: str, prevision_id: str, payload: BudgetPrevisionUpdate
) -> dict:
    champs = payload.model_dump(exclude_unset=True)
    async with scoped_connection(user_id) as conn:
        actuel = await _courant(conn, "budget_previsions", _COLS_PREVISION, prevision_id)
        note = champs.get("note", actuel["note"])
        row = await conn.fetchrow(
            f"""
            UPDATE budget_previsions
            SET libelle = $2, categorie = $3, montant = $4, sens = $5,
                echeance = $6, fait = $7, note = $8, updated_at = now()
            WHERE id = $1
            RETURNING {_COLS_PREVISION}
            """,
            actuel["id"],
            _libelle(champs.get("libelle", actuel["libelle"])),
            _libelle(
                champs.get("categorie", actuel["categorie"]), champ="nom de catégorie"
            ),
            _montant(champs.get("montant", actuel["montant"])),
            champs.get("sens", actuel["sens"]),
            # `echeance: null` explicite = déplanifier ; champ absent = inchangé.
            _echeance(champs["echeance"]) if "echeance" in champs else actuel["echeance"],
            champs.get("fait", actuel["fait"]),
            (note or "").strip() or None,
        )
    return _prevision(row)


async def supprimer_prevision(user_id: str, prevision_id: str) -> None:
    await _supprimer(user_id, "budget_previsions", prevision_id)


# ====================================================================
# Comptes
# ====================================================================


async def creer_compte(user_id: str, payload: BudgetCompteCreate) -> dict:
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"""
            INSERT INTO budget_comptes (user_id, libelle, montant, date_releve)
            VALUES ($1, $2, $3, $4)
            RETURNING {_COLS_COMPTE}
            """,
            user_id,
            _libelle(payload.libelle),
            _montant(payload.montant, signe_libre=True),
            payload.date_releve,
        )
    return _compte(row)


async def modifier_compte(
    user_id: str, compte_id: str, payload: BudgetCompteUpdate
) -> dict:
    champs = payload.model_dump(exclude_unset=True)
    async with scoped_connection(user_id) as conn:
        actuel = await _courant(conn, "budget_comptes", _COLS_COMPTE, compte_id)
        row = await conn.fetchrow(
            f"""
            UPDATE budget_comptes
            SET libelle = $2, montant = $3, date_releve = $4, updated_at = now()
            WHERE id = $1
            RETURNING {_COLS_COMPTE}
            """,
            actuel["id"],
            _libelle(champs.get("libelle", actuel["libelle"])),
            _montant(champs.get("montant", actuel["montant"]), signe_libre=True),
            champs.get("date_releve", actuel["date_releve"]),
        )
    return _compte(row)


async def supprimer_compte(user_id: str, compte_id: str) -> None:
    await _supprimer(user_id, "budget_comptes", compte_id)


# ====================================================================
# Helpers partagés
# ====================================================================


async def _courant(
    conn: asyncpg.Connection, table: str, colonnes: str, identifiant: str
) -> asyncpg.Record:
    """Charge la ligne à modifier. `table` et `colonnes` sont des constantes du
    module (jamais une entrée utilisateur) : l'interpolation est sûre.

    Un identifiant mal formé (pas un UUID) est traité comme « introuvable »
    plutôt que de remonter en 500 : c'est bien ce que vit l'utilisateur.
    RLS garantit qu'on ne peut atteindre que ses propres lignes.
    """
    try:
        row = await conn.fetchrow(
            f"SELECT {colonnes} FROM {table} WHERE id = $1", _uuid(identifiant)
        )
    except asyncpg.PostgresError:
        row = None
    if row is None:
        raise not_found("Cette ligne du budget est introuvable.")
    return row


async def _supprimer(user_id: str, table: str, identifiant: str) -> None:
    async with scoped_connection(user_id) as conn:
        supprime = await conn.fetchrow(
            f"DELETE FROM {table} WHERE id = $1 RETURNING id", _uuid(identifiant)
        )
    if supprime is None:
        raise not_found("Cette ligne du budget est introuvable.")


def _uuid(identifiant: str):
    from uuid import UUID

    try:
        return UUID(identifiant)
    except (ValueError, AttributeError, TypeError):
        raise not_found("Cette ligne du budget est introuvable.") from None
