# Log - Round 003

## Endpoints touches
- GET /api/google/connect (Next, Route Handler) : construit URL Google + PKCE + cookie état signé, redirige vers Google
- GET /api/google/callback (Next, Route Handler) : vérifie état + session, POST vers FastAPI /api/google/exchange, redirige /reglages?google=connected|error
- POST /api/google/exchange (FastAPI, auth) : échange code PKCE contre jetons, stocke chiffré (tokenExpiry depuis expires_in), {"data":{scopes,status}} / 400
- POST /api/google/sync (FastAPI, auth) : synchronisation manuelle, anti-spam 1/30 s (lastManualSyncAt) → 429, {"data":{status,calendar,gmail,partial,...}}, 400 si non connecté
- GET /api/google/status (FastAPI, auth) : {"data":{connected,status,reauth_required,scopes,calendar_synced_at,gmail_synced_at,last_manual_sync_at}} ; connected:false si aucune connexion
- DELETE /api/google (FastAPI, auth) : revoke best-effort (3 s, non bloquant) + suppression connexion, 204
- DELETE /api/me (FastAPI, auth, MODIFIÉ) : revoke Google best-effort avant la purge cascade du compte, 204

(alimente par /round-implement PHASE 4 etape 3)

## Fichiers touches

(alimente par les agents dev via le skill output-format, append-only)
- src/lib/db/schema/google.ts (modifie) : ajout tokenExpiry + lastManualSyncAt
- src/lib/db/schema/productivite.ts (modifie) : ajout events.clientUuid + index
- src/lib/db/schema/mails.ts (modifie) : CHECK statut etendu a archived_remote
- drizzle/0004_magical_namora.sql (cree) : migration colonnes + CHECK mails
- drizzle/meta/0004_snapshot.json (cree) : snapshot drizzle
- drizzle/meta/_journal.json (modifie) : journal drizzle
- backend/app/security/__init__.py (cree) : package security
- backend/app/security/token_cipher.py (cree) : chiffrement AES-256-GCM enveloppe
- backend/app/db/google_connection.py (cree) : repository connexion Google scope RLS
- backend/app/config.py (modifie) : setting token_encryption_key
- backend/requirements.txt (modifie) : ajout cryptography
- backend/tests/test_token_cipher.py (cree) : tests chiffrement
- backend/tests/test_google_connection.py (cree) : tests repository RLS
- .env.local (modifie) : TOKEN_ENCRYPTION_KEY dev
- .env.local.example (modifie) : TOKEN_ENCRYPTION_KEY exemple
- src/lib/google-oauth.ts (cree)
- src/lib/freshness.ts (cree)
- src/app/api/google/connect/route.ts (cree)
- src/app/api/google/callback/route.ts (cree)
- src/components/reglages/google/types.ts (cree)
- src/components/reglages/google/google-errors.ts (cree)
- src/components/reglages/google/use-google-status.ts (cree)
- src/components/reglages/google/google-card.tsx (cree)
- src/components/reglages/google/google-card-toasts.tsx (cree)
- src/components/reglages/google/google-card-chargement.tsx (cree)
- src/components/reglages/google/google-card-erreur.tsx (cree)
- src/components/reglages/google/google-card-deconnecte.tsx (cree)
- src/components/reglages/google/google-card-reauth.tsx (cree)
- src/components/reglages/google/google-card-connecte.tsx (cree)
- src/components/layout/freshness.tsx (cree)
- src/components/reglages/profil-card.tsx (modifie)
- src/components/reglages/google-connexion-placeholder.tsx (supprime)
- src/app/page.tsx (modifie)
- src/app/reglages/page.tsx (modifie)
- backend/app/main.py (modifie)
- backend/app/api/me.py (modifie)
- backend/app/utils/errors.py (modifie)
- backend/app/api/google.py (cree)
- backend/app/models/google.py (cree)
- backend/app/services/google/__init__.py (cree)
- backend/app/services/google/constants.py (cree)
- backend/app/services/google/errors.py (cree)
- backend/app/services/google/http.py (cree)
- backend/app/services/google/oauth.py (cree)
- backend/app/services/google/calendar_client.py (cree)
- backend/app/services/google/gmail_client.py (cree)
- backend/app/services/google/calendar_branch.py (cree)
- backend/app/services/google/gmail_branch.py (cree)
- backend/app/services/google/sync.py (cree)
- backend/app/services/google/scheduler.py (cree)
- backend/tests/test_google_oauth.py (cree)
- backend/tests/test_google_clients.py (cree)
- backend/tests/test_google_sync.py (cree)
- backend/tests/test_google_gmail_branch.py (cree)
- backend/tests/test_google_api.py (cree)
- src/components/reglages/google/types.ts (modifie) : correctif QA CRITICAL — alignement snake_case sur le contrat API (reauth_required, calendar_synced_at, gmail_synced_at, last_manual_sync_at)
- src/components/reglages/google/google-card.tsx (modifie) : correctif QA — reauth_required (snake_case)
- src/components/reglages/google/google-card-connecte.tsx (modifie) : correctif QA — dates de sync snake_case
- src/components/layout/freshness.tsx (modifie) : correctif QA CRITICAL — fraîcheur lit calendar_synced_at/gmail_synced_at
- src/app/layout.tsx (modifie) : correctif QA MAJOR — retrait de richColors (toasts verts)
- src/components/ui/sonner.tsx (modifie) : correctif QA MAJOR — toast success/info en accent bleu (AUCUN vert)
- backend/app/main.py (modifie) : correctif QA MINOR — logging.basicConfig (observabilité du scheduler)
