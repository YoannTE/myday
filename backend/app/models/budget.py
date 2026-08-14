"""Schémas Pydantic du domaine Budget (section privée protégée par code).

Contrat figé, identique au reste de l'API : réponses `{"data": ...}` en
snake_case, sans alias camelCase (SOP `api-response-casing-contract`).

Deux règles portées ici plutôt que dans le service, parce qu'elles décrivent la
FORME de la donnée et non une règle métier : `sens` est un `Literal`
('entree'/'sortie', ASCII sans accent comme tous les statuts en base) et les
libellés sont nettoyés de leurs espaces superflus. La validation métier qui
mérite un message français (montant négatif, échéance mal formée, code non
numérique) vit dans `services/budget.py` et lève un 400 explicite via
`app.utils.errors.bad_request` — jamais un 422 Pydantic.

Les montants voyagent en `float` sur le fil (JSON n'a pas de décimal) mais sont
stockés en `numeric(12,2)` : la conversion se fait à la frontière, dans le
service.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

Sens = Literal["entree", "sortie"]


class _TexteObligatoire(BaseModel):
    """Mixin : `libelle` et `categorie` sont nettoyés et ne peuvent être vides.

    Écrit en classe de base plutôt qu'en fonction partagée passée à
    `field_validator` : Pydantic v2 attend une classmethod (premier paramètre
    `cls`), une fonction libre à un seul paramètre serait mal interprétée.
    """

    @field_validator("libelle", "categorie", check_fields=False)
    @classmethod
    def _texte_non_vide(cls, valeur: str) -> str:
        nettoye = valeur.strip()
        if not nettoye:
            raise ValueError("Le libellé et la catégorie sont obligatoires.")
        return nettoye


# ====================================================================
# Accès (code à 4 chiffres)
# ====================================================================


class BudgetCodeDefinir(BaseModel):
    """Première définition du code, au tout premier accès au budget."""

    code: str


class BudgetCodeOuvrir(BaseModel):
    code: str


class BudgetCodeModifier(BaseModel):
    code_actuel: str
    nouveau_code: str


class BudgetAccesEtat(BaseModel):
    """État du verrou, lisible sans avoir déverrouillé (aucune donnée
    financière n'y transite)."""

    code_defini: bool
    bloque_jusqua: datetime | None = None


class BudgetAccesOuvert(BaseModel):
    jeton: str
    expire_a: datetime


# ====================================================================
# Récurrents
# ====================================================================


class BudgetRecurrentCreate(_TexteObligatoire):
    libelle: str
    categorie: str
    montant: float
    sens: Sens
    actif: bool = True


class BudgetRecurrentUpdate(BaseModel):
    libelle: str | None = None
    categorie: str | None = None
    montant: float | None = None
    sens: Sens | None = None
    actif: bool | None = None


class BudgetRecurrentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    libelle: str
    categorie: str
    montant: float
    sens: Sens
    actif: bool
    created_at: datetime
    updated_at: datetime


# ====================================================================
# Opérations ponctuelles
# ====================================================================


class BudgetOperationCreate(_TexteObligatoire):
    date_operation: date
    libelle: str
    categorie: str
    montant: float
    sens: Sens


class BudgetOperationUpdate(BaseModel):
    date_operation: date | None = None
    libelle: str | None = None
    categorie: str | None = None
    montant: float | None = None
    sens: Sens | None = None


class BudgetOperationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    date_operation: date
    libelle: str
    categorie: str
    montant: float
    sens: Sens
    created_at: datetime
    updated_at: datetime


# ====================================================================
# Prévisions (projets et rentrées à venir)
# ====================================================================


class BudgetPrevisionCreate(_TexteObligatoire):
    libelle: str
    categorie: str
    montant: float
    sens: Sens
    echeance: str | None = None
    fait: bool = False
    note: str | None = None


class BudgetPrevisionUpdate(BaseModel):
    libelle: str | None = None
    categorie: str | None = None
    montant: float | None = None
    sens: Sens | None = None
    # `echeance` accepte explicitement None pour DÉplanifier une ligne : le
    # service distingue « champ absent » (inchangé) de « champ à null » grâce à
    # `model_dump(exclude_unset=True)`.
    echeance: str | None = None
    fait: bool | None = None
    note: str | None = None


class BudgetPrevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    libelle: str
    categorie: str
    montant: float
    sens: Sens
    echeance: str | None
    fait: bool
    note: str | None
    created_at: datetime
    updated_at: datetime


# ====================================================================
# Comptes
# ====================================================================


class BudgetCompteCreate(_TexteObligatoire):
    libelle: str
    montant: float
    date_releve: date | None = None


class BudgetCompteUpdate(BaseModel):
    libelle: str | None = None
    montant: float | None = None
    date_releve: date | None = None


class BudgetCompteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    libelle: str
    montant: float
    date_releve: date | None
    created_at: datetime
    updated_at: datetime


# ====================================================================
# Vue complète — un seul aller-retour au chargement de la page
# ====================================================================


class BudgetDonnees(BaseModel):
    recurrents: list[BudgetRecurrentResponse]
    operations: list[BudgetOperationResponse]
    previsions: list[BudgetPrevisionResponse]
    comptes: list[BudgetCompteResponse]
