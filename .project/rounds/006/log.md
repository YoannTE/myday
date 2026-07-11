# Log - Round 006

## Endpoints touches

- POST /api/triage/refresh (FastAPI, auth) : re-trie les mails pending_triage de l'utilisateur (heuristique, IA si clé)
- GET /api/mails?filter=important|tous (FastAPI, auth) : liste scorée + compteur ecartes
- GET /api/mails/{id} (FastAPI, auth) : détail (résumé/extrait, score, raison) + marque lu
- PATCH /api/mails/{id} (FastAPI, auth) : maj lu/repondu
- POST /api/mails/{id}/feedback (FastAPI, auth) : important|pas_important -> sender_preferences + reclassement
- GET /api/cockpit (FastAPI, modifié) : mails_importants réels au lieu du placeholder
- google_sync (modifié) : déclenche run_mail_triage après la sync, hors verrou, non bloquant

## Fichiers touches

(alimente par les agents dev via le skill output-format, append-only)
- src/components/mails/types.ts (cree)
- src/components/mails/format-expediteur.ts (cree)
- src/components/mails/mail-entete.tsx (cree)
- src/components/mails/mail-item.tsx (cree)
- src/components/mails/mail-liste.tsx (cree)
- src/components/mails/mail-detail.tsx (cree)
- src/components/mails/mails-client.tsx (cree)
- src/app/mails/page.tsx (cree)
- src/components/cockpit/mails-importants.tsx (cree)
- src/components/cockpit/mails-importants-placeholder.tsx (supprime)
- src/components/cockpit/types.ts (modifie)
- src/components/cockpit/cockpit-client.tsx (modifie)
- src/components/layout/navbar.tsx (modifie)
- backend/app/models/mails.py (cree)
- backend/app/services/mails.py (cree)
- backend/app/api/mails.py (cree)
- backend/tests/test_mails.py (cree)
- backend/app/services/cockpit.py (modifie)
- backend/app/models/cockpit.py (modifie)
- backend/app/main.py (modifie)
- backend/app/config.py (modifie)
- backend/app/services/mail_triage/__init__.py (cree)
- backend/app/services/mail_triage/normalize.py (cree)
- backend/app/services/mail_triage/prefilter.py (cree)
- backend/app/services/mail_triage/llm.py (cree)
- backend/app/services/mail_triage/scoring.py (cree)
- backend/app/services/mail_triage/summaries.py (cree)
- backend/app/services/mail_triage/persistence.py (cree)
- backend/app/services/mail_triage/orchestrator.py (cree)
- backend/app/api/triage.py (cree)
- backend/app/services/google/sync.py (modifie)
- backend/requirements.txt (modifie)
- .env.local.example (modifie)
- backend/tests/test_mail_triage.py (cree)
