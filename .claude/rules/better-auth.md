---
description: Conventions Better-auth (config, session, Google OAuth, cross-stack)
globs:
  - "src/lib/auth*.ts"
  - "src/lib/session.ts"
  - "src/app/api/auth/**"
  - "backend/app/auth/**"
---

# Conventions Better-auth

- Config centrale : `src/lib/auth.ts`
- Client React : `src/lib/auth-client.ts`
- Helpers serveur : `src/lib/session.ts` - `getSession()` (nullable) et `requireUser()` (redirect si non connecté)
- Handler API : `src/app/api/auth/[...all]/route.ts` - NE JAMAIS modifier ce fichier
- JAMAIS utiliser `@supabase/...` - uniquement `@/lib/auth`, `@/lib/auth-client`, `@/lib/session`

## Seed admin

- Créer l'admin via `src/lib/db/seed.ts` avec `auth.api.signUpEmail`
- Ne PAS insérer directement dans la table `user` (le mot de passe ne serait pas hashé)
- Identifiants par défaut dev : `admin@admin.com` / `password`

## Google OAuth

- Ajouter dans `socialProviders` de `auth.ts`
- Variables : `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env.local`
- Créer les credentials sur console.cloud.google.com

## Dual-stack (FastAPI)

- `get_current_user` dans `backend/app/auth/session.py`
- Lit le cookie `better-auth.session_token` et valide contre la table `session` partagée en Postgres
- Utiliser comme dépendance : `Depends(get_current_user)` sur tous les endpoints protégés
