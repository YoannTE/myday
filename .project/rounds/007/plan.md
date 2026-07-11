# Plan d'exécution — Round 007 « Brief IA quotidien »

## Contexte et décisions structurantes

- **SANS plateforme Core** + **règles d'abord, IA plus tard** (cf. SOP `agent-design-to-fastapi-service`,
  Round 006) : `daily_brief` = service FastAPI normal. Sans clé `ANTHROPIC_API_KEY`, le **brief
  dégradé** (assemblé sans IA, même schéma `BriefContent`) est le CHEMIN NOMINAL. Réutiliser le
  client LLM gracieux existant `backend/app/services/mail_triage/llm.py` (`complete_json`,
  `LlmUnavailable`) — NE PAS le réimplémenter. Prêt-pour-IA : rédaction fine dès qu'une clé est là.
- Le design `.project/agent-designs/daily_brief.md` = spéc fonctionnelle (steps, prompts, ton,
  garde-fous, tests).
- **Table `briefs` déjà posée** : `contenu` jsonb NOT NULL (stocke `{headline, priorities[],
  schedule_summary, tasks_summary, mails_summary, alerts[]}`), `type` ∈ {`quotidien`,`a_la_demande`}
  (CHECK), `degraded` bool, `brief_date` date, unique partiel `(user_id, brief_date) WHERE
  type='quotidien'`. **Mapping trigger→type** : `scheduled`→`quotidien` (upsert idempotent),
  `manual`/`onboarding`→`a_la_demande` (insert). AUCUNE migration `briefs`.
- **MIGRATION** : ajouter `brief_tone` à `user_preferences` (ton exposé dans les réglages) —
  RLS déjà active sur la table, ajouter la colonne + CHECK dans la migration générée+journalisée
  (SOP `pwa-assets-public-proxy`… non — SOP migration RLS journalisée du Round 005).
- RLS via `scoped_connection`. PII : aucun contenu de brief/mail/événement dans les logs.
- **Config @configurable → `config.py`** (sauf `tone` = per-user dans `user_preferences.brief_tone`,
  demandé par le spec dans les réglages). Autres : `brief_llm_model`, `brief_max_priorities=3`,
  `brief_include_mails=true`, `brief_lookahead_tomorrow=true`, `brief_notify_ready=true`.
- Le cockpit (Round 004) EXCLUAIT le brief : ce round ajoute la carte hero F8 en tête du cockpit.

## Découpage en agents

### Agent DB — `postgres-developer` [SYNCHRONE, en premier] — colonne brief_tone

- `src/lib/db/schema/preferences.ts` : ajouter `briefTone text NOT NULL default 'neutre'` + CHECK
  `brief_tone IN ('neutre','motivant','direct')`.
- `npm run db:generate` → **ajouter le CHECK à la fin de la migration générée** (drizzle-kit ne
  génère pas toujours les CHECK litéraux ; vérifier, sinon compléter dans le fichier journalisé) →
  `npm run db:migrate`. Pas de RLS à re-poser (déjà sur la table). Vérifier en psql.

### Agent BACK-BRIEF — `fastapi-developer` — moteur brief + scheduler + endpoints (opus)

Dossier `backend/app/services/daily_brief/` (≤150 lignes/fichier) :
- `config.py` (racine, MODIFIÉ) : `brief_llm_model="claude-sonnet-4-5"`, `brief_max_priorities=3`,
  `brief_include_mails=True`, `brief_lookahead_tomorrow=True`, `brief_notify_ready=True`,
  `brief_scheduler_enabled=True`, `brief_manual_cooldown_seconds=60`.
- `daily_brief/context.py` : `collect_context(user_id, brief_date, ...)` — une passe : événements
  du jour (bornes `Europe/Paris` / timezone user, + lendemain 00:00-12:00 si lookahead), tâches
  dues/en retard (tri priorité puis échéance), mails importants `triaged` score ≥
  `settings.triage_importance_threshold` non répondus ≤ 7 j, `last_sync_at` (google_connections).
  Bornes 20/20/10 avec `truncated`.
