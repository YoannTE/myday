# Log - Round 005

## Endpoints touches

- GET /api/preferences (FastAPI, auth) : create-or-default, retourne les préférences
- PATCH /api/preferences (FastAPI, auth) : maj partielle (brief_hour/timezone/notifs/onboarding), 400 si invalide, updated_at=now()
- GET /api/google/connect (Next, modifié) : accepte ?next= (whitelist chemins internes) threadé dans l'état signé
- GET /api/google/callback (Next, modifié) : redirige vers next validé (défaut /reglages)
- GET /manifest.webmanifest (Next, route metadata) : manifest PWA

## Fichiers touches

(alimente par les agents dev via le skill output-format, append-only)
- src/lib/db/schema/preferences.ts (créé)
- src/lib/db/schema/index.ts (modifié)
- drizzle/0005_elite_shard.sql (créé)
- backend/app/models/preferences.py (cree)
- backend/app/services/preferences.py (cree)
- backend/app/api/preferences.py (cree)
- backend/app/main.py (modifie)
- backend/tests/test_preferences.py (cree)
- src/app/manifest.ts (cree)
- src/app/layout.tsx (modifie)
- src/components/pwa/pwa-install-provider.tsx (cree)
- src/components/pwa/service-worker-register.tsx (cree)
- public/sw.js (cree)
- src/components/planning/planning-jour.tsx (cree)
- src/components/planning/date-utils.ts (modifie)
- src/components/planning/planning-semaine.tsx (modifie)
- src/components/planning/planning-client.tsx (modifie)
- src/components/planning/planning-skeleton.tsx (modifie)
- src/components/taches/task-item.tsx (modifie)
- src/lib/google-oauth.ts (modifie)
- src/app/api/google/connect/route.ts (modifie)
- src/app/api/google/callback/route.ts (modifie)
- src/components/auth/sign-up-form.tsx (modifie)
- src/app/onboarding/page.tsx (cree)
- src/components/onboarding/types.ts (cree)
- src/components/onboarding/onboarding-progress.tsx (cree)
- src/components/onboarding/onboarding-wizard.tsx (cree)
- src/components/onboarding/etape-google.tsx (cree)
- src/components/onboarding/etape-preferences.tsx (cree)
- src/components/onboarding/etape-pwa.tsx (cree)
- src/components/onboarding/etape-finale.tsx (cree)
- src/components/onboarding/onboarding-resume-banner.tsx (cree)
- src/components/cockpit/cockpit-client.tsx (modifie)
- src/components/reglages/brief-notifications-form.tsx (cree)
- src/components/reglages/brief-notifications-placeholder.tsx (supprime)
- src/app/reglages/page.tsx (modifie)
