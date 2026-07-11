import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# Import au niveau module : valide TOKEN_ENCRYPTION_KEY au chargement (fail-fast).
# Une cle absente/invalide fait echouer l'import, donc le boot FastAPI, avec un
# message explicite (app.security.token_cipher._decode_key).
import app.security.token_cipher  # noqa: F401
from app.db.client import (
    close_admin_pool,
    close_pool,
    create_admin_pool,
    create_pool,
)
from app.api.admin import router as admin_router
from app.api.assistant import router as assistant_router
from app.api.brief import router as brief_router
from app.api.google import router as google_router
from app.api.health import router as health_router
from app.api.mails import router as mails_router
from app.api.me import router as me_router
from app.api.notes import router as notes_router
from app.api.notifications import router as notifications_router
from app.api.preferences import router as preferences_router
from app.api.push import router as push_router
from app.api.search import router as search_router
from app.api.tasks import router as tasks_router
from app.api.usage import router as usage_router
from app.services.brief_scheduler import start_brief_scheduler, stop_brief_scheduler
from app.services.google.scheduler import start_scheduler, stop_scheduler
from app.services.reminder_scheduler import (
    start_reminder_scheduler,
    stop_reminder_scheduler,
)

# Round 004 (correction #8 du plan) : `events` et `cockpit` sont crees en
# parallele par un autre agent (BACK-2). Import tolerant pour ne jamais casser
# le boot pendant la convergence des agents ; le lead verifie ensuite que les
# deux imports reussissent bien et retire ce garde-fou si besoin.
try:
    from app.api.events import router as events_router
except ImportError:
    events_router = None

try:
    from app.api.cockpit import router as cockpit_router
except ImportError:
    cockpit_router = None

# Round 006 (correction #12 du plan) : `triage_router` est cree en parallele
# par l'agent BACK-TRIAGE. Import tolerant le temps de la convergence ; le
# lead verifie ensuite que l'import reussit et retire ce garde-fou si besoin.
try:
    from app.api.triage import router as triage_router
except ImportError:
    triage_router = None

# Round 008 (assistant conversationnel) : `assistant_drafts_router` (validation
# des brouillons de mail + envoi) est cree en parallele par l'agent BACK-MAIL.
# Import tolerant le temps de la convergence ; le lead verifie ensuite que
# l'import reussit et retire ce garde-fou si besoin.
try:
    from app.api.assistant_drafts import router as assistant_drafts_router
except ImportError:
    assistant_drafts_router = None

# Observabilite : sans configuration explicite, les logs INFO (dont le demarrage
# du scheduler) sont perdus et seuls les WARNING+ remontent. On pose un handler
# de base pour que l'operateur puisse verifier le boot en prod.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_pool()
    await create_admin_pool()
    start_scheduler()
    start_brief_scheduler()
    start_reminder_scheduler()
    yield
    stop_reminder_scheduler()
    stop_brief_scheduler()
    stop_scheduler()
    await close_admin_pool()
    await close_pool()


app = FastAPI(title="API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(me_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(google_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(notes_router, prefix="/api")
app.include_router(preferences_router, prefix="/api")
app.include_router(usage_router, prefix="/api")
app.include_router(mails_router, prefix="/api")
app.include_router(brief_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")
app.include_router(push_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(search_router, prefix="/api")
if events_router is not None:
    app.include_router(events_router, prefix="/api")
if cockpit_router is not None:
    app.include_router(cockpit_router, prefix="/api")
if triage_router is not None:
    app.include_router(triage_router, prefix="/api")
if assistant_drafts_router is not None:
    app.include_router(assistant_drafts_router, prefix="/api")
