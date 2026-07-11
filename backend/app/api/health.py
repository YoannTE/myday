"""Endpoint de sante : ping BDD reel + tolerance si le schema n'est pas migre.

`db` : la connexion Postgres repond.
`schema` : la table `session` existe (le conteneur web a bien applique les
migrations). L'API peut booter avant le web ; dans ce cas schema=false sans crash.
"""

from fastapi import APIRouter

from app.db.client import get_pool

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    db_ok = False
    schema_ok = False
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
            db_ok = True
            schema_ok = await conn.fetchval("SELECT to_regclass('public.session') IS NOT NULL")
    except Exception:
        db_ok = False
        schema_ok = False

    return {
        "data": {
            "status": "ok" if db_ok else "degraded",
            "db": db_ok,
            "schema": bool(schema_ok),
        }
    }
