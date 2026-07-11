"""Endpoint de recherche globale (notes/tâches/événements/mails).

Protégé par `get_current_user`. Réponse `{"data": {...}}` (SOP
`api-response-casing-contract`). Requête vide -> résultats vides (pas de
recherche déclenchée, cf. `search-modal.tsx` côté frontend).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.auth.session import AuthUser, get_current_user
from app.models.search import SearchResponse
from app.services.search import search_all

router = APIRouter(prefix="/search", tags=["search"])

_EMPTY = {"notes": [], "taches": [], "events": [], "mails": []}


@router.get("")
async def search(
    q: str = Query(default=""), user: AuthUser = Depends(get_current_user)
):
    query = q.strip()
    if not query:
        return {"data": _EMPTY}
    results = await search_all(user["id"], query)
    return {"data": SearchResponse(**results).model_dump()}
