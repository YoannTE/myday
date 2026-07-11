# Plan d'exécution — Round 005 « Onboarding et PWA »

> Version révisée après review architect + lead-dev (corrections intégrées, tracées en fin de fichier).

## Contexte et invariants

- **Stack dual-stack**, Next.js **16** (App Router). Mutations via API FastAPI (PAS de Server Actions).
- **Contrat de casse snake_case** (SOP `api-response-casing-contract`) : réponses API + interfaces
  TS en snake_case, `apiCall` ne transforme rien.
- **Tables Better-auth intouchables** → préférences dans une NOUVELLE table `user_preferences`.
- **Vérif route montée** : TestClient/curl (SOP `fastapi-route-registration-check`). Redémarrer
  uvicorn après ajout d'endpoints.
- **Design AEVIO One** : AUCUN vert, Plus Jakarta Sans + JetBrains Mono, max-w-4xl, mobile-first,
  tutoiement, « journée » jamais « matinée ».
- **Mockup** : `.project/mockups/pages/onboarding.html` (+ png) — 4 étapes.
- **Pré-fait par le lead** : shadcn `radio-group` + `progress` installés ; icônes PWA générées
  dans `public/icons/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
  `apple-touch-icon.png` — « M » blanc sur accent `#2350E6`).

## Sémantique figée `onboarding_step` (corr. arch#5)

`0` = non démarré · `1..4` = étape courante affichée (1 Google, 2 Préférences, 3 PWA, 4 Final) ·
`onboarding_completed=true` = terminé. FRONT-A et BACK s'accordent sur cette échelle.

## Découpage en agents (4 agents, contrats figés)

### Agent DB — `postgres-developer` — table préférences + migration RLS

