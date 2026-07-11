# Plan d'exécution — Round 004 « Cockpit : dashboard, planning, notes, tâches »

> Version révisée après review architect-reviewer + lead-dev-reviewer (12 corrections intégrées).

## Contexte et invariants

- **Stack dual-stack** : mutations via API FastAPI uniquement (PAS de Server Actions).
  Frontend consomme via `apiCall` (`src/lib/api.ts`, `credentials: include`).
- **Schéma BDD déjà posé au Round 001** : tables `tasks`, `notes`, `note_appends`,
  `events`, `usage_events` existent, RLS activée, policies `*_user_isolation` (ALL),
  grants `app_rls` complets. **AUCUNE migration Drizzle dans ce round.** Tenable car :
  (a) fuseau géré en config `Europe/Paris`, (b) le badge « via l'assistant » n'est PAS
  porté par les events (table `events` sans colonne `origine`, cf. correction #7).
- **RLS obligatoire** : tout contenu passe par `scoped_connection(user.id)`
  (`backend/app/db/client.py`). Jamais le pool admin pour tasks/notes/events/usage.
- **Contrat de casse (SOP `api-response-casing-contract`)** : réponses API en
  **snake_case** de bout en bout ; interfaces TS et composants lisent en snake_case.
  `apiCall` ne transforme aucune clé. Zéro camelCase côté conso API.
- **Design AEVIO One** : tokens CSS (`bg-bg/text-ink/bg-soft/accent`, `--success`=accent,
  AUCUN vert), Plus Jakarta Sans + JetBrains Mono, colonne `max-w-4xl`, mobile-first,
  tutoiement, « journée » jamais « matinée ». shadcn/ui + sonner (toasts bleus).
- **Cockpit = page d'accueil `/`** (remplace le placeholder de `src/app/page.tsx`).
  Bloc brief IA **exclu** (Round 007). Bloc « Mails importants » = **placeholder** (Round 006).
- **Garde d'auth (correction #11)** : chaque page (`/`, `/planning`, `/notes`, `/taches`)
  est un Server Component `page.tsx` qui appelle `requireUser()` (redirect sign-in si non
  connecté) + rend `<Navbar>` et un **composant client** enfant qui fait le `apiCall`.
  Ce pattern donne à la fois la garde d'auth ET le fetch client (cohérent Round 003).

## Découpage en agents (4 agents, contrat API figé comme source de vérité)

Pas de `postgres-developer` (schéma complet, zéro migration). Les agents frontend codent
contre le contrat figé pendant que le backend l'implémente.

### Pré-étape lead (AVANT dispatch, corrections #9) — je la fais moi-même
- Pré-installer les composants shadcn requis pour éviter la collision `components/ui` +
  `package.json` entre les 2 agents front : `npx shadcn@latest add dialog` (+ vérifier
  `skeleton`, `checkbox`, `textarea`, `switch` présents, sinon les ajouter). Un seul
  `shadcn add`, séquentiel, avant de lancer FRONT-1/FRONT-2.

### Agent BACK-1 — `fastapi-developer` — Tasks + Notes + Usage + `main.py` (sonnet, score ~4)

Fichiers :
- `backend/app/models/tasks.py`, `services/tasks.py`, `api/tasks.py`
- `backend/app/models/notes.py`, `services/notes.py`, `api/notes.py`
- `backend/app/models/usage.py`, `services/usage.py`, `api/usage.py`
- **Possède `backend/app/main.py`** : enregistre TOUS les routers du round
  (tasks, notes, usage, events, cockpit) — cf. séquencement #8 ci-dessous.

Règles :
- **`task_completed` atomique (correction #5)** : le PATCH qui passe une tâche à `faite`
  fait `UPDATE tasks SET statut='faite', completed_at=now() WHERE id=$1 AND user_id=$2
  AND statut <> 'faite' RETURNING *`. Insérer `usage_events` type `task_completed`
  UNIQUEMENT si une row a été modifiée (évite double-émission sur double-clic/toggle
  optimiste, et évite d'écraser `completed_at`). Même `scoped_connection`.
- Recherche notes : `q` en `ILIKE` sur `titre`+`contenu`, filtre `archivee`,
  tri épinglées d'abord puis `updated_at` desc.
- Endpoint `usage-events` : rejette `task_completed` (400) — émis serveur uniquement.

Lire avant de coder : `backend/app/api/google.py` + `admin.py` (pattern
endpoint/service/model, `Depends(get_current_user)`, réponses `{"data": ...}`),
`backend/app/db/client.py`, `src/lib/db/schema/productivite.ts` + `systeme.ts`.

### Agent BACK-2 — `fastapi-developer` — Events (Google) + Cockpit + config fuseau (opus, score ~7)

Fichiers :
- `backend/app/models/events.py`, `services/events.py`, `api/events.py`
- `backend/app/models/cockpit.py`, `services/cockpit.py`, `api/cockpit.py`
- `backend/app/config.py` : ajouter `app_timezone: str = "Europe/Paris"` (correction #6).
- `backend/app/services/google/calendar_client.py` : **ajouter `update_event` + `delete_event`**
  (correction #4 — actuellement seulement `list_events` + `insert_event`).
- **NE touche PAS `main.py`** (BACK-1 l'enregistre).

Écriture Google — **réutiliser le socle Round 003, NE PAS réimplémenter** (corrections #1/#2/#4) :
- Lire d'abord `backend/app/services/google/sync.py` : helpers `load_connection(user_id)`
  (refresh single-flight + verrou + statut `ok|locked|reauth_required|not_connected`),
  `push_local_events(user_id)` et `_push_one(...)` (génération/persistance `client_uuid`,
  `insert_event`, gestion `DuplicateEvent` 409 → réconciliation sans doublon).
- **POST /api/events** : générer `client_uuid`, INSERT local via `scoped_connection`
  (`source='myday'`), puis :
  - si l'utilisateur **n'a pas** de connexion Google → `sync_status='synced'`, aucun push.
  - sinon → `sync_status='sync_pending'`, puis push best-effort inline en réutilisant
    le flux existant (`_push_one`) précédé du refresh via `load_connection`. **Ne jamais
    échouer la sauvegarde locale.** Répondre immédiatement avec l'état réel.
- **Échec Google, verrou pris (`locked`), ou `reauth_required` (corrections #3/#6)** :
  laisser `sync_status='sync_pending'` (JAMAIS `sync_error` — car `push_local_events` ne
  re-sélectionne QUE `sync_pending`, un `sync_error` deviendrait orphelin). Le scheduler
  périodique repoussera au prochain run. Le front badge `sync_pending` ET `sync_error`
  comme « Non synchronisé », donc rien ne casse.
- **PATCH /api/events/{id}** : UPDATE local. Si `google_event_id` présent → `update_event`
  best-effort (le push insert-only ne propage PAS une modif ; échec → `sync_pending`).
  Si event local non synchronisé → maj locale seule.
- **DELETE /api/events/{id}** : suppression locale ; si `google_event_id` → `delete_event`
  best-effort (non bloquant si Google down).
- Anti-doublon : unique partiel `(user_id, google_event_id)` + `client_uuid` (déjà en place).

Cockpit `GET /api/cockpit` : une seule `scoped_connection` ; bornes du jour calculées en
`Europe/Paris` (correction #6) ; retourne notes épinglées (max ~5), events du jour,
tâches `a_faire` (tri échéance/priorité), `mails_importants: {placeholder: true}`.

### Agent FRONT-1 — `nextjs-developer` — Cockpit `/` (F3) + Tâches (F5) + navbar + /dashboard (opus, score ~5)

- `src/app/page.tsx` (Server Component) : `requireUser()` + `<Navbar>` + `<CockpitClient user>`.
- `src/components/cockpit/cockpit-client.tsx` (client) : `apiCall("/api/cockpit")`, `Skeleton`,
  gestion d'erreur, émet `dashboard_opened` au montage (`POST /api/usage-events`).
- Sections (~150 lignes max) dans `src/components/cockpit/` : `notes-epinglees.tsx`,
  `journee-timeline.tsx` (pastille « maintenant » `.pulse-now`), `taches-checklist.tsx`,
  `mails-importants-placeholder.tsx`, liens « Tout voir → » (notes→/notes, journée→/planning,
  tâches→/taches).
- Tâches (F5) : cocher (PATCH statut, optimiste + rollback/toast si échec), ajouter (POST),
  modifier (PATCH). Composants `src/components/taches/` : `task-item.tsx`, `task-quick-add.tsx`.
- **Propriétaire UNIQUE de la navbar/nav (correction #9)** : ajoute les liens Planning/Notes/
  Tâches dans `src/components/layout/navbar.tsx`. FRONT-2 n'y touche pas.
- **`/taches`** : page minimale (Server `requireUser()` + client), cible du « Tout voir »
  tâches (hypothèse : pas de mockup dédié, réutilise `task-item`/`task-quick-add`).
- **`/dashboard` (correction #10)** : `src/app/dashboard/page.tsx` → `redirect("/")`.
- Types snake_case : `src/components/cockpit/types.ts`, `src/components/taches/types.ts`.
- Mockup : `.project/mockups/pages/dashboard.html` (+ png).

### Agent FRONT-2 — `nextjs-developer` — Planning `/planning` (F4) + Notes `/notes` (F6) (opus, score ~6)

- `src/app/planning/page.tsx` (Server `requireUser()` + `<Navbar>` + client planning) :
  vue semaine/jour, navigation semaine, retour « ← Cockpit », CRUD événement (Dialog +
  react-hook-form + zod). **Badge « Non synchronisé » uniquement** (`sync_status` ∈
  {`sync_pending`,`sync_error`}). **PAS de badge « via l'assistant » sur les events
  (correction #7)** — la table events n'a pas d'`origine`, les events assistant arrivent
  au Round 008. Composants `src/components/planning/`.
- `src/app/notes/page.tsx` : liste + note ouverte, épingler/archiver, recherche (`q`),
  « Note rapide » (POST). Badge « via l'assistant » OK ici (notes.origine existe).
  Composants `src/components/notes/`.
- **NE touche PAS navbar/layout** (FRONT-1 en est propriétaire).
- Validation zod stricte `fin > debut` (correction #7 : unique barrière avec l'API, pas de
  CHECK DB). Fetch `apiCall`, Skeleton, toasts sonner.
- Types snake_case : `src/components/planning/types.ts`, `src/components/notes/types.ts`.
- Mockups : `.project/mockups/pages/planning.html`, `notes.html` (+ png).

## Séquencement des routers `main.py` (correction #8)

`main.py` (BACK-1) importe `api/events` et `api/cockpit` créés par BACK-2. Pour éviter un
échec de boot : BACK-2 crée ses modules router en premier (au minimum un `router = APIRouter()`
exporté dès le début). Le lead vérifie le boot FastAPI après convergence des agents et
corrige l'enregistrement `main.py` si un import manque encore.

## Contrat API figé (snake_case, réponses `{"data": ...}` / `{"detail": "..."}`)

Auth : `Depends(get_current_user)` (401 sinon). RLS via `scoped_connection`.

**Tasks**
- `GET /api/tasks?statut=a_faire|faite` → `{"data":[task]}`
- `POST /api/tasks` `{titre, description?, priorite?, echeance?}` → `201 {"data":task}`
- `PATCH /api/tasks/{id}` `{titre?, description?, priorite?, echeance?, statut?}` → `{"data":task}`
- `DELETE /api/tasks/{id}` → `204`
- `task` = `{id, titre, description, priorite, echeance, statut, origine, mail_id, completed_at, created_at, updated_at}`

**Notes**
- `GET /api/notes?archivee=false&q=texte` → `{"data":[note]}` (épinglées d'abord)
- `POST /api/notes` `{titre, contenu?}` → `201 {"data":note}`
- `PATCH /api/notes/{id}` `{titre?, contenu?, epinglee?, archivee?}` → `{"data":note}`
- `DELETE /api/notes/{id}` → `204`
- `note` = `{id, titre, contenu, epinglee, archivee, origine, created_at, updated_at}`

**Events**
- `GET /api/events?from=ISO&to=ISO` → `{"data":[event]}`
- `POST /api/events` `{titre, debut, fin, lieu?, description?}` → `201 {"data":event}` (400 si fin≤debut)
- `PATCH /api/events/{id}` `{titre?, debut?, fin?, lieu?, description?}` → `{"data":event}`
- `DELETE /api/events/{id}` → `204`
- `event` = `{id, titre, debut, fin, lieu, description, google_event_id, source, sync_status, created_at, updated_at}`

**Cockpit**
- `GET /api/cockpit` → `{"data":{notes_epinglees:[note], journee:[event], taches:[task], mails_importants:{placeholder:true}}}`

**Usage**
- `POST /api/usage-events` `{type, metadata?}` → `201 {"data":{id}}` (type ∈ CHECK ;
  `task_completed` refusé — 400).

## Tests fin de round

- Backend `cd backend && python -m pytest -q` (venv `~/.pi-tools/myday-venv`). Couverture :
  RLS isolation + 404 cross-user (tasks/notes/events) ; event sans Google → `synced` ;
  Google en échec/`locked`/`reauth_required` → reste `sync_pending` (pas orphelin) ;
  double push même `client_uuid` → 409 → zéro doublon ; double toggle tâche → un seul
  `task_completed` ; PATCH d'un event `synced` → `update_event` réellement appelé ;
  DELETE best-effort quand Google down ; `fin ≤ debut` → 400.
- Frontend : `npx tsc --noEmit` (0 erreur) + `npm run build`. Grep anti-camelCase sur la
  conso API. Auth guard : `/` non connecté → redirect sign-in.
- QA Playwright/manuelle : cockpit vraies données + états vides ; ajout/cochage tâche ;
  note rapide + épingler + recherche ; création événement (badge sync) ; navigation semaine.

## Corrections review intégrées (traçabilité)

1-2-4. Réutiliser `load_connection`/`read_tokens`/`push_local_events`/`_push_one` ; ajouter
`update_event`+`delete_event` au client ; ne pas recoder de push. 3. Échec → `sync_pending`
(jamais `sync_error` orphelin). 5. `task_completed` atomique `WHERE statut<>'faite'`. 6. Fuseau
`Europe/Paris` en config pour les bornes jour. 7. Pas de badge « via l'assistant » sur events
(pas de colonne) ; zod `fin>debut` = unique barrière. 8. Séquencement routers `main.py`.
9. Un seul propriétaire navbar (FRONT-1) ; shadcn pré-installé par le lead. 10. `/dashboard`
→ redirect `/` (FRONT-1). 11. Garde d'auth via Server Component `requireUser()` + enfant client.
12. Tests étendus (reauth, idempotence, double toggle, update/delete Google).
