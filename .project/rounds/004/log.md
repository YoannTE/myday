# Log - Round 004

## Endpoints touches

- GET /api/tasks (FastAPI, auth) : liste tâches, filtre statut
- POST /api/tasks (FastAPI, auth) : création tâche
- PATCH /api/tasks/{id} (FastAPI, auth) : maj tâche, task_completed atomique
- DELETE /api/tasks/{id} (FastAPI, auth) : suppression tâche
- GET /api/notes (FastAPI, auth) : liste notes, filtre archivee + recherche q
- POST /api/notes (FastAPI, auth) : création note
- PATCH /api/notes/{id} (FastAPI, auth) : maj/épingler/archiver note
- DELETE /api/notes/{id} (FastAPI, auth) : suppression note
- GET /api/events (FastAPI, auth) : liste événements par plage
- POST /api/events (FastAPI, auth) : création + push Google idempotent best-effort
- PATCH /api/events/{id} (FastAPI, auth) : maj + update_event Google si synchronisé
- DELETE /api/events/{id} (FastAPI, auth) : suppression + delete_event Google best-effort
- GET /api/cockpit (FastAPI, auth) : agrégat dashboard (notes/journée/tâches/mails placeholder)
- POST /api/usage-events (FastAPI, auth) : journal d'usage, rejette task_completed (émis serveur)

## Fichiers touches

(alimente par les agents dev via le skill output-format, append-only)
- src/app/page.tsx (modifie)
- src/app/taches/page.tsx (cree)
- src/components/cockpit/cockpit-client.tsx (cree)
- src/components/cockpit/types.ts (cree)
- src/components/cockpit/notes-epinglees.tsx (cree)
- src/components/cockpit/journee-timeline.tsx (cree)
- src/components/cockpit/taches-checklist.tsx (cree)
- src/components/cockpit/mails-importants-placeholder.tsx (cree)
- src/components/taches/types.ts (cree)
- src/components/taches/task-item.tsx (cree)
- src/components/taches/task-quick-add.tsx (cree)
- src/components/taches/taches-client.tsx (cree)
- src/components/layout/navbar.tsx (modifie)
- src/lib/api-error-message.ts (cree)
- backend/app/config.py (modifie)
- backend/app/services/google/calendar_client.py (modifie)
- backend/app/models/events.py (cree)
- backend/app/services/events.py (cree)
- backend/app/services/events_google.py (cree)
- backend/app/api/events.py (cree)
- backend/app/models/cockpit.py (cree)
- backend/app/services/cockpit.py (cree)
- backend/app/api/cockpit.py (cree)
- backend/tests/test_events.py (cree)
- backend/tests/test_cockpit.py (cree)
- backend/app/models/tasks.py (cree)
- backend/app/services/tasks.py (cree)
- backend/app/api/tasks.py (cree)
- backend/app/models/notes.py (cree)
- backend/app/services/notes.py (cree)
- backend/app/api/notes.py (cree)
- backend/app/models/usage.py (cree)
- backend/app/services/usage.py (cree)
- backend/app/api/usage.py (cree)
- backend/app/main.py (modifie)
- backend/tests/test_tasks.py (cree)
- backend/tests/test_notes.py (cree)
- backend/tests/test_usage.py (cree)
- src/components/planning/types.ts (cree)
- src/components/planning/date-utils.ts (cree)
- src/components/planning/event-schema.ts (cree)
- src/components/planning/event-form-dialog.tsx (cree)
- src/components/planning/event-card.tsx (cree)
- src/components/planning/planning-header.tsx (cree)
- src/components/planning/planning-semaine.tsx (cree)
- src/components/planning/planning-skeleton.tsx (cree)
- src/components/planning/planning-client.tsx (cree)
- src/app/planning/page.tsx (cree)
- src/components/notes/types.ts (cree)
- src/components/notes/note-quick-add-dialog.tsx (cree)
- src/components/notes/notes-header.tsx (cree)
- src/components/notes/note-item.tsx (cree)
- src/components/notes/notes-liste.tsx (cree)
- src/components/notes/note-ouverte.tsx (cree)
- src/components/notes/notes-skeleton.tsx (cree)
- src/components/notes/notes-client.tsx (cree)
- src/app/notes/page.tsx (cree)
