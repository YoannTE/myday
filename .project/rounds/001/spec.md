---
id: "001"
title: "Fondations"
status: "done"
depends_on: []
---

## Objectifs

Poser le socle technique dual-stack complet : projet démarrable en local, schéma de données entier, design system AEVIO One en place.

## Périmètre

- [x] Bootstrap dual-stack : init-postgres-fastapi (Next.js 15 + FastAPI + Postgres + MinIO + Better-auth), docker-compose local, .env.example
- [x] Schéma Drizzle initial : TOUTES les entités de app.md (user+préférences, invitation, connexionGoogle, tâche, note avec origine, événement avec syncStatus, mail avec raisonScore, préférenceExpéditeur, brouillonMail, brief, conversationAssistant, notification, journal d'usage) + migrations + seed admin
- [x] Layout principal + design system : tokens AEVIO One (design.md), navbar partagée (date + barre assistant statique + bouton ☾ + avatar), mode sombre, composants shadcn/ui de base, colonne unique max-w-4xl, responsive mobile (règles design.md)
- [x] Dockerfile production multi-stage + entrypoint.sh + .dockerignore avec migrations Drizzle automatiques au démarrage (esbuild bundle de src/lib/db/migrate.ts → migrate.js, entrypoint node migrate.js && exec node server.js) + stage backend FastAPI
- [x] Backend FastAPI squelette : app/main.py (lifespan + pool asyncpg), config pydantic-settings, healthcheck, auth session partagée (get_current_user)

## Mockups liés

- Design system : voir `.project/design.md` + `.project/mockups/shared/` (tokens, navbar dans `shared/components/navbar.html`)

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-10
**Statut final** : done

**Livré**
Socle dual-stack complet et opérationnel : projet Next.js 16 (App Router, TS strict) + FastAPI + Postgres 16 + MinIO + Better-auth, avec le schéma Drizzle des 13 entités MyDay (19 tables, RLS fail-closed testée, CHECK constraints, index uniques partiels d'idempotence), le design system AEVIO One (tokens, navbar avec date/assistant/☾/avatar, dark mode persisté, coquille dashboard), les Dockerfiles de production (web multi-stage avec migrations automatiques par advisory lock — prouvé sur base vierge — et API uvicorn --workers 1) et le backend FastAPI squelette (pool asyncpg sur rôle RLS app_rls, get_current_user validant le vrai cookie HMAC Better-auth, healthcheck tolérant, 11 tests pytest).

**Décisions techniques**
Ids Better-auth en texte (cuid) → policies RLS en comparaison texte ; signup public désactivé dès ce round (accès sur invitation) ; seed idempotent piloté par env (ADMIN_EMAIL/ADMIN_PASSWORD) réutilisable en prod ; rôle Postgres applicatif app_rls distinct d'app_admin (migrations) ; conversationAssistant normalisée en 2 tables pour porter l'unicité (conversationId, turnKey) ; timestamptz partout ; venv Python dédié $HOME/.pi-tools/myday-venv (Homebrew PEP 668). Détail dans .project/decisions.md et .project/patterns.md.

**Bugs et blocages**
Bootstrap : 4 blocages environnement résolus (Python 3.9 système → brew 3.12 + venv, Docker éteint, nom de dossier « MyDay » refusé par npm → génération en dossier temporaire, venv non détecté via symlink → wrapper shell). QA : 7 bugs corrigés en 2 itérations — 1 critique (drizzle/ absent du stage Docker runner → conteneur mort sur base fraîche), 2 majeurs (accents manquants dans les templates du starterkit ; redirection post-login vers l'ancienne page /dashboard), 4 mineurs (accents, accessibilité CardTitle).

**Enseignements**
Les fichiers issus des templates du starterkit doivent être audités (accents, redirections codées en dur) — SOP créé ; tout fichier lu sur disque au runtime doit être explicitement copié dans le stage Docker final, et seul un run sur environnement frais le prouve — SOP créé ; format cookie Better-auth v1.6 documenté dans patterns.md (token.signature HMAC, URL-encodé, unquote obligatoire côté Starlette).

**Endpoints exposés / modifiés**
- GET /health (modifié) : ping BDD réel + tolérance schéma
- GET /api/me (modifié) : endpoint protégé de référence (session cross-stack)
<!-- Note : `/round-debrief` remplace la ligne ci-dessus par le compte-rendu structuré. Les notes ajoutées ici seront préservées mais apparaîtront sous le compte-rendu. -->
