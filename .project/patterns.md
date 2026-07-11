# Patterns — MyDay

Patterns établis pendant les rounds. À lire avant de créer un composant UI ou
un endpoint. (Créé au Round 001.)

## Backend (FastAPI)

- **Endpoint protégé** : `Depends(get_current_user)` (`backend/app/auth/session.py`) —
  vérifie la signature HMAC du cookie `better-auth.session_token` puis lookup la
  table `session`. Réponses `{"data": ...}` / erreurs via `HTTPException` 401 en français.
- **Cookie Better-auth (v1.6)** : valeur `<token>.<signature HMAC-SHA256 base64>`,
  URL-encodée en transit → `urllib.parse.unquote` OBLIGATOIRE avant vérification
  (Starlette ne décode pas). Le token stocké en BDD est la partie AVANT le point.
  Préfixe `__Secure-` en prod. Helpers dans `backend/app/auth/cookie.py`.
- **Accès BDD utilisateur** : TOUJOURS `async with scoped_connection(user.id) as conn:`
  (`backend/app/db/client.py`) — pose `SET LOCAL app.current_user_id` (texte, pas uuid)
  pour la RLS. JAMAIS `pool.acquire()` nu sur une table de contenu.
- **Rôles Postgres** : le backend applicatif se connecte en `app_rls` (non-superuser,
  `BACKEND_DATABASE_URL`) — la RLS est fail-closed. `DATABASE_URL` (app_admin) est
  réservé aux migrations Drizzle côté Next.js.
- **Transition d'état atomique + effet de bord (Round 004)** : pour un PATCH qui déclenche
  un effet de bord unique (ex. écrire `usage_events` type `task_completed`), faire
  `UPDATE ... SET statut='faite' WHERE id=$1 AND user_id=$2 AND statut <> 'faite' RETURNING *`
  et n'exécuter l'effet de bord QUE si une row est revenue. Évite la double-émission sur
  double-clic / toggle optimiste, sans lever d'erreur (fallback re-SELECT si course perdue).
