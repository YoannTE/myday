---
name: init-postgres-fastapi
description: Initialize a dual-stack project with FastAPI backend + Next.js frontend + Postgres + Better-auth + MinIO. This skill should be used when bootstrapping a new SaaS or data-driven application that uses Python/FastAPI for complex backend logic (IA, workers, multi-step workflows, pandas) and Next.js for the frontend. Use this skill during Round 1 of /code when BRIEF.md indicates a Postgres + FastAPI project.
---

# Init Postgres + FastAPI + Next.js + Better-auth + MinIO

## Overview

Initialize a complete dual-stack project : FastAPI backend + Next.js frontend + Postgres + Better-auth + MinIO.
The frontend (Next.js) handles the auth via Better-auth. The backend (FastAPI) validates
sessions by reading the `session` table shared with Next.js in the same Postgres database.

Stack :

- **Frontend** : Next.js 15 (App Router, `src/`) + Better-auth + Drizzle ORM + shadcn/ui
- **Backend** : FastAPI + asyncpg + boto3 (MinIO) + Pydantic v2
- **Postgres 16** (partage frontend + backend)
- **MinIO** (partage frontend + backend via S3-compatible API)

## When to Use

- During Round 1 (Fondations) of `/code` when the project uses Postgres + FastAPI
- When BRIEF.md mentions logique complexe Python, IA/ML, workers async, traitement fichiers
- When manually bootstrapping a new dual-stack project

## Prerequisites

- Docker running (Postgres + MinIO containers)
- Node.js 20+ (--env-file)
- Python 3.12+

## Core Workflow

### Step 1: Backup existing files

```bash
bash .claude/skills/init-postgres-fastapi/scripts/init.sh backup
```

### Step 2: Install

```bash
bash .claude/skills/init-postgres-fastapi/scripts/init.sh install
```

Actions :

- `create-next-app@latest` (frontend racine)
- `npm install` frontend deps @latest (better-auth, drizzle, aws-sdk, sonner)
- `shadcn@latest init` + add button/input/label/card
- Copy frontend templates from `tools/postgres-templates/files/`
- Copy dual-stack extras from `tools/postgres-templates/files-fastapi/`
- Create `backend/` structure
- Copy backend templates from `tools/postgres-templates/backend/`
- `pip install -r backend/requirements.txt` (no pin, latest)
- Generate `BETTER_AUTH_SECRET` and `.env.local` at root
- `docker compose up -d`
- `npm run db:generate && db:migrate && db:seed`

### Step 3: Restore project files

```bash
bash .claude/skills/init-postgres-fastapi/scripts/init.sh restore
```

### Step 4: Verify

```bash
npm run dev &
cd backend && uvicorn app.main:app --reload --port 8000
```

Frontend: http://localhost:3000
Backend API: http://localhost:8000
API docs: http://localhost:8000/docs
Postgres: localhost:5433
MinIO console: http://localhost:9001

## Key Files Created

Frontend :

- Same as `init-postgres`
- Plus `src/lib/api.ts` - helper HTTP `apiCall()` qui envoie les cookies session

Backend :

- `backend/requirements.txt` - deps sans pin
- `backend/app/main.py` - FastAPI app (lifespan pour pool BDD)
- `backend/app/config.py` - pydantic-settings (lit `.env.local` racine)
- `backend/app/db/client.py` - pool asyncpg
- `backend/app/auth/session.py` - dependency `get_current_user` qui lit la table session
- `backend/app/storage/minio_client.py` - client boto3
- `backend/app/api/health.py`, `me.py` - endpoints exemples

## Auth cross-stack

L'auth vit cote Next.js (Better-auth). Quand le frontend appelle `/api/...` sur FastAPI :

1. Le cookie `better-auth.session_token` est envoye (via `credentials: "include"` + CORS OK)
2. FastAPI lit ce cookie via la dependency `get_current_user`
3. FastAPI query directement la table `session` partagee en Postgres
4. Si la session est valide et non expiree, retourne le user ; sinon 401

Pas de dependance runtime a Next.js (FastAPI peut etre redemarre/down sans impact sur l'auth).
Source de verite unique : la table `session` en BDD.

## npm + python Scripts

Frontend : `npm run dev`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`
Backend : `uvicorn app.main:app --reload` (depuis `backend/`)

## Default admin

`admin@admin.com` / `password` - change in production.

## Notes

- RAM production : ~150 Mo (Next) + ~120 Mo (FastAPI) + Postgres/MinIO partages
- Les requirements.txt ont des deps sans version (pip prend @latest)
- Si tu n'as pas besoin de FastAPI, utilise `init-postgres` (frontend-only)
