# Plan d'exécution — Round 003 « Connexion Google et synchronisation »

Généré le 2026-07-10, **reviewé et corrigé** (architect + lead-dev : 7 critiques,
6 importants intégrés). Spec fonctionnelle de référence :
`.project/agent-designs/google_sync.md`. Décision actée : **sans plateforme Core**,
`google_sync` en **service FastAPI classique** (mêmes garanties : idempotence,
curseurs transactionnels, verrou, Google source de vérité).

## Corrections de la review — décisions actées

- **RLS partout (SEC-1, critique)** : `google_connections`, `events`, `mails`
  sont sous RLS (decisions.md). TOUS les accès passent par
  `scoped_connection(user_id)` (pose `SET LOCAL app.current_user_id`), JAMAIS le
  pool admin. Le pool admin reste réservé aux tables réellement hors RLS
  (user/session/invitations, cf. R002).
- **Routage OAuth (C2, critique)** : le `redirect_uri` autorisé côté Google est
  sur `:3000` (Next). Donc le flux vit en **Route Handlers Next** qui délèguent
  l'échange sensible à FastAPI :
  - `GET /api/google/connect` (Route Handler **Next**) : construit l'URL Google
    (client_id, scopes URL complètes, `access_type=offline`, `prompt=consent`,
    PKCE `code_challenge`), pose un **cookie state signé** (HMAC + nonce + TTL 10 min
    + user_id de la session), redirige vers `accounts.google.com/o/oauth2/v2/auth`.
  - `GET /api/google/callback` (Route Handler **Next**, redirect_uri) : vérifie le
    cookie state (signature, non expiré, usage unique, `state.user_id == session`),
    puis POST `code` + `code_verifier` vers FastAPI `POST /api/google/exchange`
    (interne, authentifié par le cookie de session) ; redirige ensuite vers
    `/reglages?google=connected|error`. L'échange token (client_secret), le
    chiffrement et le stockage se font DANS FastAPI.
- **Migrations schéma (ÉTAPE 0, 3 corrections)** :
  - `google_connections.tokenExpiry` (timestamptz) — sans ça, refresh incalculable.
    Les jetons chiffrés sont stockés dans les colonnes text existantes (le base64
    chiffré) — pas de renommage `*_enc`.
  - `mails.statut` CHECK étendu à `archived_remote` (le design le pose sur les
    suppressions distantes) — en plus de pending_triage/triaged.
  - `events.clientUuid` (text) — clé d'idempotence client, propagée dans
    `extendedProperties.private.mydayClientUuid` côté Google, matchée au pull →
    **pas de doublon** si crash entre l'insert Google et l'UPDATE local.
- **Refresh single-flight (RACE-1, critique)** : le refresh du token se fait
  UNIQUEMENT dans `load_connection` (avant le fan-out), sous le verrou de sync.
  Les branches ne refreshent JAMAIS ; un 401 en branche = échec de la branche
  (curseur intact, repris au run suivant), pas de refresh concurrent.
- **Connexion asyncpg par branche (RACE-2, critique)** : chaque branche parallèle
  acquiert sa PROPRE `scoped_connection` (une connexion asyncpg n'est pas
  partageable en concurrence). `asyncio.gather` sur des coroutines qui ont chacune
  leur connexion — OK en FastAPI pur.
- **Ordre push→apply (RACE-3, critique)** : `push_local_events` (remontée des
  events locaux `sync_pending`) s'exécute AVANT `apply_calendar_changes`, et
  l'écrasement « Google gagne » EXCLUT les rows encore `sync_pending` → aucune
  édition locale non partagée n'est détruite.
- **Révocation best-effort (SEC-3/M1)** : à la déconnexion et à `DELETE /api/me`,
  l'appel `revoke` Google est best-effort avec timeout court (3 s), JAMAIS bloquant
  pour la suppression locale.
- **Scheduler (INFRA-2)** : `AsyncIOScheduler` (APScheduler) démarré/arrêté dans
  le lifespan, chaque run utilisateur borné par un timeout global. `--workers 1`
  documenté comme garde anti-double-scheduler intra-process ; le VRAI garde-fou
  anti-double-run est le **verrou BDD `sync_locked_until`** (UPDATE conditionnel
  atomique). En multi-conteneurs, le verrou reste la protection.
- **Anti-spam manuel (INFRA-3)** : `POST /api/google/sync` throttlé via une colonne
  dédiée `lastManualSyncAt` (pas via calendar/gmail_synced_at qui n'avancent pas
  si le sync échoue) OU via le verrou 2 min. 1/30 s.
