---
name: init-postgres
description: Initialize a Next.js + Postgres + Better-auth + MinIO project (frontend-only). This skill should be used when bootstrapping a new SaaS, tool, or data-driven application that uses a lightweight self-hostable stack instead of Supabase. It handles create-next-app@latest, Better-auth config, Drizzle ORM setup, MinIO S3-compatible storage, seed admin user, and shadcn/ui. Use this skill during Round 1 of /code when BRIEF.md indicates a standalone app without FastAPI backend.
---

# Init Postgres + Better-auth + MinIO

## Overview

Initialize a complete Next.js + Postgres + Better-auth + MinIO project (frontend-only).
Uses a mutualisable stack (1 Postgres + 1 MinIO shared across N apps on the same server)
instead of Supabase (10+ containers per project).

Stack :

- **Next.js 15** (App Router, `src/` dir, TypeScript strict)
- **Drizzle ORM** + drizzle-kit for migrations
- **Better-auth** (email/password + Google OAuth optional)
- **MinIO** (S3-compatible) via `@aws-sdk/client-s3`
- **shadcn/ui** (Tailwind CSS)
- **Postgres 16** (single container)

## When to Use

- During Round 1 (Fondations) of `/code` when the project is frontend-only
- When BRIEF.md mentions SaaS, outil metier, app avec authentification, dashboard
- When manually bootstrapping a new Postgres/Next project

## Prerequisites

- Docker must be installed and running (for Postgres + MinIO containers)
- Node.js 20+ (for `--env-file` flag in tsx scripts)

## Core Workflow

### Step 1: Backup existing files

```bash
bash .claude/skills/init-postgres/scripts/init.sh backup
```

### Step 2: Run the install

```bash
bash .claude/skills/init-postgres/scripts/init.sh install
```

This runs:

- `create-next-app@latest` (TypeScript, Tailwind, App Router, `src/` dir)
- `npm install better-auth@latest drizzle-orm@latest pg @aws-sdk/client-s3@latest sonner@latest @latest ...`
- `shadcn@latest init` + add button, input, label, card components
- Copies templates from `.claude/tools/postgres-templates/`
- Generates `BETTER_AUTH_SECRET` and `.env.local`
- Starts Docker Compose (Postgres + MinIO)
- Generates migration, applies it, seeds admin

### Step 3: Restore project files

```bash
bash .claude/skills/init-postgres/scripts/init.sh restore
```

### Step 4: Verify

```bash
npm run dev
```

Open http://localhost:3000. Sign in with `admin@admin.com` / `password`.

## Key Files Created

- `src/lib/auth.ts` - Better-auth server config
- `src/lib/auth-client.ts` - Better-auth React client
- `src/lib/session.ts` - Session helpers (`getSession`, `requireUser`)
- `src/lib/db/schema.ts` - Drizzle schema (user, session, account, verification + your tables)
- `src/lib/db/index.ts` - Drizzle client
- `src/lib/db/migrate.ts` - Migration runner
- `src/lib/db/seed.ts` - Admin seed
- `src/lib/storage/index.ts` - S3/MinIO client
- `src/app/sign-in/page.tsx`, `sign-up/page.tsx`, `dashboard/page.tsx`
- `src/app/api/auth/[...all]/route.ts` - Better-auth handler
- `docker-compose.yml` - Postgres + MinIO
- `drizzle.config.ts`
- `.env.local` - with generated secret

## npm Scripts Added

- `npm run db:generate` - generate migration from schema
- `npm run db:migrate` - apply migrations
- `npm run db:seed` - create admin user
- `npm run db:studio` - visual DB explorer (0 RAM in prod)
- `npm run db:push` - push schema without migration (dev only)

## URLs

- App : http://localhost:3000
- MinIO Console : http://localhost:9001 (login in `.env.local`)
- Postgres : `localhost:5433`
- Drizzle Studio : `npm run db:studio`

## Default admin

`admin@admin.com` / `password` - change in production.

## Notes

- RAM in production : ~100-150 Mo per app (vs ~1 Go with Supabase)
- Stack shareable across projects on a single VPS via `dokploy-network`
- For dual-stack (Next.js + FastAPI), use `init-postgres-fastapi` instead
