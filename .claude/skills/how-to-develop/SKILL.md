---
name: how-to-develop
description: >
  Workflows de developpement pas-a-pas pour les demandes feature de
  l'utilisateur. Invoque ce skill quand le prompt demande une nouvelle
  fonctionnalite applicative ou cible un DOMAINE technique precis :
  CRUD/entites/tables, formulaire, nouvelle page, page liste, DataTable,
  authentification, login, signup, paiements, Stripe, abonnements, emails,
  Resend, uploads, MinIO, S3, integration tierce, webhook, modules
  complementaires. Couvre frontend-only (Next.js + Postgres) et dual-stack
  (FastAPI + Next.js).
  N'invoque PAS ce skill pour : questions generiques ("explique-moi"),
  debug, refactor, lecture/comprehension de code, fix de bug, simple
  modification cosmetique. Les verbes "ajouter", "creer", "modifier"
  seuls sans domaine technique ne declenchent pas.
allowed-tools:
  - "Read"
  - "Write"
  - "Edit"
  - "Bash"
---

# Skill how-to-develop

Ce skill contient les procedures detaillees pour les demandes de
developpement de fonctionnalites. Choisis la section correspondant
a la demande de l'utilisateur.

## Quand il veut une nouvelle fonctionnalite

- Identifier les entites (tables) necessaires
- Ajouter les tables dans `src/lib/db/schema.ts`
- `npm run db:generate && npm run db:migrate`
- Si frontend-only : creer les Server Actions ou Route Handlers
- Si dual-stack : creer les endpoints FastAPI + services + modeles Pydantic
- Creer les pages et composants UI associes
- Mettre a jour la navigation si necessaire

## Quand il veut gerer des donnees (entites)

- Definir la table dans `src/lib/db/schema.ts` (Drizzle)
- Migrer (`npm run db:generate && npm run db:migrate`)
- Si frontend-only : Server Actions avec verification `requireUser()`
- Si dual-stack : endpoints FastAPI avec `Depends(get_current_user)` + services
- Generer les pages de liste (DataTable) et formulaire (react-hook-form + zod)

## Quand il veut une nouvelle page

- Determiner si la page est publique ou protegee
- Protegee : utiliser `requireUser()` en haut du Server Component
- Ajouter les metadata SEO (title, description)
- Mettre a jour la navigation (header ou sidebar)
- Utiliser les composants shadcn/ui, rendre la page responsive

## Quand il veut ajouter l'authentification

- Deja en place via Better-auth (email/password + Google OAuth optionnel)
- Pour activer Google : creer un projet sur console.cloud.google.com,
  copier `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env.local`
- Creer un composant UserMenu (avatar + dropdown) + page profil/settings
- Si dual-stack : proteger les endpoints via `Depends(get_current_user)`

## Quand il veut ajouter les paiements

- Installer et configurer Stripe
- Si frontend-only : webhook dans `src/app/api/webhooks/stripe/route.ts`
- Si dual-stack : webhook dans `backend/app/api/webhooks.py`
- Creer la page pricing si abonnements

## Quand il veut envoyer des emails

- Si frontend-only : Resend + React Email, helper dans `src/lib/email/`
- Si dual-stack : Resend cote backend, service dans `backend/app/services/email.py`

## Quand il veut uploader des fichiers

- Utiliser MinIO via `@/lib/storage` (Next.js) ou `app/storage/minio_client.py` (FastAPI)
- Cles d'objets : `users/{userId}/{uuid}-{filename}`
- Metadata en BDD (table dediee + relation vers `user`)

## Quand il demande de l'aide

- Repondre en francais correctement accentue, sans jargon
- Toujours proposer plutot que demander : « Je te propose X, ca te va ? »

## Modules complementaires

Quand l'utilisateur demande une fonctionnalite, toujours :

1. Verifier si la stack couvre nativement (Better-auth, MinIO, Drizzle)
2. Sinon, installer le module necessaire
   - Frontend : `npm install package@latest`
   - Si dual-stack : ajouter au `requirements.txt` (sans version pinee)
3. Creer les fichiers de config dans `src/lib/` (frontend) ou `backend/app/` (backend)
4. Mettre a jour `.env.local` avec les variables necessaires
