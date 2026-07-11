# Snippet à insérer dans backend/app/main.py.
# Pattern lifespan FastAPI (PAS @app.on_event - déprécié).
# Import depuis app.agents (PAS backend.agents - PYTHONPATH = backend/).

from contextlib import asynccontextmanager
from fastapi import FastAPI
from agent_platform import AgentPlatform
from agent_platform.fastapi_router import (
    router as agent_platform_router,
    verify_local_auth,
)
from app.agents import qualify_lead  # noqa: F401 - registers @workflow

platform = AgentPlatform.from_env()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await platform.start()
    yield
    await platform.shutdown()


app = FastAPI(lifespan=lifespan)
app.include_router(agent_platform_router, prefix="/api/agents")
app.state.agent_platform = platform

# SEC-4 (CORR H1) : override OBLIGATOIRE de verify_local_auth (auth Better-auth LOCALE).
# Sans ça, TOUS les POST /api/agents/workflows/*/run retournent 403.
from app.auth.session import get_current_user  # adapter si le path diffère

app.dependency_overrides[verify_local_auth] = get_current_user

# ⚠️  CORR H4 : DBOS singleton process-global. Lancer Uvicorn avec --workers 1.
#   uvicorn app.main:app --workers 1 --port 8000
# Pour scaler horizontalement → déployer N replicas Dokploy plutôt que N workers.
