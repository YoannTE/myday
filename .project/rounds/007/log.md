# Log - Round 007

## Endpoints touches

- POST /api/brief/generate (FastAPI, auth) : génère le brief du jour (manual/onboarding), 429 anti-spam
- GET /api/cockpit (FastAPI, modifié) : ajoute la clé brief (quotidien du jour / dernier a_la_demande / null)
- PATCH /api/preferences (FastAPI, modifié) : accepte brief_tone (neutre/motivant/direct)
- scheduler brief (nouveau) : run quotidien par utilisateur à brief_hour, catch-up idempotent

## Fichiers touches

(alimente par les agents dev via le skill output-format, append-only)
- src/lib/db/schema/preferences.ts (modifie)
- drizzle/0006_fuzzy_gwen_stacy.sql (cree)
- src/components/cockpit/brief-hero.tsx (cree)
- src/components/cockpit/cockpit-client.tsx (modifie)
- src/components/cockpit/types.ts (modifie)
- src/components/reglages/brief-notifications-form.tsx (modifie)
- src/components/onboarding/etape-finale.tsx (modifie)
- src/components/onboarding/types.ts (modifie)
- src/lib/api.ts (modifie)
- backend/app/config.py (modifie)
- backend/app/services/daily_brief/__init__.py (cree)
- backend/app/services/daily_brief/context.py (cree)
- backend/app/services/daily_brief/alerts.py (cree)
- backend/app/services/daily_brief/degraded.py (cree)
- backend/app/services/daily_brief/compose.py (cree)
- backend/app/services/daily_brief/persist.py (cree)
- backend/app/services/daily_brief/orchestrator.py (cree)
- backend/app/services/brief_scheduler.py (cree)
- backend/app/api/brief.py (cree)
- backend/app/services/cockpit.py (modifie)
- backend/app/models/cockpit.py (modifie)
- backend/app/models/preferences.py (modifie)
- backend/app/services/preferences.py (modifie)
- backend/app/main.py (modifie)
- backend/tests/test_daily_brief.py (cree)
