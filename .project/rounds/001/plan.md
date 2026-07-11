# Plan d'exécution — Round 001 « Fondations »

Généré le 2026-07-10 depuis `.project/rounds/001/spec.md`, **reviewé et corrigé**
par architect-reviewer + lead-dev-reviewer. Stack : dual-stack (FastAPI +
Next.js + Postgres), pas d'image pré-cuite → bootstrap `init-postgres-fastapi`.

## Séquencement global (corrigé par la review)

```
ÉTAPE 0 (séquentielle, lead)     : bootstrap init-postgres-fastapi + docker compose up
ÉTAPE 1a (postgres-developer)    : schéma + migrations + seed + migrate.ts + bundle  ← EN PREMIER
ÉTAPE 1b (2 agents EN PARALLÈLE) : nextjs-developer | fastapi-developer             ← après 1a
ÉTAPE 2 (vérification lead)      : build + migrate + seed + boot + smoke + intégration cookie
```

**Correction review (C1/pt 4)** : les périmètres n'étaient pas réellement
disjoints — `Dockerfile.web` bundle `src/lib/db/migrate.ts` (produit par
postgres) et les tests FastAPI ont besoin de la table `session` migrée.
→ postgres-developer passe EN PREMIER (1a), les deux autres en parallèle ensuite.

## Conventions imposées à tous les agents (review)

- **Timestamps** : TOUJOURS `timestamp({ withTimezone: true })` (« timestamptz »)
  — événement.début/fin, tâche.échéance, invitation.expiration, dernièreSync,
  sync_locked_until, createdAt/updatedAt... AUCUN timestamp nu.