- **Boot fail-fast (OMIT-2)** : au démarrage FastAPI, valider `TOKEN_ENCRYPTION_KEY`
  (présente, 32 bytes base64) → crash explicite sinon.
- **Différés au Round 006 (OMIT-3, M2)** : la confirmation des envois
  `sending_unconfirmed` (nécessite `mail_drafts`) et le déclenchement de
  `mail_triage` — ce round remplit `mails` en `pending_triage` et s'arrête là
  (TODO référencé R006, pas de code mort).
- **Nom d'endpoint figé (OMIT-1)** : `POST /api/google/sync` (le front l'appelle).

## Séquencement (backend séquentiel, front en parallèle)

```
ÉTAPE 0 (postgres-developer)      : migrations schéma + chiffrement + repository google_connections
ÉTAPE 1a-i (fastapi-developer)    : OAuth (Next handlers + FastAPI exchange) + clients Google + refresh single-flight
ÉTAPE 1a-ii (fastapi-developer)   : service google_sync + scheduler + endpoints status/sync/déconnexion
ÉTAPE 1b (nextjs-developer, ∥ du backend) : carte Google réglages + fraîcheur + Route Handlers OAuth
ÉTAPE 2 (lead) : test OAuth + sync RÉELS avec le compte Google de l'utilisateur
```

## ÉTAPE 0 — postgres-developer : schéma + chiffrement (opus)

Lire : ce plan, `google_sync.md` (§9), `patterns.md`, `src/lib/db/schema/{google,productivite,mails}.ts`, `.claude/rules/postgres.md`.

1. **Migration Drizzle** : `google_connections.tokenExpiry` (timestamptz nullable) +
   `google_connections.lastManualSyncAt` (timestamptz nullable) ;
   `events.clientUuid` (text, index) ; `mails.statut` CHECK → ajouter `archived_remote`.
   Vérifier RLS `FOR ALL` déjà en place sur ces 3 tables (R001). `npm run db:generate` + migrate.
2. Chiffrement `backend/app/security/token_cipher.py` : AES-256-GCM enveloppe,
   clé `TOKEN_ENCRYPTION_KEY` (32 bytes base64, `.env.local` + `.env.local.example`,
   générer une clé dev). `encrypt(str)->str` (version||nonce||ct||tag base64),
   `decrypt(str)->str`, validation de clé au chargement (fail-fast). Tests : round-trip,
   tampering→échec, clé absente→erreur claire.
3. Repository `backend/app/db/google_connection.py` : accès via `scoped_connection(user_id)`
   (RLS) — get/upsert_tokens (chiffre)/read_tokens (déchiffre)/update_cursors/
   set_reauth/acquire_sync_lock (UPDATE conditionnel atomique)/release/touch_manual_sync.

Vérifs : pytest chiffrement + repository (avec BDD test scoped) ; migration ; ruff.

## ÉTAPE 1a-i — fastapi-developer : OAuth + clients Google (opus)

Lire : ce plan, `google_sync.md`, `patterns.md`, `backend/app/` (pools, scoped_connection, get_current_user), ÉTAPE 0.

1. `POST /api/google/exchange` (auth, appelé par le Route Handler Next) : reçoit
   `code` + `code_verifier`, échange contre les jetons (httpx → `oauth2.googleapis.com/token`),
   stocke chiffré via le repository (avec tokenExpiry), retourne ok/erreur.
   Endpoints Google figés : auth `accounts.google.com/o/oauth2/v2/auth`,
   token/refresh `oauth2.googleapis.com/token`, revoke `oauth2.googleapis.com/revoke`.
2. Clients `backend/app/services/google/{calendar_client,gmail_client}.py` (httpx) :
   appels list/get/insert. **Ne refreshent jamais** (le refresh est en amont) ;
   sur 401 → lèvent `ReauthRequired` ; sur 429/5xx → backoff borné. Gmail : lecture + send only, jamais delete.
3. `refresh_access_token(user_id)` dans le repository/service : appelé UNIQUEMENT
   par `load_connection`, sous verrou ; si `invalid_grant`/échec → marque reauth_required.

Vérifs : pytest avec httpx mocké (échange OK, refresh OK, invalid_grant→reauth, 401→ReauthRequired, 429→backoff) ; ruff.

## ÉTAPE 1a-ii — fastapi-developer : service sync + scheduler (opus)

Lire : `google_sync.md` EN ENTIER (steps), l'ÉTAPE 1a-i.

