# Log - Round 008

## Endpoints touches

- POST /api/assistant/message (FastAPI, auth, 429 anti-spam) : traite un message, plan LLM + actions, retourne reply/actions/draft
- POST /api/assistant/conversations (FastAPI, auth) : crée une nouvelle conversation
- GET /api/assistant/conversations/{id} (FastAPI, auth) : tours de la conversation
- GET /api/assistant/drafts/{id} (FastAPI, auth) : détail brouillon (+ expiration à la lecture)
- POST /api/assistant/drafts/{id}/decision (FastAPI, auth) : approve/reject, envoi at-most-once (403 si désactivé, 409 si déjà traité)

- GET /api/assistant/drafts/{id} - detail d'un brouillon de mail (scope user, expiration auto)
- POST /api/assistant/drafts/{id}/decision - approve (envoie, at-most-once) / reject

## Fichiers touches

(alimente par les agents dev via le skill output-format, append-only)
- src/lib/assistant-handoff.ts (cree)
- src/components/assistant/types.ts (cree)
- src/components/assistant/draft-card.tsx (cree)
- src/components/assistant/draft-card-actions.tsx (cree)
- src/components/assistant/message-bubble.tsx (cree)
- src/components/assistant/composer.tsx (cree)
- src/components/assistant/use-assistant-conversation.ts (cree)
- src/components/assistant/use-draft-decision.ts (cree)
- src/components/assistant/assistant-client.tsx (cree)
- src/app/assistant/page.tsx (cree)
- src/components/layout/navbar-assistant-bar.tsx (cree)
- src/components/layout/navbar.tsx (modifie)
- src/components/mails/mail-detail.tsx (modifie)
- backend/app/config.py (modifie)
- backend/app/main.py (modifie)
- backend/app/models/assistant.py (cree)
- backend/app/services/assistant/action_params.py (cree)
- backend/app/services/assistant/context.py (cree)
- backend/app/services/assistant/plan.py (cree)
- backend/app/services/assistant/actions.py (cree)
- backend/app/services/assistant/reply.py (cree)
- backend/app/services/assistant/persist.py (cree)
- backend/app/services/assistant/orchestrator.py (cree)
- backend/app/api/assistant.py (cree)
- backend/tests/test_assistant.py (cree)
- backend/app/services/google/gmail_client.py (modifie)
- backend/app/services/assistant/__init__.py (cree)
- backend/app/services/assistant/google_token.py (cree)
- backend/app/services/assistant/tools_event.py (cree)
- backend/app/services/assistant/draft.py (cree)
- backend/app/services/assistant/send_mail.py (cree)
- backend/app/services/assistant_drafts.py (cree)
- backend/app/api/assistant_drafts.py (cree)
- backend/app/models/assistant_drafts.py (cree)
- backend/app/utils/errors.py (modifie)
- backend/tests/test_assistant_mail.py (cree)
- backend/tests/test_google_clients.py (modifie)
