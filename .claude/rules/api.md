---
description: Conventions API (Server Actions, Route Handlers, endpoints FastAPI)
globs:
  - "src/app/api/**/*.ts"
  - "src/lib/actions/**/*.ts"
  - "src/app/**/actions.ts"
  - "backend/app/api/**/*.py"
---

# Conventions API

## Si frontend-only (Next.js + Postgres)

- Server Actions pour les mutations simples
- Route Handlers (src/app/api/) pour webhooks, uploads, endpoints complexes
- Valider les inputs avec zod
- Reponses : { data: ... } ou { error: "message" }
- Auth : `getSession()` ou `requireUser()` depuis `@/lib/session` en debut de handler

## Si dual-stack (FastAPI)

### Backend (FastAPI)

- Valider les inputs avec Pydantic
- Reponses : { "data": ... } ou { "error": "message" }
- Status HTTP corrects (200, 201, 400, 401, 403, 404, 500)
- Authentification via `Depends(get_current_user)` (lit le cookie better-auth.session_token)
- Gerer les erreurs avec HTTPException
- Endpoints organises avec APIRouter (un fichier par domaine)
- Logique metier dans les services, pas dans les endpoints

### Frontend (appels vers l'API)

- Centraliser les appels dans src/lib/api.ts (helper `apiCall` avec credentials: include)
- Gerer les erreurs et les loading states
- Typer les reponses API avec des interfaces TypeScript
