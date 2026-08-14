"""Endpoints du budget (section privée protégée par un code à 4 chiffres).

Deux familles :

- `/api/budget/acces/*` — état du verrou, définition, ouverture, changement de
  code. Protégées par la session seule (`get_current_user`) : c'est justement
  ici qu'on obtient le jeton d'accès.
- tout le reste — les données financières. Protégées par
  `require_budget_unlock`, qui exige EN PLUS le jeton (en-tête `X-Budget-Acces`).

Réponses `{"data": ...}` en snake_case (SOP `api-response-casing-contract`).
"""

from fastapi import APIRouter, Depends, Response, status

from app.auth.budget import require_budget_unlock
from app.auth.session import AuthUser, get_current_user
from app.models.budget import (
    BudgetAccesEtat,
    BudgetAccesOuvert,
    BudgetCodeDefinir,
    BudgetCodeModifier,
    BudgetCodeOuvrir,
    BudgetCompteCreate,
    BudgetCompteResponse,
    BudgetCompteUpdate,
    BudgetDonnees,
    BudgetOperationCreate,
    BudgetOperationResponse,
    BudgetOperationUpdate,
    BudgetPrevisionCreate,
    BudgetPrevisionResponse,
    BudgetPrevisionUpdate,
    BudgetRecurrentCreate,
    BudgetRecurrentLot,
    BudgetRecurrentResponse,
    BudgetRecurrentUpdate,
)
from app.services import budget as budget_service
from app.services import budget_acces as acces_service

router = APIRouter(prefix="/budget", tags=["budget"])


# ====================================================================
# Verrou
# ====================================================================


@router.get("/acces")
async def get_acces(user: AuthUser = Depends(get_current_user)):
    etat = await acces_service.etat_acces(user["id"])
    return {"data": BudgetAccesEtat(**etat).model_dump()}


@router.post("/acces/definir", status_code=status.HTTP_201_CREATED)
async def definir_acces(
    payload: BudgetCodeDefinir, user: AuthUser = Depends(get_current_user)
):
    ouvert = await acces_service.definir_code(user["id"], payload.code)
    return {"data": BudgetAccesOuvert(**ouvert).model_dump()}


@router.post("/acces/ouvrir")
async def ouvrir_acces(
    payload: BudgetCodeOuvrir, user: AuthUser = Depends(get_current_user)
):
    ouvert = await acces_service.ouvrir(user["id"], payload.code)
    return {"data": BudgetAccesOuvert(**ouvert).model_dump()}


@router.post("/acces/modifier")
async def modifier_acces(
    payload: BudgetCodeModifier, user: AuthUser = Depends(get_current_user)
):
    ouvert = await acces_service.modifier_code(
        user["id"], payload.code_actuel, payload.nouveau_code
    )
    return {"data": BudgetAccesOuvert(**ouvert).model_dump()}


# ====================================================================
# Vue complète
# ====================================================================


@router.get("")
async def get_donnees(user: AuthUser = Depends(require_budget_unlock)):
    donnees = await budget_service.lire_tout(user["id"])
    return {"data": BudgetDonnees(**donnees).model_dump()}


# ====================================================================
# Récurrents
# ====================================================================


@router.post("/recurrents", status_code=status.HTTP_201_CREATED)
async def post_recurrent(
    payload: BudgetRecurrentCreate, user: AuthUser = Depends(require_budget_unlock)
):
    ligne = await budget_service.creer_recurrent(user["id"], payload)
    return {"data": BudgetRecurrentResponse(**ligne).model_dump()}


@router.post("/recurrents/lot", status_code=status.HTTP_201_CREATED)
async def post_recurrents_lot(
    payload: BudgetRecurrentLot, user: AuthUser = Depends(require_budget_unlock)
):
    """Création groupée (budget type). Déclarée avant les routes `/{id}` par
    convention, même si la méthode POST suffirait à les distinguer."""
    lignes = await budget_service.creer_recurrents_lot(user["id"], payload.lignes)
    return {"data": [BudgetRecurrentResponse(**ligne).model_dump() for ligne in lignes]}


@router.patch("/recurrents/{recurrent_id}")
async def patch_recurrent(
    recurrent_id: str,
    payload: BudgetRecurrentUpdate,
    user: AuthUser = Depends(require_budget_unlock),
):
    ligne = await budget_service.modifier_recurrent(user["id"], recurrent_id, payload)
    return {"data": BudgetRecurrentResponse(**ligne).model_dump()}


@router.delete("/recurrents/{recurrent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurrent(
    recurrent_id: str, user: AuthUser = Depends(require_budget_unlock)
):
    await budget_service.supprimer_recurrent(user["id"], recurrent_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ====================================================================
# Opérations ponctuelles
# ====================================================================


@router.post("/operations", status_code=status.HTTP_201_CREATED)
async def post_operation(
    payload: BudgetOperationCreate, user: AuthUser = Depends(require_budget_unlock)
):
    ligne = await budget_service.creer_operation(user["id"], payload)
    return {"data": BudgetOperationResponse(**ligne).model_dump()}


@router.patch("/operations/{operation_id}")
async def patch_operation(
    operation_id: str,
    payload: BudgetOperationUpdate,
    user: AuthUser = Depends(require_budget_unlock),
):
    ligne = await budget_service.modifier_operation(user["id"], operation_id, payload)
    return {"data": BudgetOperationResponse(**ligne).model_dump()}


@router.delete("/operations/{operation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_operation(
    operation_id: str, user: AuthUser = Depends(require_budget_unlock)
):
    await budget_service.supprimer_operation(user["id"], operation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ====================================================================
# Prévisions
# ====================================================================


@router.post("/previsions", status_code=status.HTTP_201_CREATED)
async def post_prevision(
    payload: BudgetPrevisionCreate, user: AuthUser = Depends(require_budget_unlock)
):
    ligne = await budget_service.creer_prevision(user["id"], payload)
    return {"data": BudgetPrevisionResponse(**ligne).model_dump()}


@router.patch("/previsions/{prevision_id}")
async def patch_prevision(
    prevision_id: str,
    payload: BudgetPrevisionUpdate,
    user: AuthUser = Depends(require_budget_unlock),
):
    ligne = await budget_service.modifier_prevision(user["id"], prevision_id, payload)
    return {"data": BudgetPrevisionResponse(**ligne).model_dump()}


@router.delete("/previsions/{prevision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prevision(
    prevision_id: str, user: AuthUser = Depends(require_budget_unlock)
):
    await budget_service.supprimer_prevision(user["id"], prevision_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ====================================================================
# Comptes
# ====================================================================


@router.post("/comptes", status_code=status.HTTP_201_CREATED)
async def post_compte(
    payload: BudgetCompteCreate, user: AuthUser = Depends(require_budget_unlock)
):
    ligne = await budget_service.creer_compte(user["id"], payload)
    return {"data": BudgetCompteResponse(**ligne).model_dump()}


@router.patch("/comptes/{compte_id}")
async def patch_compte(
    compte_id: str,
    payload: BudgetCompteUpdate,
    user: AuthUser = Depends(require_budget_unlock),
):
    ligne = await budget_service.modifier_compte(user["id"], compte_id, payload)
    return {"data": BudgetCompteResponse(**ligne).model_dump()}


@router.delete("/comptes/{compte_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_compte(compte_id: str, user: AuthUser = Depends(require_budget_unlock)):
    await budget_service.supprimer_compte(user["id"], compte_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