- **Français accentué** partout (UI, commentaires, messages).
- Scope control : ne rien anticiper des rounds suivants (pas de chiffrement de
  jetons ce round — les colonnes restent `text`, AUCUN jeton réel n'est écrit
  avant le Round 003 qui apporte le service de chiffrement AVEC l'OAuth).

## ÉTAPE 0 — Bootstrap (lead, séquentiel)

Invoquer le skill `init-postgres-fastapi` :

- create-next-app@latest (App Router, src-dir, TypeScript strict, Tailwind)
- Better-auth (config, client, session helpers, handler `[...all]` — INTOUCHABLE)
- Drizzle ORM + drizzle-kit + scripts npm
- MinIO client S3, backend FastAPI de base, `docker-compose.yml` (Postgres 16 + MinIO), `.env.example`, shadcn/ui

Vérification : `docker compose up -d` (Postgres + MinIO healthy) avant l'ÉTAPE 1.

## ÉTAPE 1a — postgres-developer : « Schéma complet + auth + seed + migrations prod »

**Lire avant de coder** : `.project/app.md` `## Entités` + `## Règles métier`,
`.claude/rules/postgres.md`, `.claude/rules/better-auth.md`.

**Tâches** :

1. Schéma Drizzle découpé par domaine dans `src/lib/db/schema/` (~150 lignes max/fichier) :
   - `auth.ts` : réexport tables Better-auth (INTOUCHABLES) + `user.role` via
     `additionalFields` Better-auth (pas de modification directe de la table)
   - `google.ts` : connexionGoogle (jetons en `text` — chiffrés au Round 003,
     curseurs syncToken/historyId, état, calendarSyncedAt/gmailSyncedAt,
     syncLockedUntil, reauthNotified)
   - `productivite.ts` : tâche (origine, assistantActionKey unique par user),
     note (origine, épinglée, archivée) + note_appends (actionKey unique),
     événement (googleEventId + unicité (userId, googleEventId), source,
     syncStatus avec CHECK synced/sync_pending/sync_error)
   - `mails.ts` : mail (gmailId + unicité (userId, gmailId), score, raisonScore,
     statut CHECK pending_triage/triaged, lu/répondu), préférenceExpéditeur
     (unicité (userId, email), statut CHECK important/muet), brouillonMail
     (statut CHECK pending_review/sending/sent/rejected/expired/sending_unconfirmed,
     **index unique partiel sur sentGmailId WHERE sentGmailId IS NOT NULL** —
     garde anti-double-envoi au niveau BDD, correction review)
   - `ia.ts` : brief (type, degraded, contenu JSONB, **unicité partielle
     (userId, briefDate) WHERE type='scheduled'**), conversationAssistant
     (messages/actions JSONB, unicité (conversationId, turnKey))
   - `systeme.ts` : invitation (jeton unique, expiration, invitéPar),
     notification (**refId TOUJOURS renseigné** — briefId/mailId/eventId —
     unicité (userId, refId, type) ; convention documentée en commentaire),
     usage_events (journal d'usage), llm_usage (compteur coût IA)
   - `index.ts` : réexports
2. Index explicites sur toutes les colonnes filtrées (userId partout, score, statuts, dates).
3. **RLS (correction review, obligatoire ce round)** : migration SQL custom qui
   active `ENABLE ROW LEVEL SECURITY` sur toutes les tables de contenu + policy
   `USING (user_id = current_setting('app.current_user_id')::uuid)` + rôle
   applicatif non-superuser. Documenter dans le schéma que le backend pose
   `SET LOCAL app.current_user_id` par transaction (helper côté FastAPI, tâche
   coordonnée avec l'agent 3).
4. `npm run db:generate` + `db:migrate` → 0 erreur.
5. **Better-auth verrouillé (correction review)** : config auth.ts avec
   **signup public DÉSACTIVÉ** (`emailAndPassword.disableSignUp: true` —
   l'inscription passera par le flux serveur d'invitation au Round 002) +
   config cookie figée (sameSite lax, secure en prod, pas de domain custom en dev).
6. `src/lib/db/seed.ts` **idempotent (correction review)** : vérifier l'existence
   de `admin@admin.com` AVANT `auth.api.signUpEmail` (l'API lève sinon) ; poser
   `role=admin` par UPDATE séparé (signUpEmail ne garantit pas l'additionalField) ;
   préférences par défaut (brief_hour 07:00). Le seed lit `ADMIN_EMAIL`/`ADMIN_PASSWORD`
   depuis l'env avec fallback dev — réutilisable en prod (correction review :
   pas d'admin en prod sinon = deadlock premier déploiement).
7. `src/lib/db/migrate.ts` (runner prod) avec **advisory lock Postgres**
   (`pg_advisory_lock`) autour des migrations (correction review : migrations
   concurrentes multi-réplica) + script npm `db:bundle-migrate` (esbuild →
   `dist/migrate.js`) — ce lot appartient à postgres, PAS au front.

**Interdits** : modifier la structure des tables Better-auth ; insérer
directement dans `user` ; timestamp sans timezone.

## ÉTAPE 1b — 2 agents en parallèle (après 1a)

### nextjs-developer : « Design system AEVIO One + layout »

**Lire avant de coder** : `.project/design.md` (TOUS les tokens et règles),
`.project/mockups/shared/design-system.css` + `tailwind-tokens.js`,
`.project/mockups/shared/components/navbar.html`, `.project/mockups/png/dashboard.png`,
`.claude/rules/ui.md`.

**Tâches** :

1. Tokens `src/app/globals.css` : CSS vars AEVIO One (bg #F5F7FB, ink #111A37,
   accent #2350E6, soft #EAF0FF, success = accent — AUCUN vert), dark mode
   (#0C1024/#EEF1FB/#1A2140) via `html[data-mode="dark"]`, mobile
   `html { font-size: 13.5px }` < 640px, animations pulse-now/fade-in,
   mapping Tailwind (couleurs, fonts, radius 14/12, ombres card/cta).
2. Polices Plus Jakarta Sans + JetBrains Mono via `next/font/google`.
3. `src/components/layout/navbar.tsx` : reproduction exacte du composant validé
   (logo M dégradé + date du jour FR + barre assistant statique + bouton ☾
   fonctionnel persisté localStorage + avatar initiale) ; mobile : assistant en
   2e ligne, ⌘K masqué.
4. `src/app/layout.tsx` (fonts, metadata FR, script anti-flash dark) + page
   d'accueil provisoire : coquille dashboard (max-w-4xl, « Ton cockpit arrive »).
5. shadcn/ui : button, card, input, label, dialog, dropdown-menu, sonner,
   skeleton — re-stylés via tokens.
6. `Dockerfile.web` multi-stage + `entrypoint.web.sh` + `.dockerignore` :
   l'entrypoint exécute `node dist/migrate.js && node dist/seed.js && exec node server.js`
   en CONSOMMANT les bundles produits par le script `db:bundle-migrate` de
   l'agent postgres (ne PAS réécrire migrate.ts — correction review).

**Interdits** : couleur verte, largeur autre que max-w-4xl, texte non accentué.

### fastapi-developer : « Backend squelette »

**Lire avant de coder** : `.claude/rules/python.md`, `.claude/rules/api.md`,
`.claude/rules/better-auth.md` (dual-stack), `backend/` du bootstrap, le schéma
`session` généré par l'agent postgres.

**Tâches** :

1. `backend/app/main.py` : FastAPI + lifespan (pool asyncpg) + **CORS avec
   `allow_credentials=True` et origine explicite `http://localhost:3000`**
   (correction review : jamais `*` avec credentials).
2. `backend/app/config.py` : pydantic-settings (`../.env.local`) — DATABASE_URL
   en **connexion directe Postgres** (jamais PgBouncer — contrainte DBOS future).
3. `backend/app/db/client.py` : pool asyncpg + **helper `scoped_connection(user_id)`**
   qui ouvre une transaction et pose `SET LOCAL app.current_user_id = $user_id`
   (pendant RLS — coordonné avec la migration RLS de l'agent postgres).
4. `backend/app/auth/session.py` : `get_current_user` — **parser le VRAI format
   du cookie Better-auth (correction review C3)** : valeur `<token>.<signature HMAC base64>`,
   préfixe `__Secure-` en prod ; extraire le token, vérifier la signature HMAC
   avec BETTER_AUTH_SECRET, puis lookup table `session` (expiration incluse) → user ou 401.
5. `backend/app/api/health.py` : `GET /health` → `{"data": {"status": "ok", "db": true}}` (ping réel).
6. `backend/app/storage/minio_client.py` : boto3, bucket privé.
7. Tests pytest : `test_health.py` + `test_auth_session.py` avec un cookie au
   **vrai format signé** (généré avec le même secret), pas une valeur brute
   factice (correction review).
8. `Dockerfile.api` (python slim, `uvicorn --workers 1`, healthcheck) ;
   **tolérance au démarrage** : si la table `session` n'existe pas encore
   (API bootée avant les migrations du conteneur web), /health répond
   `db: true, schema: false` sans crash (correction review : ordre des conteneurs).

**Interdits** : versions pinées ; ORM Python ; endpoint métier.

## ÉTAPE 2 — Vérification de fin de round (lead)

1. `docker compose up -d` → Postgres + MinIO healthy
2. `npm run db:migrate` puis `npm run db:seed` **exécuté DEUX FOIS** → 0 erreur,
   admin créé une seule fois, role=admin posé (idempotence prouvée)
3. `npm run build` → 0 erreur TypeScript
4. `npm run dev` → accueil 200, navbar conforme (date FR, assistant, ☾ bascule
   et persiste, avatar), rendu mobile 375px correct
5. **Test d'intégration cross-stack (correction review)** : login réel
   `admin@admin.com`/`password` via Better-auth → récupérer le cookie →
   l'envoyer à un endpoint FastAPI protégé de test → 200 ; sans cookie → 401
6. Tentative d'inscription publique via l'API Better-auth → REFUSÉE (signup fermé)
7. `curl localhost:8000/health` → 200 `db: true`
8. `pytest backend/` → vert ; `ruff check backend/` + `npm run lint` → 0 erreur
9. `npm run db:bundle-migrate` puis `docker build -f Dockerfile.web .` et
   `docker build -f Dockerfile.api backend/` → images OK
10. Vérifier RLS : requête SQL directe avec `app.current_user_id` posé sur un
    autre user → 0 ligne retournée sur une table de contenu

## Risques et dettes documentés (review)

- **Migrations au boot** : advisory lock posé, mais mono-réplica reste
  l'hypothèse MVP — job de migration dédié à prévoir avant tout scaling.
- **Chiffrement des jetons** : colonnes `text` nues ce round ; le Round 003
  apporte le service de chiffrement DANS LE MÊME round que l'OAuth — aucun
  jeton réel écrit avant. Ne pas déplacer F2 hors du Round 003.
- **Admin prod** : seed idempotent piloté par env (ADMIN_EMAIL/ADMIN_PASSWORD),
  appelé par l'entrypoint web — à re-vérifier au round déploiement.
- **Fondations pré-cuites** : non utilisées (catalogue indisponible) — bootstrap classique.