- `daily_brief/alerts.py` (pur) : alertes déterministes Python — conflit d'agenda (chevauchement),
  échéance < 24 h, `last_sync_at` > 2 h → « données non actualisées depuis {durée} ».
- `daily_brief/compose.py` : `compose_brief(context, tone, ...)`. Tente `mail_triage.llm.complete_json`
  (schéma `BriefContentModel`) ; sur `LlmUnavailable`/échec → **brief dégradé** déterministe
  (headline générique, priorités = top tâches/mails, synthèses templatées, alertes recopiées,
  `degraded=true`). Contexte vide → brief « journée calme ». Garde-fou anti-hallucination : priorité
  citant un élément absent → remplacée par la règle déterministe. Prompts transposés (français,
  tutoiement, 3 variantes de ton) SANS champs absents du schéma.
- `daily_brief/persist.py` : `persist_brief(user_id, brief_date, trigger, content, degraded)` —
  `scheduled`→ INSERT `type='quotidien'` `ON CONFLICT (user_id, brief_date) WHERE type='quotidien'
  DO UPDATE` ; `manual`/`onboarding`→ INSERT `type='a_la_demande'`. Notification « brief prêt »
  (uniquement `scheduled` + `brief_notify_ready` + `user_preferences.notif_brief_ready`), type
  `brief_pret`, ref_id=brief_id, contenu=headline, `ON CONFLICT (user_id, ref_id, type) DO NOTHING`.
  Journal d'usage : insérer `usage_events` type `brief_generated`.
- `daily_brief/orchestrator.py` : `run_daily_brief(user_id, trigger, brief_date)` → collect →
  alerts → compose → persist (+ notify). Retourne `{brief_id, generated, degraded}`.
- `services/brief_scheduler.py` : AsyncIOScheduler séparé (pattern `google/scheduler.py`), tick
  ~toutes les 5 min : pour chaque utilisateur actif, calculer l'heure locale (timezone) ; si
  `heure_locale >= brief_hour` ET aucun brief `quotidien` pour la date locale → `run_daily_brief(
  user, "scheduled", date_locale)` (catch-up + idempotent). Démarré/arrêté dans le lifespan `main.py`.
- `api/brief.py` : `POST /api/brief/generate` (auth, anti-spam 1/min via
  `brief_manual_cooldown_seconds` — dernier brief `a_la_demande` généré < 60 s → 429), `trigger`
  depuis query/body (`manual` par défaut, `onboarding` accepté), `brief_date` = aujourd'hui (timezone
  user) calculée côté endpoint. `GET /api/brief/today` optionnel OU via cockpit. Router `brief_router`.
- `services/cockpit.py` (MODIFIÉ) : ajouter `"brief"` à l'agrégat = le brief du jour (quotidien du
  jour, sinon dernier `a_la_demande` du jour, sinon `null`). `{contenu, degraded, generated_at, type}`.
- `main.py` (MODIFIÉ) : enregistrer `brief_router` + démarrer/arrêter `brief_scheduler` dans le lifespan.
- Tests `backend/tests/test_daily_brief.py` : happy path (contexte riche → brief 3 priorités,
  dégradé car pas de clé), journée calme (0 donnée → brief calme), upsert scheduled même jour
  (1 seule row), manual → pas de notif, sync en retard → alerte présente, anti-spam manuel 429,
  RLS cross-user, `usage_events` brief_generated, notif respecte `notif_brief_ready`.

### Agent FRONT-BRIEF — `nextjs-developer` — carte hero F8 + réglages ton + trigger onboarding (opus)

