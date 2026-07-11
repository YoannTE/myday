# Log - Round 009

## Endpoints touches

- GET/POST/DELETE /api/push/subscribe (FastAPI, auth) : gestion des abonnements web push
- GET /api/push/vapid-public-key (FastAPI, auth) : clé publique VAPID
- GET /api/notifications, POST /api/notifications/read, GET /api/notifications/unread-count (FastAPI, auth)
- GET /api/search?q= (FastAPI, auth) : recherche globale notes/tâches/événements/mails (ILIKE paramétré, RLS)
- scheduler rappels d'événements (nouveau, lifespan) : notification « événement dans 30 min »
- mail_triage + daily_brief (modifiés) : dispatch_push push-only après commit de la notification

## Fichiers touches

(alimente par les agents dev via le skill output-format, append-only)
- src/lib/db/schema/systeme.ts (modifié)
- drizzle/0007_previous_old_lace.sql (créé)
- drizzle/meta/_journal.json (modifié)
- drizzle/meta/0007_snapshot.json (créé)
- src/lib/push/url-base64.ts (cree)
- src/components/reglages/notifications-push.tsx (cree)
- src/app/reglages/page.tsx (modifie)
- public/sw.js (modifie)
- src/components/layout/notification-types.ts (cree)
- src/components/layout/notification-row.tsx (cree)
- src/components/layout/notifications-bell.tsx (cree)
- src/components/search/types.ts (cree)
- src/components/search/search-result-group.tsx (cree)
- src/components/search/search-result-item.tsx (cree)
- src/components/search/search-modal.tsx (cree)
- src/components/layout/navbar.tsx (modifie)
- backend/app/config.py (modifie)
- backend/app/main.py (modifie)
- backend/app/services/push/__init__.py (cree)
- backend/app/services/push/subscriptions.py (cree)
- backend/app/services/push/sender.py (cree)
- backend/app/services/event_reminders.py (cree)
- backend/app/services/reminder_scheduler.py (cree)
- backend/app/services/notifications.py (cree)
- backend/app/services/search.py (cree)
- backend/app/services/mail_triage/persistence.py (modifie)
- backend/app/services/daily_brief/persist.py (modifie)
- backend/app/models/push.py (cree)
- backend/app/models/notifications.py (cree)
- backend/app/models/search.py (cree)
- backend/app/api/push.py (cree)
- backend/app/api/notifications.py (cree)
- backend/app/api/search.py (cree)
- backend/tests/test_push.py (cree)
- backend/tests/test_notifications.py (cree)
- backend/tests/test_search.py (cree)
