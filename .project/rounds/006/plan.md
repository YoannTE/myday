# Plan d'exécution — Round 006 « L'IA entre en scène : tri des mails »

## Contexte et décisions structurantes

- **SANS plateforme Core** (décision 2026-07-10, decisions.md) : `mail_triage` est implémenté en
  **service FastAPI normal** (async orchestré), PAS via `@workflow`/`@step`/`@configurable`/DBOS/
  `agent_platform.*`. Le design `.project/agent-designs/mail_triage.md` est la **spécification
  fonctionnelle** (steps, prompts, barème, fallback, tests) à suivre, transposée en Python simple.
- **Règles d'abord, IA plus tard** (choix utilisateur) : AUCUNE clé `ANTHROPIC_API_KEY` configurée.
  Le tri doit fonctionner immédiatement via le **fallback heuristique** (le design le prévoit), et
  être **prêt pour l'IA** : dès qu'une clé est fournie, le scoring LLM + résumés s'activent sans
  retoucher le code. Client LLM à dégradation gracieuse (clé absente → pas d'appel, fallback direct).
- **AUCUNE migration** : le schéma mails a déjà tout (`score`, `raison_score`, `resume_ia`,
  `statut` pending_triage/triaged), `sender_preferences` (`statut` ∈ `important`/`muet` — PAS
  `muted`), `notifications` (`type` `mail_important`, unicité `(user_id, ref_id, type)`), `llm_usage`.
- **Données mail disponibles** (Round 003) : `expediteur`, `sujet`, `extrait` (snippet ≤ 2000).
  PAS de `to_type` (To/Cc) ni de corps complet → adapter le pré-filtre (retirer la règle Cc) et
  utiliser `extrait` comme source des résumés. Ne PAS modifier la sync Gmail.
- **@configurable / dashboard Core** : sans Core, les réglages (seuil, modèles, plafonds) vivent
  dans `config.py` (surchargeables par env), documentés. L'exposition Core est différée (future).
- 24 mails `pending_triage` déjà en base (données de test réelles). RLS via `scoped_connection`.
- **Cloisonnement PII** : contenu des mails jamais dans les logs/events (seulement en BDD + appels LLM).

## Découpage en agents (3 agents, contrat figé)

### Agent BACK-TRIAGE — `fastapi-developer` — moteur de tri (opus)

Fichiers (`backend/app/services/mail_triage/`, ≤150 lignes/fichier) :
- `config.py` (racine backend, MODIFIÉ) : ajouter `anthropic_api_key: str = ""`,
  `triage_llm_model: str = "claude-haiku-4-5"`, `triage_summary_model: str = "claude-sonnet-4-5"`,
  `triage_importance_threshold: int = 60`, `triage_max_llm_mails_per_run: int = 30`,
  `triage_notify_important: bool = True`, `triage_max_push_per_hour: int = 3`.
- `services/mail_triage/llm.py` : client Anthropic à dégradation gracieuse. Si
  `settings.anthropic_api_key` vide → `raise LlmUnavailable` (jamais d'appel réseau). Sinon appel
  Messages API (package `anthropic`, ajouté à requirements) avec `response_format` JSON, parse
  Pydantic strict, 1 re-tentative format renforcé. Enregistre l'usage dans `llm_usage` (agent,
  model, tokens, cost) via scoped_connection.
- `services/mail_triage/prefilter.py` (pur) : règles déterministes adaptées (sans to_type) :
  (1) expéditeur `muet` → score 5, raison « Expéditeur en sourdine » ; (2) expéditeur `important`
  → 85 « Expéditeur marqué important » ; (3) newsletter/no-reply (motifs `no-?reply@`,
  `newsletter@`, `mailer-daemon`, `notifications?@`) → 15 « Newsletter / notification automatique » ;
  (4) sinon → candidat LLM avec signaux `known_sender` (déjà vu / prefs) + `action_keywords`
  (détectés dans sujet+extrait : « merci de », « peux-tu », « urgent », « avant le », « confirme »,
  « réponds », « facture », « paiement », « rendez-vous »).
- `services/mail_triage/scoring.py` : `score_candidates(candidates, ...)`. Si clé LLM absente ou
  échec → **fallback heuristique** : `known_sender → 65`, `action_keywords → 70`, sinon `40`,
  `source="fallback"`, raison « Score automatique (règles) ». Plafond `max_llm_mails_per_run` :
  au-delà, mails laissés `pending_triage` (deferred).
- `services/mail_triage/summaries.py` : `summarize(important, ...)` sur `extrait`. Si clé absente/
  échec → pas de résumé (le mail s'affiche avec l'extrait brut). Tronque à 217+« … » si > 220.
- `services/mail_triage/orchestrator.py` : `async def run_mail_triage(user_id, mail_ids, trigger)`
  → séquence load → prefilter → (si candidats) score → summarize → persist → (si activé)
  notifications. Retourne `{processed, important_count, skipped_prefilter, llm_calls}`.
  Persist : `UPDATE mails SET score, raison_score, resume_ia, statut='triaged', updated_at=now()
  WHERE user_id=$ AND id=ANY(...)` (idempotent, mails déjà en base). Notifications : INSERT
  `notifications` type `mail_important`, ref_id=mail.id, `ON CONFLICT (user_id, ref_id, type) DO
  NOTHING`, plafond `max_push_per_hour` (COUNT dernière heure).
- `api/triage.py` : `POST /api/triage/refresh` (auth) → re-trie les mails `pending_triage` de
  l'utilisateur, retourne le résultat. Router `triage_router` (enregistré par BACK-MAILS).
- **Trigger sync** : dans `backend/app/services/google/sync.py` (ligne ~137, TODO Round 006),
  appeler `run_mail_triage(user_id, gmail_new_ids, "sync")` en best-effort non bloquant après la
  sync Gmail (une exception du tri ne casse jamais la sync). Import local dans la fonction.
- `requirements.txt` : ajouter `anthropic`.
- Tests `backend/tests/test_mail_triage.py` : happy path heuristique (24 mails → prefilter écarte
  newsletters, candidats scorés en fallback, importants ≥ seuil, statut triaged), prefilter (muet
  prioritaire, newsletter, action_keywords), idempotence (re-run → zéro doublon, pas de double
  notification), plafond max_llm_mails, notifications plafonnées, RLS (mail d'un autre user ignoré),
  clé LLM absente → tout en fallback sans appel réseau. **Ne teste PAS d'appel LLM réel** (mock ou
  clé absente).

### Agent BACK-MAILS — `fastapi-developer` — API mails + feedback + cockpit + main.py (opus)

- `models/mails.py`, `services/mails.py`, `api/mails.py`.
- `GET /api/mails?filter=important|tous&statut=` → `{"data": [mail]}` triés score desc puis
  date_reception desc ; `filter=important` = `statut='triaged' AND score >= seuil`. Inclure un
  compteur `ecartes` (triaged avec score < seuil) pour le « X mails écartés ».
- `GET /api/mails/{id}` → `{"data": mail}` (détail : résumé, raison, extrait). Marque `lu=true`.
- `PATCH /api/mails/{id}` `{lu?}` → maj.
- `POST /api/mails/{id}/feedback` `{valeur: "important"|"pas_important"}` → **upsert
  `sender_preferences`** (`important` → statut `important`, `pas_important` → `muet`) sur
  l'`expediteur` du mail, `ON CONFLICT (user_id, email) DO UPDATE`. Alimente le pré-filtre du run
  suivant (boucle de feedback).
- `mail` = `{id, expediteur, sujet, extrait, resume_ia, score, raison_score, statut, lu, repondu,
  date_reception, created_at, updated_at}` (snake_case).
- `services/cockpit.py` (MODIFIÉ) : remplacer `"mails_importants": {"placeholder": True}` par les
  mails importants réels (top ~5 `triaged` score ≥ seuil, tri score desc) : `{"placeholder": false,
  "mails": [...]}`. Garder `placeholder: true` si AUCUN mail trié encore (état transitoire).
- `main.py` (MODIFIÉ) : enregistrer `mails_router` ET `triage_router` (créé par BACK-TRIAGE).
- Tests `backend/tests/test_mails.py` : liste filtrée, détail marque lu, feedback → sender_pref
  upsert (important/muet), RLS cross-user 404, 401 sans cookie, cockpit mails_importants réel.

### Agent FRONT-MAILS — `nextjs-developer` — page mails + section cockpit (opus)

INVOQUE `frontend-design`. Mockups : `.project/mockups/pages/mails.html` (+ png),
`.project/mockups/pages/dashboard.html` (section Mails importants).
- `src/app/mails/page.tsx` (Server `requireUser()` + Navbar + client mails). Liste scorée + mail
  ouvert (résumé IA, raison du score, extrait), filtres (important/tous), « X mails écartés »
  (compteur `ecartes`), boutons « Important / Pas important » (POST feedback → toast + retire/reclasse).
  Bouton « Rafraîchir le tri » (POST /api/triage/refresh). Composants `src/components/mails/`.
- Remplacer `src/components/cockpit/mails-importants-placeholder.tsx` par un vrai composant qui
  affiche les mails importants (données déjà dans l'agrégat `/api/cockpit` → `mails_importants`).
  Garder l'état placeholder « Tes mails importants seront bientôt priorisés ici » UNIQUEMENT si
  `placeholder: true` (aucun mail trié). Le cockpit-client passe déjà `mails_importants` au composant.
- Types snake_case : `src/components/mails/types.ts` (Mail = {id, expediteur, sujet, extrait,
  resume_ia, score, raison_score, statut, lu, repondu, date_reception, ...}).
- **Résumé absent** (pas de clé LLM) : afficher l'extrait brut à la place du résumé, sans mention
  d'erreur (comportement normal du fallback). Le score et la raison (« Score automatique (règles) »)
  s'affichent toujours.
- NE TOUCHE PAS : navbar (déjà les liens ; si « Mails » manque dans la nav, l'ajouter est permis —
  vérifier d'abord), layout, autres pages.

## Contrat API figé (snake_case)

- `GET /api/mails?filter=important|tous` → `{"data": {mails: [mail], ecartes: int}}`
- `GET /api/mails/{id}` → `{"data": mail}` (marque lu)
- `PATCH /api/mails/{id}` `{lu?, repondu?}` → `{"data": mail}`
- `POST /api/mails/{id}/feedback` `{valeur: "important"|"pas_important"}` → `{"data": {statut}}`
- `POST /api/triage/refresh` → `{"data": {processed, important_count, skipped_prefilter, llm_calls}}`
- `GET /api/cockpit` → `mails_importants: {placeholder: bool, mails: [mail]}` (MODIFIÉ)
- `mail` = `{id, expediteur, sujet, extrait, resume_ia, score, raison_score, statut, lu, repondu, date_reception, created_at, updated_at}`

## Coordination / anti-conflits

- `main.py` → BACK-MAILS uniquement (enregistre triage_router + mails_router). BACK-TRIAGE crée
  `api/triage.py` avec `router`. Dépendance d'import vérifiée au boot par le lead.
- `config.py` → BACK-TRIAGE. `sync.py` → BACK-TRIAGE (1 ligne trigger). `services/cockpit.py` →
  BACK-MAILS. Pas de chevauchement.
- FRONT-MAILS code contre le contrat figé pendant que le back l'implémente.

## Tests fin de round

- Backend `pytest -q` (triage heuristique complet, idempotence, RLS, feedback, cockpit) + `ruff`.
  **Redémarrer uvicorn** ; endpoints `/api/mails`, `/api/triage/refresh` 401 sans cookie.
- Frontend `npx tsc --noEmit` (0) + `npm run build`. Grep anti-camelCase.
- End-to-end réel : `POST /api/triage/refresh` sur les 24 mails → vérifier en base que des mails
  passent `triaged` avec score/raison, que les newsletters sont écartées, qu'aucun contenu de mail
  ne fuite dans les logs. Page `/mails` affiche la liste triée, feedback change `sender_preferences`.
- Adversarial : re-run triage → zéro doublon de notification ; feedback « pas important » → mail
  reclassé au run suivant ; clé LLM absente → 0 appel réseau, tout en fallback ; mail d'un autre
  user ignoré.

## Corrections review intégrées (PRIORITAIRES — architect + lead-dev)

Ces corrections priment sur le texte ci-dessus en cas de divergence.

1. **Trigger HORS verrou sync** (arch M1 / lead C1) : NE PAS appeler le tri dans `finalize_sync`
   (qui s'exécute avant `release_sync_lock`). L'appeler dans `run_sync`, APRÈS le retour de
   `finalize_sync` (verrou déjà libéré), en lisant `gmail_result["new_mail_ids"]`, enveloppé
   `try/except` (non bloquant) et en `await` (synchrone, sûr avec `scoped_connection` — PAS
   `create_task`). Risque connu documenté : un refresh manuel concurrent d'un tri-sync est
   idempotent (au pire des appels LLM gaspillés une fois l'IA active) — acceptable à 2 users.
2. **Advisory lock anti-tri-concurrent** (lead C4) : au début de `run_mail_triage`, tenter
   `pg_try_advisory_lock(hashtext('mail_triage:'||user_id))` (session-scoped, sur une connexion
   dédiée gardée le temps du run) ; si non acquis → un tri tourne déjà pour ce user, retour
   immédiat `{processed:0, ...}`. `pg_advisory_unlock` dans un `finally`. Best-effort.
3. **`notifications.contenu` NOT NULL** (arch C1 / lead C7) : l'INSERT notification DOIT poser
   `contenu = resume_ia si présent, sinon sujet du mail`. (PII en BDD, jamais dans les logs.)
4. **Feedback reclasse les mails existants** (arch C2) : `POST /api/mails/{id}/feedback` fait
   l'upsert `sender_preferences` ET ré-applique immédiatement la bande de score aux mails déjà
   `triaged` du même expéditeur (`muet` → score 5 raison « Expéditeur en sourdine » ; `important`
   → 85 raison « Expéditeur marqué important »). Sinon « X écartés » et la liste importante sont
   faux après rechargement.
5. **Normaliser `expediteur` → email** (arch H1 / lead C5) : `mails.expediteur` = From brut
   (« Nom <email> »). Une SEULE fonction de normalisation (extraire `<email>`, minuscule) utilisée
   pour : la clé `sender_preferences`, le lookup du pré-filtre, ET les regex newsletter. À figer
   dans `prefilter.py`, réutilisée par l'endpoint feedback.
6. **Persist par ligne** (lead C3) : `UPDATE mails SET score=v.score, raison_score=v.reason,
   resume_ia=v.summary, statut='triaged', updated_at=now() FROM (VALUES (...), ...) AS
   v(id, score, reason, summary) WHERE mails.id = v.id::uuid AND mails.user_id = $user` (un seul
   round-trip). `WHERE id=ANY(...)` NE convient PAS (valeurs par ligne). Les `deferred` restent
   `pending_triage`.
7. **Source UNIQUE du seuil** (arch M2) : notify (BACK-TRIAGE), `filter=important` et cockpit
   (BACK-MAILS) lisent TOUS `settings.triage_importance_threshold`, jamais le littéral `60`.
8. **Prompts sans `to_type` ni corps** (arch M3) : les prompts transposés retirent `to_type` et
   `body_excerpt` (inexistants) ; source de contenu = `sujet` + `extrait` uniquement. Sinon le
   « prêt-pour-IA » serait faux (l'IA recevrait des champs vides).
9. **Client Anthropic** (arch B2 / lead C2) : `AsyncAnthropic.messages.create(model, max_tokens=...,
   messages=[...])` — PAS de `response_format` (param OpenAI inexistant chez Anthropic). JSON obtenu
   par consigne de prompt + parse Pydantic manuel (1 re-tentative format renforcé). Clé vide →
   NE JAMAIS construire le client → lever `LlmUnavailable` → fallback direct (0 appel réseau).
10. **`llm_usage.cost_usd`** (arch B1) : l'API renvoie les tokens, pas le coût. Enregistrer les
    tokens toujours ; `cost_usd` calculé via une petite table de prix par modèle
    (`{"claude-haiku-4-5": (in, out), ...}`) ou `'0'` si inconnu — jamais une valeur fabriquée.
11. **`sender_preferences.statut = 'muet'`** (lead C6, PAS `muted` du design) ; feedback
    `pas_important` → `muet`, `important` → `important`. Upsert `ON CONFLICT (user_id, email)`
    (index unique existant).
12. **Séquencement `main.py`** (lead C8) : BACK-MAILS enregistre `triage_router` (créé par
    BACK-TRIAGE) + `mails_router` ; boot vérifié à la convergence par le lead.

## Risques / vigilance

1. **Fallback heuristique = chemin nominal ce round** (pas de clé) : il doit être robuste et testé
   comme le chemin principal, pas comme un cas d'erreur secondaire.
2. **PII** : jamais de sujet/expéditeur/contenu dans logs ou events (seulement compteurs + ids).
3. **Idempotence** : persist par `(user_id, gmail_id)` déjà unique ; notifications `ON CONFLICT
   (user_id, ref_id, type) DO NOTHING`. Re-run sûr.
4. **Trigger sync non bloquant** : une exception du tri ne doit jamais casser `google_sync`.
5. **Casse snake_case** : contrat figé, interfaces TS calquées, grep.
6. **sender_preferences.statut = `muet`** (pas `muted`) et **notifications.type = `mail_important`**
   avec unicité `(user_id, ref_id, type)` — respecter les valeurs réelles du schéma.
7. **Prêt-pour-IA** : le client LLM doit s'activer par la seule présence de `ANTHROPIC_API_KEY`,
   sans autre changement de code (documenter dans `.env.local.example`).