1. `backend/app/services/google/sync.py` — transposition fidèle du design :
   `load_connection` (verrou + refresh single-flight + statut reauth) →
   **push_local_events** (events `sync_pending`, id client via clientUuid dans
   extendedProperties, réconciliation idempotente) → `parallel` via `asyncio.gather`
   des branches **calendar** (fetch incrémental syncToken / resync 410 borné → apply
   upsert (userId, googleId), Google gagne SAUF rows sync_pending) et **gmail**
   (fetch incrémental historyId / resync 404 borné + plafond `max_mails_per_sync`
   → store_new_mails en `pending_triage`, dédup (userId, gmailId), suppressions
   distantes → `archived_remote`) — **chaque branche sa propre scoped_connection** ;
   curseur écrit DANS LA MÊME transaction que les données (cas `truncated` : curseur
   non avancé) → `finalize` (agrégats, last_sync par branche, libère le verrou ;
   TODO R006 : déclencher mail_triage). Une branche en échec n'échoue pas l'autre (partial).
2. `POST /api/google/sync` (auth, anti-spam via lastManualSyncAt 1/30 s) →
   lance un run ; `GET /api/google/status` (connecté/dernière sync par branche/scopes/reauth) ;
   `DELETE /api/google` (revoke best-effort 3 s + suppression connexion).
   Rouvrir `DELETE /api/me` : revoke best-effort avant purge.
3. Scheduler `AsyncIOScheduler` dans le lifespan (~5 min, un run/utilisateur à
   connexion valide, run borné par timeout, shutdown propre). `--workers 1`.

Vérifs : pytest (verrou empêche double-run ; refresh single-flight ; gather 2
connexions ; resync 410/404 ; conflit Google-gagne préserve sync_pending ;
doublon push→pull après crash simulé (insert Google + pas d'UPDATE) → pas de
doublon grâce à clientUuid ; idempotence re-run ; partial si une branche échoue) ; ruff.

## ÉTAPE 1b — nextjs-developer : carte Google + fraîcheur (sonnet)

Lire : ce plan, `design.md`, `patterns.md`, `mockups/pages/reglages.html` (carte Google) + png, `src/app/reglages/`, `src/lib/api.ts`.

1. **Route Handlers OAuth** (côté Next, cf. « Routage OAuth » ci-dessus) :
   `GET /api/google/connect` (build URL + cookie state signé + PKCE) et
   `GET /api/google/callback` (vérif state + user_id session + POST vers FastAPI
   /api/google/exchange + redirection /reglages?google=...). Secret HMAC du state = BETTER_AUTH_SECRET.
2. Carte Google dans `/reglages` fidèle au mockup : états non connecté / connecté
   (sync il y a X min, scopes rappelés, « ne supprime jamais rien dans Gmail »,
   boutons Resynchroniser + Déconnecter avec dialog) / reauth requis ; lecture via
   `GET /api/google/status` ; toasts sur `?google=connected|error` ; français accentué.
3. **Fraîcheur** : composant React partagé (fixe bas-gauche « À jour il y a X min »)
   branché sur la dernière sync, présent dashboard + pages internes.

Vérifs : build, tsc (ignorer .next/types/* 2.ts), lint, conforme mockup, dark mode + mobile.

## ÉTAPE 2 — Vérification lead (RÉELLE, avec le compte Google de l'utilisateur)

1. Build + tsc + lint + pytest + ruff verts
2. OAuth réel (navigateur, avec l'utilisateur) : Réglages → Continuer avec Google →
   consentement (mode Test) → autoriser → « connecté » ; **vérifier en BDD que les
   jetons sont CHIFFRÉS** (aucun token en clair)
3. Sync réelle : Resynchroniser → vrais événements Google en table `events`, vrais
   mails en `pending_triage` ; fraîcheur à jour
4. Adversarial : refus consentement → error propre ; double sync → verrou (1 seule) ;
   déconnexion → revoke + connexion supprimée ; token expiré → refresh auto ;
   state falsifié/mismatch session → rejet ; scheduler pas en double
5. Sécurité : aucun jeton/clé en clair (BDD ni logs) ; TOKEN_ENCRYPTION_KEY hors dépôt
6. decisions.md : acter connexion source de données ≠ Better-auth social + sans-plateforme
   + dettes R006 (mail_triage, sending_unconfirmed) ; rappeler à l'utilisateur de
   supprimer l'ancien secret Google inutilisé une fois la connexion validée

## Risques résiduels

- Quotas Google en mode Test : suffisants pour 1-2 utilisateurs
- Mails restent bruts (non triés) jusqu'au R006 — attendu
- Scheduler multi-conteneurs → protégé par le verrou BDD, pas par --workers 1