- `src/lib/db/schema/preferences.ts` : table `user_preferences`
  - `userId text NOT NULL` réf `user.id` onDelete cascade
  - `briefHour text NOT NULL default '07:00'`
  - `timezone text NOT NULL default 'Europe/Paris'` (corr. arch#7 — pour le brief planifié Round 007)
  - `notifImportantMail boolean default true`, `notifEventReminder boolean default true`,
    `notifBriefReady boolean default true`
  - `onboardingCompleted boolean NOT NULL default false`
  - `onboardingStep integer NOT NULL default 0`
  - `createdAt`, `updatedAt`
  - **`uniqueIndex("user_preferences_user_id_unique").on(userId)` SEUL** (pas d'index non-unique
    redondant — corr. arch#10)
  - **CHECK** (corr. arch#6) : `brief_hour ~ '^[0-2][0-9]:[0-5][0-9]$'` et
    `onboarding_step BETWEEN 0 AND 4`
- Exporter dans `src/lib/db/schema/index.ts`.
- **Migration (corr. arch#1 / lead BLOC-2 — BLOQUANT)** : `npm run db:generate`, puis **ajouter
  À LA FIN du fichier de migration ainsi généré** (celui déjà enregistré dans
  `drizzle/meta/_journal.json`) les statements manuels pour `user_preferences` :
  `ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;`
  `CREATE POLICY user_preferences_user_isolation ON user_preferences USING (user_id = current_setting('app.current_user_id', true));`
  `GRANT SELECT, INSERT, UPDATE, DELETE ON user_preferences TO app_rls;`
  (le GRANT explicite est une ceinture-bretelles ; les `ALTER DEFAULT PRIVILEGES` de `0002` le
  couvrent déjà — mais on le met quand même). NE PAS créer un `.sql` orphelin non journalisé.
  Copier la forme EXACTE depuis `drizzle/0002_enable_rls.sql`.
  Puis `npm run db:migrate`. **Vérifier en psql** : `\d user_preferences` (rowsecurity=t), policy
  présente, grants `app_rls`.
- Type `UserPreference = typeof userPreferences.$inferSelect`.

Lire avant : `src/lib/db/schema/productivite.ts`, `drizzle/0002_enable_rls.sql`,
`drizzle/meta/_journal.json`, `.claude/rules/postgres.md`.

### Agent BACK — `fastapi-developer` — endpoints préférences

- `backend/app/models/preferences.py`, `services/preferences.py`, `api/preferences.py`.
- **Enregistrer `preferences_router` dans `main.py`** (prefix `/api`).
- `GET /api/preferences` → `{"data": prefs}`. **Create-or-default via `scoped_connection`**
  (JAMAIS le pool admin) : `INSERT ... (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`
  puis `SELECT`. L'unicité `UNIQUE(user_id)` garantit l'idempotence concurrente.
- `PATCH /api/preferences` body partiel `{brief_hour?, timezone?, notif_important_mail?,
  notif_event_reminder?, notif_brief_ready?, onboarding_completed?, onboarding_step?}` →
  `{"data": prefs}`. Valider `brief_hour` (`HH:MM`, 400 sinon), `onboarding_step` 0..4.
  **Set explicitement `updated_at = now()`** dans l'UPDATE (corr. arch#8 — defaultNow ne vaut
  qu'à l'INSERT).
- `prefs` = `{brief_hour, timezone, notif_important_mail, notif_event_reminder, notif_brief_ready,
  onboarding_completed, onboarding_step, created_at, updated_at}`.
- Tests `backend/tests/test_preferences.py` : create-or-default, **idempotence concurrente**
  (deux GET simultanés → une seule row), PATCH partiel, brief_hour invalide → 400,
  onboarding_step hors 0..4 → 400, RLS isolation cross-user, 401 sans cookie.

Lire avant : `backend/app/api/google.py`, `backend/app/db/client.py`, `preferences.ts`, `main.py`.

### Agent FRONT-A — `nextjs-developer` — Onboarding + OAuth `next` + préférences + redirection

INVOQUE `frontend-design`. Mockup onboarding (+ png).

**Threading OAuth `next` (corr. lead BLOC-1 — BLOQUANT)** — FRONT-A possède ces 3 fichiers :
- `src/lib/google-oauth.ts` : la charge signée (`signerEtatOAuth`) doit transporter un champ
  `next` (chemin interne).
- `src/app/api/google/connect/route.ts` : lire `?next=` (whitelister aux chemins internes
  commençant par `/`, défaut `/reglages`), l'inclure dans l'état signé.
- `src/app/api/google/callback/route.ts` : rediriger vers `next` validé (défaut `/reglages`
  → comportement Round 003 inchangé si absent). Préserver `?google=connected|error`.
  L'onboarding appelle donc `/api/google/connect?next=/onboarding`.

**Onboarding** :
- `src/app/onboarding/page.tsx` (Server `requireUser()` + wizard client).
- `src/components/onboarding/` (≤150 lignes/fichier) : `onboarding-wizard.tsx` (état d'étape via
  `progress`, persiste `onboarding_step` par PATCH), 4 étapes :
  - `etape-google.tsx` : carte permissions + bouton → `/api/google/connect?next=/onboarding` ;
    au retour, statut via `/api/google/status` (skippable si déjà connecté) ; `?google=error`
    → message non technique + réessayer.
  - `etape-preferences.tsx` : heure du brief (select) + 3 toggles → PATCH `/api/preferences`.
  - `etape-pwa.tsx` : consomme le hook `usePwaInstall()` (voir contrat figé). Si `canInstall`
    → bouton « Installer » (`promptInstall()`) ; si `isIOS` → instructions « Partager → Sur
    l'écran d'accueil » ; si `isInstalled`/non éligible → « déjà installé / passe cette étape ».
    Étape passable.
  - `etape-finale.tsx` : « Tout est prêt » → PATCH `onboarding_completed=true` → `router.push("/")`.
    Mentionner que le brief réel arrive plus tard (transitoire « cockpit prêt »).
- **Redirection sign-up (corr. lead mineur)** : dans `src/components/auth/sign-up-form.tsx`,
  rediriger le succès vers `/onboarding` (au lieu de `/`). Confirmer que toute création de compte
  passe par ce formulaire.
- **Bannière de reprise (corr. arch#9)** : composant `src/components/onboarding/onboarding-resume-banner.tsx`
  (client, lit `/api/preferences` ; si `onboarding_completed=false` → CTA discret « Termine ta
  configuration » qui renvoie à `/onboarding`). FRONT-A le monte dans
  `src/components/cockpit/cockpit-client.tsx` (import + 1 ligne). **FRONT-A possède
  `cockpit-client.tsx`** ; FRONT-B ne le touche pas.
- **Onglet « Brief & notifications »** : remplacer `brief-notifications-placeholder.tsx` par un
  vrai formulaire (heure + timezone + 3 toggles) lisant/écrivant `/api/preferences` ; MAJ import
  dans `src/app/reglages/page.tsx`. **FRONT-A possède `/reglages`.**
- Types snake_case : `src/components/onboarding/types.ts` (Preferences = {brief_hour, timezone, …}).

### Agent FRONT-B — `nextjs-developer` — PWA + responsive + états d'échec

INVOQUE `frontend-design` pour les écrans visibles.

**PWA (Next 16 — corr. lead BLOC-3)** :
- `src/app/manifest.ts` (metadata route → `manifest.webmanifest`) : name/short_name « MyDay »,
  start_url `/`, display `standalone`, background_color `#F5F7FB`, theme_color `#2350E6`, icons
  `public/icons/` (192, 512, maskable 512). **Ne PAS ajouter de `<link rel=manifest>` manuel**
  (auto-injecté par `manifest.ts`).
- `layout.tsx` (FRONT-B seul) : `theme_color` va dans l'export **`viewport`** (pas `metadata`) ;
  métadonnées Apple (`appleWebApp` / apple-touch-icon via `metadata`) ; monter
  `<PwaInstallProvider>` (autour de children) et `<ServiceWorkerRegister/>`.
- `src/components/pwa/pwa-install-provider.tsx` : bufferise `beforeinstallprompt` dans un
  **singleton au niveau layout** (capté dès le boot, avant tout montage d'étape), expose le hook
  `usePwaInstall()` (voir contrat figé). Gère `isIOS`, `isInstalled`
  (`matchMedia('(display-mode: standalone)')` ou `navigator.standalone`), non éligible.
- `src/components/pwa/service-worker-register.tsx` : enregistre `public/sw.js`
  **UNIQUEMENT si `process.env.NODE_ENV === "production"`** ; en dev, `unregister()` défensif de
  tout SW existant (corr. arch#4 / lead IMP-3).
- `public/sw.js` : cache **versionné** (`myday-cache-v1`), purge des anciens caches dans
  `activate` ; `skipWaiting` + `clients.claim` ; **network-first pour les requêtes de
  navigation/document et `/_next/data`** (sinon app shell figée après déploiement) ;
  cache-first pour les assets statiques ; **JAMAIS `/api`** (network-only).

**Audit responsive** (règles mobile de `.project/design.md`) : corriger le rendu mobile de
`planning`, `notes`, `taches`, `navbar`. Le planning est dense → garantir une vue jour lisible
sur mobile. Corrections chirurgicales. **NE TOUCHE PAS `cockpit-client.tsx` (FRONT-A) ni
`/reglages` (FRONT-A) (corr. lead IMP-1).**

**États d'échec (décision revue)** : PROUVER la réutilisation de l'existant (grep/lien), ne pas
recréer d'état parallèle : refus OAuth / `?google=error`, jeton révoqué → bannière reconnexion
(état `reauth_required` Round 003), invitation expirée (Round 002), états vides premier login
(Round 004). Compléter uniquement les manques (messages non techniques).

**NE TOUCHE PAS** : `src/app/onboarding/**`, `src/components/onboarding/**`, sign-up-form,
reglages, cockpit-client, connect/callback/google-oauth (périmètre FRONT-A).

## Contrats figés

### API préférences (snake_case)
- `GET /api/preferences` → `{"data": prefs}` (create-or-default via scoped_connection)
- `PATCH /api/preferences` `{brief_hour?, timezone?, notif_important_mail?, notif_event_reminder?,
  notif_brief_ready?, onboarding_completed?, onboarding_step?}` → `{"data": prefs}`
  (400 si brief_hour mal formé ou step hors 0..4 ; PATCH set `updated_at=now()`)
- `prefs` = `{brief_hour, timezone, notif_important_mail, notif_event_reminder, notif_brief_ready,
  onboarding_completed, onboarding_step, created_at, updated_at}`

### Hook PWA (corr. arch#3 / lead IMP-2 — figé, FRONT-B fournit / FRONT-A consomme UNIQUEMENT)
`import { usePwaInstall } from "@/components/pwa/pwa-install-provider"`
`usePwaInstall(): { canInstall: boolean; isIOS: boolean; isInstalled: boolean; promptInstall: () => Promise<void> }`
Interdit : passer par `window` brut côté FRONT-A.

## Coordination / anti-conflits
- `main.py` → BACK. `layout.tsx` + `public/sw.js` + `pwa/**` → FRONT-B. `cockpit-client.tsx` +
  `/reglages` + sign-up-form + onboarding/** + connect/callback/google-oauth → FRONT-A.
- Dépendance d'import : FRONT-A importe `usePwaInstall` du fichier de FRONT-B (chemin figé) ;
  le lead vérifie `tsc` à la convergence.
- FRONT-A/BACK codent contre les contrats figés ; le lead applique/​vérifie la migration RLS.

## Tests fin de round
- DB : migration journalisée appliquée, `\d user_preferences` (RLS=t + policy + grants app_rls + CHECK).
- Backend : `pytest -q` (create-or-default, idempotence concurrente, PATCH, validations, RLS, 401)
  + `ruff check`. **Redémarrer uvicorn** puis endpoints 401 sans cookie.
- Frontend : `npx tsc --noEmit` (0) + `npm run build`. Grep anti-camelCase. `/manifest.webmanifest`
  200. SW : pas d'enregistrement en dev (console propre), pas de cache `/api`.
- Parcours onboarding : 4 étapes → cockpit ; `onboarding_step` repris à la bonne étape ;
  connexion Google revient bien sur `/onboarding` (pas `/reglages`) ; préférences persistées et
  relues dans les réglages ; bannière de reprise visible tant que non terminé.
- Adversarial : PATCH brief_hour invalide → 400 ; refus OAuth → message clair ; responsive mobile
  (viewport étroit) sans débordement ; SW n'interfère pas avec le HMR en dev.

## Risques / vigilance
1. **Migration RLS journalisée** (BLOQUANT) : appendre le SQL RLS DANS la migration générée, pas
   un fichier orphelin. Vérifier en psql. (Les GRANT sont déjà auto via `ALTER DEFAULT PRIVILEGES`
   de `0002` — le point critique est l'ENABLE RLS + POLICY, pas le GRANT.)
2. **Retour OAuth codé en dur** (BLOQUANT) : threader `next` connect→état→callback, défaut inchangé.
3. **PWA Next 16** : theme_color dans `viewport`, pas de `<link manifest>` manuel, SW prod-only.
4. **beforeinstallprompt** : singleton layout, cas iOS/déjà-installé/non-éligible gérés.
5. **Casse snake_case** : contrat figé, interfaces TS calquées, grep.

## Corrections review intégrées (traçabilité)
arch#1/lead BLOC-2 (RLS dans migration journalisée) · arch#2 (GRANT auto, risque recadré) ·
arch#3/lead IMP-2 (hook `usePwaInstall` figé, pas de window) · arch#4/lead IMP-3 (SW prod-only +
network-first nav + purge cache) · arch#5 (sémantique onboarding_step) · arch#6 (CHECK DB) ·
arch#7 (colonne timezone) · arch#8 (PATCH updated_at) · arch#9 (bannière reprise onboarding) ·
arch#10 (uniqueIndex seul) · lead BLOC-1 (threading OAuth next, 3 fichiers → FRONT-A) ·
lead BLOC-3 (PWA Next 16) · lead IMP-1 (reglages hors FRONT-B) · Next 15→16 · idempotence concurrente testée.
