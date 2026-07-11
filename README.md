# MyDay — ton cockpit personnel

MyDay réunit ton planning, tes tâches, tes notes et tes mails importants dans un seul cockpit,
avec un brief IA pour démarrer ta journée et un assistant à qui tu peux parler. Application web
installable (PWA), sur invitation uniquement.

## Stack

- **Frontend** : Next.js 16 (App Router, `src/`) + TypeScript + Tailwind + shadcn/ui + Better-auth
- **Backend** : FastAPI (Python 3.12) + asyncpg + Pydantic v2
- **Base de données** : Postgres 16 (RLS pour le cloisonnement strict par utilisateur)
- **Stockage** : MinIO (S3-compatible)
- **IA** (optionnelle) : Anthropic Claude — tri des mails, brief quotidien, assistant conversationnel
- **Push** : Web Push (VAPID)

## Prérequis

- Docker (Postgres + MinIO)
- Node.js 20+
- Python 3.12+ (un venv est recommandé)

## Lancement local (from scratch)

```bash
# 1. Configuration
cp .env.local.example .env.local
# Éditer .env.local : renseigner au minimum BETTER_AUTH_SECRET et TOKEN_ENCRYPTION_KEY.
# GOOGLE_* : pour la connexion Google (agenda/mails). ANTHROPIC_API_KEY : pour la vraie IA
# (sinon le tri/brief tournent en mode « règles »). VAPID_* : pour les notifications push.

# 2. Services (Postgres + MinIO)
docker compose up -d

# 3. Frontend + base de données
npm install
npm run db:migrate      # applique les migrations Drizzle
npm run db:seed         # crée l'admin par défaut (idempotent)

# 4. Backend (dans un second terminal)
cd backend
python -m venv .venv && source .venv/bin/activate   # ou ton venv existant
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 5. Frontend (terminal 1)
npm run dev
```

- Frontend : http://localhost:3000
- API : http://localhost:8000 (docs : http://localhost:8000/docs)
- Postgres : localhost:5433 · MinIO console : http://localhost:9001

## Identifiants admin par défaut (dev)

- Email : `admin@admin.com`
- Mot de passe : `password`

À changer en production. Créé via `npm run db:seed`.

## Variables d'environnement (`.env.local`)

| Variable | Rôle | Obligatoire |
| --- | --- | --- |
| `DATABASE_URL` | Postgres (rôle admin, migrations DDL) | oui |
| `BACKEND_DATABASE_URL` | Postgres (rôle `app_rls`, non-superuser — RLS) | oui |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions | oui |
| `BETTER_AUTH_URL` | URL de l'app (ex. http://localhost:3000) | oui |
| `NEXT_PUBLIC_API_URL` | URL du backend FastAPI | oui |
| `TOKEN_ENCRYPTION_KEY` | Clé AES-256 (chiffrement des jetons Google) | oui |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google (agenda + Gmail) | pour Google |
| `S3_*` | MinIO / stockage | oui (dev via docker) |
| `ANTHROPIC_API_KEY` | IA (tri, brief, assistant). **Absente → mode « règles »** | non |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Notifications push web | pour le push |

**Sans clé IA** : le tri des mails et le brief fonctionnent en mode heuristique (« règles ») ;
l'assistant conversationnel, lui, a besoin d'une clé pour comprendre le langage naturel. Ajouter la
clé dans `.env.local` puis redémarrer le backend suffit à activer la vraie IA (aucun autre changement).

## Commandes utiles

- `npm run db:generate` — génère une migration depuis le schéma Drizzle
- `npm run db:migrate` — applique les migrations · `npm run db:seed` — admin par défaut
- `npm run db:studio` — visualise la base (Drizzle Studio)
- `npm run build` — build de production · `npm run dev` — dev
- Backend : `cd backend && python -m pytest -q` (tests) · `ruff check app` (lint)

## Architecture

- `src/app/` — pages (App Router) · `src/components/` — composants · `src/lib/` — auth, db, storage, api
- `backend/app/` — `api/` (endpoints), `services/` (logique métier + agents IA), `db/`, `auth/`, `storage/`
- `.project/` — mémoire du projet (rounds, décisions, patterns, SOPs, mockups)

Le cloisonnement est strict : chaque utilisateur ne voit que ses données (RLS Postgres). L'admin ne
voit que des métadonnées de compte (jamais le contenu des mails/notes/tâches).
