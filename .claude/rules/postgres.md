---
description: Conventions Drizzle ORM, migrations Postgres, nommage des tables
globs:
  - "src/lib/db/**"
  - "drizzle/**"
  - "backend/app/db/**"
  - "**/schema.ts"
  - "**/*.sql"
  - "drizzle.config.ts"
---

# Conventions Postgres / Drizzle

- ORM : Drizzle uniquement (PAS de Prisma, PAS de Sequelize)
- Schema défini dans `src/lib/db/schema.ts`
- Commandes : `npm run db:generate` (migration), `db:migrate` (applique), `db:push` (dev sans migration), `db:seed` (admin), `db:studio` (UI)
- Ne JAMAIS éditer manuellement les fichiers dans `drizzle/` - générés par drizzle-kit
- Ne JAMAIS appeler `db:push` en production (utiliser `db:migrate`)

## Nommage

- Tables : snake_case pluriel (`projects`, `user_roles`, `payment_events`)
- Colonnes : camelCase Drizzle (`createdAt`, `updatedAt`, `userId`)
- Toujours inclure `id: uuid().defaultRandom().primaryKey()`, `createdAt`, `updatedAt`
- Index explicites sur les colonnes fréquemment filtrées

## Tables Better-auth - INTOUCHABLES

- `user`, `session`, `account`, `verification` : JAMAIS renommer, JAMAIS modifier la structure
- Ne PAS insérer directement dans `user` - passer par `auth.api.signUpEmail`

## Dual-stack (FastAPI)

- Pool asyncpg dans `backend/app/db/client.py`
- `async with pool.acquire() as conn:` pour chaque requête SQL
- Pas d'ORM Python : le schema est la source de vérité côté Drizzle uniquement
- Migrations toujours appliquées depuis Next.js (`db:migrate`), pas depuis Python
