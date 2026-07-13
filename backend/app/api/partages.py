"""Endpoints des partages (éléments partagés en lecture seule, Round 016).

Protégés par `get_current_user`. Réponses `{"data": ...}`.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.session import AuthUser, get_current_user
from app.models.partages import ELEMENT_TYPES, PartageCreate, PartageResponse
from app.services import partages as partages_service
from app.utils.errors import bad_request

router = APIRouter(prefix="/partages", tags=["partages"])


@router.get("")
async def list_partages(
    element_type: str = Query(),
    element_id: UUID = Query(),
    user: AuthUser = Depends(get_current_user),
):
    if element_type not in ELEMENT_TYPES:
        raise bad_request("Type d'élément invalide.")
    partages = await partages_service.list_for_element(
        user["id"], element_type, str(element_id)
    )
    return {"data": [PartageResponse(**p).model_dump() for p in partages]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_partage(
    payload: PartageCreate, user: AuthUser = Depends(get_current_user)
):
    partage = await partages_service.create_partage(user["id"], payload)
    return {"data": PartageResponse(**partage).model_dump()}


@router.delete("/{partage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_partage(
    partage_id: UUID, user: AuthUser = Depends(get_current_user)
) -> Response:
    await partages_service.delete_partage(user["id"], str(partage_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