INVOQUE `frontend-design`. Mockups : `dashboard.html` (carte hero brief), `onboarding.html` (étape 4).
- `src/components/cockpit/brief-hero.tsx` : carte hero en TÊTE du cockpit (accroche/headline,
  priorités, synthèses planning/tâches/mails, alertes, **état dégradé DISCRET** — petit libellé
  « brief express » si `degraded`, pas d'alarme). Bouton « Régénérer » → `POST /api/brief/generate`
  (anti-spam : bouton désactivé pendant l'appel + gestion 429 avec message « attends une minute »),
  puis recharge le cockpit. Si aucun brief (`brief===null`) → état vide « Ton premier brief arrive »
  + bouton générer. Monté dans `cockpit-client.tsx` en première position (avant la bannière reprise).
- `cockpit-client.tsx` + `cockpit/types.ts` (MODIFIÉS) : recevoir `brief` de l'agrégat.
- `src/components/reglages/brief-notifications-form.tsx` (MODIFIÉ) : ajouter un select « Ton du
  brief » (neutre/motivant/direct) relié à `user_preferences.brief_tone` (autosave PATCH).
- `src/components/onboarding/etape-finale.tsx` (MODIFIÉ) : avant `router.push("/")`, appeler
  `POST /api/brief/generate?trigger=onboarding` (best-effort, non bloquant — si échec, on continue).
- Types snake_case (`brief` = `{contenu: {headline, priorities, schedule_summary, tasks_summary,
  mails_summary, alerts}, degraded, generated_at, type}`).
- NE TOUCHE PAS : mails, planning, notes, taches, navbar, layout.

## Contrat API figé (snake_case)

- `POST /api/brief/generate` (body/query `{trigger?: "manual"|"onboarding"}`) → `{"data":
  {brief_id, generated, degraded}}` (429 si < cooldown pour manual)
- `GET /api/cockpit` → ajoute `brief: {contenu:{headline, priorities:[str], schedule_summary,
  tasks_summary, mails_summary, alerts:[str]}, degraded: bool, generated_at, type} | null`
- `PATCH /api/preferences` accepte `brief_tone` (déjà partiel — ajouter le champ au modèle)
- `brief.contenu` = structure `BriefContent`.

## Coordination / anti-conflits
- DB agent d'abord (migration brief_tone), synchrone.
- `config.py`, `main.py`, `services/cockpit.py`, `services/daily_brief/**`, `brief_scheduler.py`,
  `api/brief.py` → BACK-BRIEF. `models/preferences.py` + PATCH preferences (accepter brief_tone) →
  BACK-BRIEF aussi (petit ajout).
- `cockpit-client.tsx`, `cockpit/types.ts`, `brief-hero.tsx`, `brief-notifications-form.tsx`,
  `etape-finale.tsx` → FRONT-BRIEF. Pas de chevauchement avec BACK.
- FRONT-BRIEF code contre le contrat figé.

## Tests fin de round
- DB : `\d user_preferences` → `brief_tone` + CHECK.
- Backend `pytest -q` (brief dégradé nominal, journée calme, upsert, anti-spam, RLS, notif pref,
  usage_events) + `ruff`. Redémarrer uvicorn ; endpoints 401 sans cookie.
- Frontend `tsc` + build. Grep anti-camelCase.
- E2E réel : `POST /api/brief/generate` pour l'admin → brief dégradé créé, visible dans la carte
  hero du cockpit ; « Régénérer » remplace ; onboarding étape finale génère un brief.
- Adversarial : régénération rapide → 429 ; journée calme → brief « calme » ; contenu jsonb bien
  structuré ; aucune PII dans les logs.

## Corrections review intégrées (PRIORITAIRES — architect + lead-dev)

Priment sur le texte ci-dessus. Le **design `daily_brief.md` n'est PAS exécutable tel quel**
(`llm.parse(schema=...)`, `response_format`, `LLMError`, `ON CONFLICT ... type='scheduled'` = fiction
SDK / bugs) — suivre le PLAN et le code réel.

1. **Validation du schéma côté appelant (CRITIQUE)** : `mail_triage.llm.complete_json` renvoie un
   **dict brut** (pas de validation Pydantic, pas de param `schema`/`response_format`). Signature
   réelle : `complete_json(*, user_id, agent, model, system, user_prompt, max_tokens=2000) -> dict`.
   Dans `compose.py` : appeler avec `agent="daily_brief"`, puis **valider** `BriefContentModel(**data)` ;
   catcher `(LlmUnavailable, ValidationError, json/anthropic errors)` → **brief dégradé**. NE PAS
   re-tenter dans compose (complete_json fait déjà 1 re-tentative interne).
2. **jsonb + asyncpg** : `briefs.contenu` est jsonb. En ÉCRITURE : `json.dumps(content)` + placeholder
   `$n::jsonb`. En LECTURE : `json.loads(row["contenu"])` (asyncpg renvoie le jsonb en str sans codec).
   Sinon crash à l'insert / string brute au front.
3. **Scheduler brief** : job avec `max_instances=1, coalesce=True` (comme google) ; `brief_scheduler_
   interval_minutes: int = 5` en config ; **timeout par run** (`asyncio.wait_for`, réutiliser une
   valeur type `google_sync_run_timeout` ou nouvelle `brief_run_timeout=45`) ; try/except **par
   utilisateur** (un échec n'arrête pas les autres). Liste des users via `get_admin_pool()` :
   `SELECT user_id, brief_hour, timezone FROM user_preferences WHERE onboarding_completed = true`
   (ne pas générer pour des comptes jamais onboardés). Catch-up idempotent : générer si
   `heure_locale >= brief_hour` ET aucun brief `quotidien` pour la date locale.
4. **Upsert** : `INSERT ... (type='quotidien') ON CONFLICT (user_id, brief_date) WHERE type='quotidien'
   DO UPDATE SET contenu = EXCLUDED.contenu, degraded = EXCLUDED.degraded, generated_at = now()`
   (répéter la clause partielle `WHERE type='quotidien'` de l'index). `manual`/`onboarding` → INSERT
   `type='a_la_demande'` simple.
5. **Cohérence fuseau persist ↔ lecture** : `get_cockpit` calcule `today_local` depuis
   `user_preferences.timezone` (lu dans la MÊME `scoped_connection`) pour le `WHERE brief_date =
   today_local` — pas `settings.app_timezone` global (sinon brief invisible pour un user hors Paris).
6. **Garde-fou anti-hallucination = chemin LLM uniquement** : ordre dans compose = appel LLM →
   garde-fou (priorité citant un élément absent du contexte → remplacée par règle déterministe) →
   validation `BriefContentModel` → sur échec, dégradé. Le brief dégradé (déterministe) N'A PAS besoin
   de garde-fou (rien d'inventé).
7. **Ne pas imbriquer les `scoped_connection`** dans l'orchestrateur (une par step, séquentiel — pas
   de scoped_connection ouverte dans une autre).
8. **Anti-spam manuel** : vérifier le dernier brief `a_la_demande` de la dernière minute (requête,
   robuste au restart). TOCTOU possible (2 appels quasi simultanés) — acceptable à 2 users, noté.
9. **tone** vient de `user_preferences.brief_tone` (lu dans collect/compose), pas de config.py.

## Risques / vigilance
1. **Brief dégradé = chemin nominal** (pas de clé) : robuste et testé comme tel, `degraded=true`
   discret côté UI (pas d'alarme). Ready-for-IA via clé.
2. **Idempotence scheduler** : upsert `quotidien` + catch-up (heure locale ≥ brief_hour ET pas de
   brief du jour) → un double tick ne crée pas de doublon.
3. **Fuseau** : `brief_date` et bornes calculées en timezone utilisateur (`user_preferences.timezone`),
   jamais UTC naïf ni horloge dans l'orchestrateur (date passée par l'appelant/scheduler).
4. **Réutiliser `mail_triage.llm`** (ne pas dupliquer le client). Si couplage gênant, extraire dans
   `services/llm/` — mais réutilisation directe acceptable ce round.
5. **notif brief** : respecter `user_preferences.notif_brief_ready` (comme R006 pour les mails).
6. **PII** : pas de contenu de brief dans les logs (compteurs uniquement).
7. **Casse snake_case** : contrat figé, interfaces TS calquées, grep.
