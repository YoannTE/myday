"""Verrou du budget : définition, vérification et changement du code.

Le budget est une section privée : même connecté à MyDay, il faut saisir un
code à 4 chiffres pour l'ouvrir. Le code n'existe en clair qu'entre le champ de
saisie et cette fonction — en base il n'y a qu'un dérivé scrypt salé
(`app.security.code_budget`), et il n'est jamais journalisé.

**Limitation du débit d'essais.** 4 chiffres = 10 000 combinaisons : sans
plafond, un script les épuise en quelques minutes. Après
`MAX_TENTATIVES` échecs consécutifs, la saisie est bloquée `DUREE_BLOCAGE`, le
compteur repartant de zéro à chaque succès. Le compteur vit en base (pas en
mémoire) pour survivre à un redémarrage et rester partagé entre les répliques.

Toutes les requêtes passent par `scoped_connection(user_id)` (RLS) — la ligne
`budget_acces` d'un utilisateur est invisible aux autres, y compris ici.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.client import scoped_connection
from app.security.code_budget import (
    emettre_jeton,
    hacher_code,
    verifier_code,
)
from app.utils.errors import bad_request, conflict, not_found, too_many_requests

#: Échecs consécutifs tolérés avant blocage temporaire.
MAX_TENTATIVES = 5

#: Durée du blocage une fois `MAX_TENTATIVES` atteint.
DUREE_BLOCAGE = timedelta(minutes=15)

LONGUEUR_CODE = 4


def _valider_format(code: str) -> str:
    """Le code doit être exactement 4 chiffres. Message français explicite
    (400), jamais un 422 Pydantic — cf. docstring de `models/budget.py`."""
    nettoye = code.strip()
    if len(nettoye) != LONGUEUR_CODE or not nettoye.isdigit():
        raise bad_request("Le code doit contenir exactement 4 chiffres.")
    return nettoye


async def etat_acces(user_id: str) -> dict:
    """Indique si un code existe déjà et, le cas échéant, jusqu'à quand la
    saisie est bloquée. Consultable sans être déverrouillé : aucune donnée
    financière n'y transite."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "SELECT bloque_jusqua FROM budget_acces WHERE user_id = $1", user_id
        )
    if row is None:
        return {"code_defini": False, "bloque_jusqua": None}
    return {"code_defini": True, "bloque_jusqua": _blocage_actif(row["bloque_jusqua"])}


def _blocage_actif(bloque_jusqua: datetime | None) -> datetime | None:
    """Retourne l'échéance de blocage seulement si elle est encore dans le
    futur (une échéance passée n'a plus à être affichée)."""
    if bloque_jusqua is None:
        return None
    if bloque_jusqua.tzinfo is None:
        bloque_jusqua = bloque_jusqua.replace(tzinfo=timezone.utc)
    return bloque_jusqua if bloque_jusqua > datetime.now(timezone.utc) else None


def _refus_blocage(jusqua: datetime) -> None:
    restant = max(1, int((jusqua - datetime.now(timezone.utc)).total_seconds() // 60))
    raise too_many_requests(
        f"Trop d'essais. Réessaie dans {restant} minute"
        f"{'s' if restant > 1 else ''}."
    )


async def definir_code(user_id: str, code: str) -> dict:
    """Pose le code au tout premier accès.

    `ON CONFLICT DO NOTHING` + contrôle du nombre de lignes insérées : si un
    code existe déjà, on renvoie 409 plutôt que de l'écraser — sinon n'importe
    quelle session authentifiée pourrait redéfinir le code sans connaître
    l'ancien, ce qui viderait le verrou de son sens.
    """
    valide = _valider_format(code)
    empreinte = hacher_code(valide)
    async with scoped_connection(user_id) as conn:
        insere = await conn.fetchrow(
            """
            INSERT INTO budget_acces (user_id, code_hash)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING id
            """,
            user_id,
            empreinte,
        )
    if insere is None:
        raise conflict(
            "Un code est déjà défini. Utilise « Modifier le code » dans les réglages."
        )
    jeton, expire_a = emettre_jeton(user_id)
    return {"jeton": jeton, "expire_a": expire_a}


async def ouvrir(user_id: str, code: str) -> dict:
    """Vérifie le code et délivre un jeton d'accès de 12 h.

    Le compteur d'échecs est incrémenté AVANT de répondre, dans la même
    transaction que la lecture, pour qu'une rafale de requêtes parallèles ne
    puisse pas dépasser le plafond.
    """
    valide = _valider_format(code)
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "SELECT code_hash, tentatives, bloque_jusqua FROM budget_acces "
            "WHERE user_id = $1 FOR UPDATE",
            user_id,
        )
        if row is None:
            raise not_found("Aucun code n'est défini pour ce compte.")

        blocage = _blocage_actif(row["bloque_jusqua"])
        if blocage is not None:
            _refus_blocage(blocage)

        if verifier_code(valide, row["code_hash"]):
            await conn.execute(
                "UPDATE budget_acces SET tentatives = 0, bloque_jusqua = NULL, "
                "updated_at = now() WHERE user_id = $1",
                user_id,
            )
            jeton, expire_a = emettre_jeton(user_id)
            return {"jeton": jeton, "expire_a": expire_a}

        tentatives = row["tentatives"] + 1
        atteint_plafond = tentatives >= MAX_TENTATIVES
        await conn.execute(
            "UPDATE budget_acces SET tentatives = $2, bloque_jusqua = $3, "
            "updated_at = now() WHERE user_id = $1",
            user_id,
            0 if atteint_plafond else tentatives,
            datetime.now(timezone.utc) + DUREE_BLOCAGE if atteint_plafond else None,
        )

    if atteint_plafond:
        _refus_blocage(datetime.now(timezone.utc) + DUREE_BLOCAGE)
    restants = MAX_TENTATIVES - tentatives
    raise bad_request(
        f"Code incorrect. Il te reste {restants} essai{'s' if restants > 1 else ''}."
    )


async def modifier_code(user_id: str, code_actuel: str, nouveau_code: str) -> dict:
    """Change le code depuis les réglages. Exige l'ancien code."""
    actuel = _valider_format(code_actuel)
    nouveau = _valider_format(nouveau_code)
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            "SELECT code_hash, bloque_jusqua FROM budget_acces WHERE user_id = $1 "
            "FOR UPDATE",
            user_id,
        )
        if row is None:
            raise not_found("Aucun code n'est défini pour ce compte.")

        blocage = _blocage_actif(row["bloque_jusqua"])
        if blocage is not None:
            _refus_blocage(blocage)

        if not verifier_code(actuel, row["code_hash"]):
            raise bad_request("Le code actuel est incorrect.")

        await conn.execute(
            "UPDATE budget_acces SET code_hash = $2, tentatives = 0, "
            "bloque_jusqua = NULL, updated_at = now() WHERE user_id = $1",
            user_id,
            hacher_code(nouveau),
        )
    jeton, expire_a = emettre_jeton(user_id)
    return {"jeton": jeton, "expire_a": expire_a}