- **Push Google best-effort non bloquant (Round 004)** : mutation locale qui doit remonter
  vers Google = INSERT/UPDATE local d'abord (jamais bloqué par Google), puis push best-effort
  via le socle Round 003 (`load_connection` → `_push_one`/`update_event`, `release_sync_lock`).
  Sur échec / verrou `locked` / `reauth_required` → laisser `sync_status='sync_pending'`
  (JAMAIS `sync_error` : `push_local_events` ne re-sélectionne que `sync_pending`, sinon
  l'événement devient orphelin). Ne jamais libérer un verrou détenu par un run concurrent.
  Voir le context manager `_connected_client` (`backend/app/services/events_google.py`).
- **Validation métier → 400, pas 422 (Round 005)** : valider les entrées business
  (`brief_hour` HH:MM, `onboarding_step` 0..4, `fin > debut`) DANS le service et lever
  `HTTPException(400)`, pas via un `field_validator` Pydantic (qui produit un 422 FastAPI).
  Le frontend attend un 400 avec message français exploitable.
- **Create-or-default sous RLS (Round 005)** : `INSERT INTO t (user_id) VALUES ($1)
  ON CONFLICT (user_id) DO NOTHING` puis `SELECT`, via `scoped_connection` — idempotent et
  sûr en concurrence grâce à `UNIQUE(user_id)`. Pattern pour une table 1-row-par-user (préférences).
- **Migration RLS journalisée (Round 005)** : drizzle-kit ne génère PAS les policies/grants.
  Les ajouter À LA FIN du fichier `.sql` GÉNÉRÉ par `db:generate` (déjà dans `_journal.json`),
  jamais dans un `.sql` orphelin (`db:migrate` ne l'appliquerait pas). Copier la forme de
  `drizzle/0002_enable_rls.sql`. Vérifier en psql (`\d`, `pg_policies`, grants).
- **Agents IA = services FastAPI (SANS Core)** : les designs `.project/agent-designs/*.md`
  (@workflow/@step/@configurable) sont la SPÉC ; l'implémentation est un service async normal dans
  `backend/app/services/<workflow>/`. Client LLM « prêt-pour-IA » : clé `ANTHROPIC_API_KEY` absente
  → `LlmUnavailable` → fallback heuristique (0 appel réseau) ; présence de la clé → IA, sans autre
  changement. Config via `config.py` (`<workflow>_*`). Cf. SOP `agent-design-to-fastapi-service`.
- **Modèle de réponse partagé entre rounds (Round 006)** : un modèle Pydantic réutilisé par un round
  ultérieur qui en change la forme (ex. `cockpit.mails_importants` passé de `{placeholder}` à
  `{placeholder, mails}`) doit être ASSOUPLI (`dict`) ou repris explicitement — sinon Pydantic
  droppe silencieusement la nouvelle clé au `model_dump()` (bug invisible, cf. SOP casse).
- **Préférence utilisateur > flag global** : un flag de `config.py` (ex. `triage_notify_important`)
  ne remplace pas une préférence par-utilisateur (`user_preferences.notif_important_mail`) —
  vérifier les DEUX avant un effet de bord visible par l'utilisateur.
- **Plan d'actions LLM validé par type (Round 008)** : un LLM qui décide d'actions → valider le plan
  ET les `params` de CHAQUE action par un modèle Pydantic dédié (`TaskParams`, `EventParams`…),
  whitelist stricte de types, action invalide écartée proprement (jamais de SQL/effet piloté par un
  champ brut du LLM). `action_key` dérivés d'une clé stable (`turn_key:index`), pas d'UUID généré par
  le LLM. Dédup `(conversation_id, turn_key)` en tête avant tout effet de bord.
- **Envoi externe irréversible « au plus un envoi » (Round 008)** : machine à états `mail_drafts`
  (pending_review→sending→sent, + `sending_unconfirmed` sur échec ambigu), transition atomique
  `WHERE statut='pending_review'`, `send_message` `max_retries=0`, Message-ID déterministe +
  réconciliation `rfc822msgid`, garde-fou destinataire post-LLM, token hors verrou sync. Aucun envoi
  sans décision `approve` explicite. Cf. SOP `at-most-once-external-send`.
- **Intégration vraie IA** : `complete_json` extrait le JSON même entouré de texte/```fences ;
  tests neutralisent la clé (`conftest` autouse `anthropic_api_key=""`) ; injecter la date du jour
  dans les prompts. Cf. SOP `agent-design-to-fastapi-service` (section durcissements).
- **Lib synchrone dans du code async (Round 009)** : `pywebpush` (et toute lib bloquante) →
  `await anyio.to_thread.run_sync(lambda: webpush(...))`. Ne JAMAIS appeler du sync bloquant
  directement dans l'event loop (partagé avec les schedulers, `--workers 1`).
- **I/O réseau lent hors transaction BDD (Round 009)** : ne jamais faire un appel réseau (push,
  webhook) DANS une `scoped_connection`/transaction — commiter d'abord (fermer la connexion), puis
  l'I/O best-effort après. Sinon épuisement du pool (`max_size=10`). Pont notification = INSERT+commit
  puis `dispatch_push` best-effort.
- **Enregistrement d'appareil sous RLS (Round 009)** : `push_subscriptions` a une policy stricte
  `user_id = current_setting(...)` qui bloque la réassignation d'un `endpoint` partagé entre users.
  L'upsert `subscribe` passe par le **pool admin** (comme session/invitations — enregistrement
  d'appareil, pas lecture de contenu d'un autre user) ; lectures/suppressions restent scopées RLS.
- **Raccourcis clavier** : `⌘K` = barre assistant (R008), `⌘/` = recherche globale (R009). Ne pas
  réutiliser `⌘K`.
- **Vérifier qu'un router est monté** : frapper l'endpoint (TestClient/curl), JAMAIS compter
  des `APIRoute` dans `app.routes` (fastapi 0.139 imbrique via `_IncludedRouter`). Redémarrer
  uvicorn après ajout d'endpoints. Cf. SOP `fastapi-route-registration-check`.

### Hooks Better-auth 1.6 (découvert au Round 002, prouvé par tests HTTP)

- Hooks de REQUÊTE au niveau racine `betterAuth({ hooks: { before, after } })` (≠ databaseHooks),
  chacun = `createAuthMiddleware(async (ctx) => {...})`, import `better-auth/api`.
- Matching par `ctx.path` sans préfixe (`/sign-up/email`, `/sign-in/email`).
- `ctx.body` : les champs transitoires non déclarés (ex. `invitationToken`) y survivent,
  lisibles dans before ET after — pas besoin d'additionalField.
- Nouvel utilisateur dans le `after` : `ctx.context.newSession?.user?.id` (autoSignIn: true).
- Rejet : `throw new APIError("BAD_REQUEST"|"FORBIDDEN", { message: "..." })` → remonte
  tel quel dans `error.message` côté authClient.
- Claim atomique d'une ressource à usage unique : UPDATE conditionnel RETURNING dans le
  hook BEFORE (jamais dans after — sinon deux créations concurrentes passent).
- Bypass seed : court-circuiter les hooks si `MYDAY_SEED_CONTEXT === "true"`.

## Base de données (Drizzle)

- Schéma découpé par domaine dans `src/lib/db/schema/` (auth, google, productivite,
  mails, ia, systeme) — jamais de monofichier.
- `timestamp(..., { withTimezone: true })` partout ; CHECK constraints sur les statuts ;
  index uniques partiels pour l'idempotence (assistantActionKey, sentGmailId,
  (userId, googleEventId), (userId, briefDate) pour le brief quotidien).
- Ids Better-auth = TEXTE (cuid), pas uuid — les FK userId sont du text.
- Seed idempotent : existence vérifiée avant `auth.api.signUpEmail`, rôle posé par
  UPDATE séparé, piloté par env ADMIN_EMAIL/ADMIN_PASSWORD.
- Migrations prod : `npm run db:bundle-migrate` (esbuild → dist/migrate.js + dist/seed.js),
  advisory lock intégré ; consommés par `entrypoint.web.sh`.

### Endpoints admin (Round 002)

- `Depends(require_admin)` (403 « Accès réservé à l'administrateur ») pour tout endpoint admin.
- **Pool admin** `get_admin_pool()` (DATABASE_URL app_admin) : écritures sur les tables hors
  RLS (user/session/invitations) UNIQUEMENT — jamais sur du contenu utilisateur
  (toujours `scoped_connection`).
- **Garde dernier-admin atomique** : la condition `NOT (role='admin' AND (SELECT count(*)
  FROM "user" WHERE role='admin' AND active) <= 1)` vit DANS le WHERE de l'UPDATE/DELETE
  (jamais SELECT-puis-UPDATE) ; 0 ligne → désambiguïser 404/400 par un SELECT d'existence.
- **Désactivation de compte** : flip `active=false` + `DELETE FROM session` dans LA MÊME
  transaction (aucune fenêtre désactivé-mais-connecté).
- **Statuts dérivés** (ex. « expiree ») : calculés à l'affichage, jamais stockés — la BDD
  ne stocke que les états de la machine (valeurs ASCII sans accent : envoyee/acceptee/revoquee).
- Valeurs de statut en BDD : TOUJOURS ASCII sans accent ; messages UI : TOUJOURS accentués.

## Frontend (Next.js)

- **Middleware = `src/proxy.ts` (Next 16)** : `middleware.ts` est renommé `proxy.ts` (fonction
  `proxy`). Liste blanche publique dans `estCheminPublic`. **Les assets PWA (`manifest.webmanifest`,
  `sw.js`, `/icons`) DOIVENT y être** sinon 307 → /sign-in et PWA non installable (SOP
  `pwa-assets-public-proxy`). Toute ressource servie sans session (robots, sitemap, .well-known)
  → whitelist.
- **PWA (Round 005)** : manifest via `src/app/manifest.ts` (route metadata, `<link>` auto-injecté) ;
  `themeColor` dans l'export `viewport` (PAS `metadata`) ; SW `public/sw.js` enregistré UNIQUEMENT
  en prod (`NODE_ENV==='production'`) + `unregister()` défensif en dev (`service-worker-register.tsx`) ;
  cache versionné + purge `activate`, network-first navigation, JAMAIS `/api`. Hook d'installation :
  `usePwaInstall()` (`pwa-install-provider.tsx`, singleton `beforeinstallprompt` capté au boot,
  `{canInstall, isIOS, isInstalled, promptInstall}`) — ne jamais lire `window.beforeinstallprompt` direct.
- **Formulaire autosave (Round 005)** : réglages « Brief & notifications » — PATCH immédiat par
  champ modifié, MAJ optimiste + rollback + toast d'erreur, pas de bouton « Enregistrer ».
- **`ApiError` avec `status` (Round 007)** : `src/lib/api.ts` — `apiCall` lève une `ApiError`
  (`extends Error`, champ `status: number`) pour distinguer un 429 (anti-spam) ou un 4xx spécifique
  d'une erreur générique sans se fier au texte du message. Consommer via `if (err instanceof ApiError
  && err.status === 429)`. Additif : le code qui lit `.message` continue de marcher.
- **Tokens AEVIO One** : tout passe par les CSS vars de `src/app/globals.css`
  (`--bg/--ink/--accent/--soft`, `--success` = accent, AUCUN vert). Utilitaires :
  `bg-bg`, `text-ink`, `bg-soft`, `rounded-card` (14px), `rounded-inner` (12px),
  `shadow-card`, `shadow-cta`, `.cta-gradient`, `.label-mono`, `.pulse-now`, `.fade-in`.
- **Polices** : Plus Jakarta Sans (`font-display`/`font-body`) + JetBrains Mono
  (`font-mono`, labels uppercase tracking .04em) via next/font/google.
- **Dark mode** : attribut `html[data-mode="dark"]`, persistance `localStorage["myday-theme"]`,
  script anti-flash inline dans layout.tsx, toggle = `dark-mode-toggle.tsx`
  (Client Component avec useSyncExternalStore + MutationObserver).
- **Navbar** : `src/components/layout/navbar.tsx` (Server Component) — logo M dégradé,
  date du jour `Intl.DateTimeFormat("fr-FR")` capitalisée, barre assistant, ☾, avatar
  initiale. Mobile : assistant en 2e ligne, ⌘K masqué.
- **Layout** : colonne unique `max-w-4xl` PARTOUT ; pages protégées par `requireUser()`
  (`@/lib/session`) ; textes français accentués, tutoiement, « journée » jamais « matinée ».
- **shadcn/ui** : thème branché sur les tokens sémantiques (--primary = accent) ;
  ne pas écraser un composant déjà conforme.
- **Surface de carte = `bg-card`, JAMAIS `bg-white` (Round 010)** : `bg-white` est une couleur en dur
  qui ne bascule pas en mode sombre. Toujours utiliser `bg-card` (mappé sur `--surface`, qui bascule via
  `html[data-mode="dark"]`) pour les surfaces de cartes/panneaux. Exception : un badge/élément blanc posé
  sur un fond `cta-gradient` (couleur de marque constante) peut rester `bg-white`.
- **Boutons icônes** : toujours un `aria-label` (loupe « Rechercher », cloche « Notifications », ☾
  « Basculer le mode sombre », menu « Menu du compte »).

## Environnement de développement

- Python : venv `$HOME/.pi-tools/myday-venv` (3.12) — utiliser ses binaires
  (`bin/python3`, `bin/uvicorn`, `-m pytest`, `-m ruff`).
- Docker : `docker compose up -d` (Postgres 5433 + MinIO 9000/9001).
- Lancement : `npm run dev` (3000) + `npm run backend:dev` (8000).
