---
kind: agent-platform-design
sdk: agent-platform
runtime: dbos
langgraph: false
workflow: google_sync
status: validated
validated_at: "2026-07-09"
detail_validated_at: "2026-07-09"
---

# Agent Design : google_sync

## 1. Vue d'ensemble

- **Workflow SDK** : `google_sync` (+ 2 sous-workflows : `sync_calendar_branch`, `sync_gmail_branch`)
- **Description Op** : « Synchronise l'agenda et les mails Google de l'utilisateur : récupère les changements, met à jour le cockpit et déclenche le tri des nouveaux mails. »
- **Objectif métier** : la fondation de MyDay — rafraîchir périodiquement Google Agenda et Gmail (sans promesse de temps réel), remonter vers Google les événements créés localement, et déclencher `mail_triage` sur les nouveaux mails. Alimente F3 (dashboard), F4 (planning), F7 (mails).
- **Déclencheur** :
  - **cron** : toutes les ~5 minutes par utilisateur actif ayant une connexion Google valide (scheduler FastAPI, un run par utilisateur) ;
  - **API** : rafraîchissement manuel (bouton du dashboard) ;
  - **API** : première synchronisation en fin d'onboarding (juste après la connexion OAuth).
- **Entrée initiale** : `{ "user_id": str, "trigger": "scheduled" | "manual" | "onboarding" }`
- **Sortie finale** : `{ "calendar": {"created": int, "updated": int, "deleted": int, "pushed": int}, "gmail": {"new_mails": int, "updated": int}, "triage_started": bool, "connection_status": "ok" | "reauth_required" }`
- **Opérateurs humains** : aucun pendant le run. Si le jeton Google est révoqué, l'utilisateur est notifié pour se reconnecter dans l'UI (parcours OAuth — pas un formulaire de correction).
- **Volume / SLA** : ~200-300 runs/jour/utilisateur (toutes les 5 min). Latence cible < 15 s en régime incrémental. Premier sync borné : fenêtre `gmail_lookback_days` pour les mails, `calendar_window_days` pour l'agenda. Aucun appel LLM dans ce workflow.

## 2. Workflow SDK-native

Orchestration Python déterministe. Les branches Agenda et Gmail sont **indépendantes** (pas de dépendance latérale, pas d'état partagé) → fan-out via `parallel()` avec sous-workflows, conformément au pattern SDK (jamais `asyncio.gather` sur des `@step`).

- Décorateur : `@workflow(name="google_sync", version=1, description="Synchronise l'agenda et les mails Google de l'utilisateur : récupère les changements, met à jour le cockpit et déclenche le tri des nouveaux mails.")`
- Fonction : `async def google_sync(payload: dict, *, config: dict | None = None) -> dict`
- Branches conditionnelles : `if` Python —
  - connexion absente/révoquée détectée par `load_connection` → marquer `reauth_required`, notifier (une seule fois), terminer proprement sans erreur ;
  - anti-chevauchement : si un run `google_sync` est déjà en cours pour ce `user_id` (verrou BDD posé par `load_connection`), le run se termine immédiatement (`skipped`) ;
  - si `auto_trigger_triage` et nouveaux mails → lancer `mail_triage` (WorkflowHandle SDK, fire-and-forget) ;
- Parallélisme : `parallel((sync_calendar_branch, user_id), (sync_gmail_branch, user_id))` — chaque branche est un `@workflow` avec sa propre description Op (visible comme branche dans la vue Op). Une exception dans une branche est propagée par `parallel()` et catchée : l'échec d'une branche n'empêche pas l'autre d'aboutir (résultats partiels enregistrés).
- Persistance/reprise : DBOS — les sous-workflows `COMPLETED` sont skippés au replay.

Séquence :

```
load_connection ──► [verrou ok, jeton valide]
        parallel(
          sync_calendar_branch :  fetch_calendar_changes → apply_calendar_changes → push_local_events
          sync_gmail_branch   :  fetch_gmail_changes → store_new_mails
        )
──► finalize_sync (agrégats, last_sync_at, libération du verrou, déclenche mail_triage si nouveaux mails)
```

## 3. Steps

| Step SDK | Type | Responsabilité | Input | Output | Retry/timeout | Inputs corrigeables / safe_step | Observabilité |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `load_connection` | db | Charger la connexion Google (jetons chiffrés via service interne, curseurs `syncToken`/`historyId`), rafraîchir le jeton d'accès si expiré, poser le verrou anti-chevauchement | `input.user_id` | `state.connection` | 3 essais, 15 s | Aucun input métier corrigeable | « Connexion Google vérifiée » / « Reconnexion Google nécessaire » / « Synchronisation déjà en cours, run ignoré » |
| `sync_calendar_branch` | sub_workflow | Branche agenda — `@workflow(description="Synchronise le calendrier Google de l'utilisateur.")` | `user_id` | `state.calendar_result` | — (steps internes) | — | branche visible dans la vue Op |
| ├─ `fetch_calendar_changes` | tool | `events.list` incrémental via `syncToken` ; premier sync ou token expiré (HTTP 410) → resync complet borné à `calendar_window_days` | `state.connection` | `state.cal_changes`, nouveau `syncToken` | 3 essais, 30 s | Aucun input métier corrigeable | « {n} changements d'agenda récupérés » / « Resynchronisation complète de l'agenda » |
| ├─ `apply_calendar_changes` | db | Appliquer les changements : upsert par `(userId, googleId)`, suppressions (status `cancelled`), **Google source de vérité** en cas de conflit avec une édition locale | `state.cal_changes` | compteurs created/updated/deleted | 3 essais, 15 s | Aucun input métier corrigeable | « Agenda mis à jour : {c} créés, {u} modifiés, {d} supprimés » |
| └─ `push_local_events` | tool | Remonter vers Google les événements MyDay en `sync_pending` (créés hors ligne ou dont la remontée par l'assistant a échoué), id client idempotent | BDD (`sync_pending`) | compteur pushed | 3 essais, 30 s | Aucun input métier corrigeable | « {p} événements locaux remontés vers Google » / « Aucun événement local à remonter » |
| `sync_gmail_branch` | sub_workflow | Branche mails — `@workflow(description="Synchronise les mails Gmail de l'utilisateur.")` | `user_id` | `state.gmail_result` | — (steps internes) | — | branche visible dans la vue Op |
| ├─ `fetch_gmail_changes` | tool | `history.list` incrémental via `historyId` ; premier sync ou historyId expiré (404) → resync borné à `gmail_lookback_days`, plafonné à `max_mails_per_sync` | `state.connection` | `state.gmail_changes`, nouveau `historyId` | 3 essais, 30 s | Aucun input métier corrigeable | « {n} changements de mails récupérés » / « Resynchronisation de la boîte mail » |
| └─ `store_new_mails` | db | Insérer les nouveaux mails (métadonnées + extrait borné) en statut `pending_triage`, dédupliqués par `(userId, gmailId)` ; mettre à jour lu/répondu/supprimé ; confirmer les envois `sending_unconfirmed` de l'assistant (présence dans Sent) | `state.gmail_changes` | `state.new_mail_ids`, compteurs | 3 essais, 15 s | Aucun input métier corrigeable | « {n} nouveaux mails enregistrés, {u} statuts mis à jour » |
| `finalize_sync` | db | Agréger les résultats des branches (y compris partiels), mettre à jour `last_sync_at`, libérer le verrou, déclencher `mail_triage` si `new_mail_ids` non vide et `auto_trigger_triage` | résultats des branches | `result` final | 3 essais, 10 s | Aucun input métier corrigeable | « Synchronisation terminée » / « Synchronisation partielle : {branche} en échec » |

Parallélisables : les 2 sous-workflows (via `parallel()`, ~30-80 ms d'overhead par branche — négligeable, 2 branches).

## 4. State et contrats de données

```python
from typing import NotRequired, TypedDict

class GoogleSyncInput(TypedDict):
    user_id: str          # UUID utilisateur MyDay
    trigger: str          # "scheduled" | "manual" | "onboarding"

class ConnectionState(TypedDict):
    status: str           # "ok" | "reauth_required" | "locked"
    calendar_sync_token: NotRequired[str]
    gmail_history_id: NotRequired[str]
    # les jetons OAuth ne transitent JAMAIS par le state : lus par les steps via le service interne

class CalendarBranchResult(TypedDict):
    created: int
    updated: int
    deleted: int
    pushed: int
    resync: bool          # true si resynchronisation complète (410)

class GmailBranchResult(TypedDict):
    new_mails: int
    updated: int
    new_mail_ids: list[str]   # ids internes BDD, passés à mail_triage
    resync: bool

class GoogleSyncResult(TypedDict):
    calendar: CalendarBranchResult
    gmail: GmailBranchResult
    triage_started: bool
    connection_status: str
```

Invariants :

- `user_id` obligatoire partout, requêtes scopées `user_id` (cloisonnement strict).
- **Les jetons OAuth ne sont jamais dans le state DBOS ni les logs** : chaque step qui appelle Google les lit au moment de l'appel via le service interne de connexions (chiffrement enveloppe, décision revue).
- Idempotency keys : `(userId, googleId)` pour les événements (contrainte d'unicité BDD), `(userId, gmailId)` pour les mails, id client dérivé pour les événements poussés.
- Curseurs (`syncToken`, `historyId`) écrits en BDD de façon transactionnelle AVEC les données correspondantes — jamais de curseur avancé sans données appliquées (sinon trous de sync).
- Verrou anti-chevauchement par `user_id` (colonne `sync_locked_until` avec expiration 2 min) — deux runs simultanés ne s'écrasent jamais.
- MyDay ne supprime JAMAIS rien côté Gmail (lecture seule sur la boîte) ; côté agenda, seule la remontée d'événements créés dans MyDay écrit chez Google.

## 5. Config SDK

| Clé | Type SDK | Défaut | Scope | Description | Secret |
| --- | --- | --- | --- | --- | --- |
| `gmail_lookback_days` | `IntRange(1, 30)` | `7` | branche gmail | Fenêtre de mails au premier sync ou resync | non |
| `calendar_window_days` | `IntRange(7, 90)` | `60` | branche agenda | Fenêtre d'événements (passé 7 j + futur N j) au sync complet | non |
| `max_mails_per_sync` | `IntRange(10, 200)` | `50` | branche gmail | Plafond de nouveaux mails traités par run (le reste au run suivant) | non |
| `auto_trigger_triage` | `Toggle` | `true` | workflow | Déclencher automatiquement le tri IA des nouveaux mails | non |
| `push_local_events` | `Toggle` | `true` | branche agenda | Remonter vers Google les événements créés dans MyDay | non |

```python
from agent_platform import IntRange, Toggle, configurable, workflow

@configurable({
    "gmail_lookback_days": IntRange(1, 30, default=7, label="Fenêtre du premier sync mails (jours)"),
    "calendar_window_days": IntRange(7, 90, default=60, label="Fenêtre agenda (jours à venir)"),
    "max_mails_per_sync": IntRange(10, 200, default=50, label="Mails max par synchronisation"),
    "auto_trigger_triage": Toggle(default=True, label="Déclencher le tri IA automatiquement"),
    "push_local_events": Toggle(default=True, label="Remonter les événements locaux vers Google"),
})
@workflow(name="google_sync", version=1, description="Synchronise l'agenda et les mails Google de l'utilisateur : récupère les changements, met à jour le cockpit et déclenche le tri des nouveaux mails.")
async def google_sync(payload: dict, *, config: dict | None = None) -> dict:
    ...
```

(La fréquence du cron — toutes les 5 min — est portée par le scheduler FastAPI, pas par la config du workflow.)

## 6. HITL

Aucun HITL requis — synchronisation technique de fond, sans décision humaine dans le run. Le cas « jeton révoqué » se résout par le parcours de reconnexion OAuth dans l'UI (notification + bouton « Reconnecter mon compte Google »), pas par un pending input.

Aucun `@safe_step` requis - aucun input métier corrigeable : tous les inputs sont des identifiants internes, des curseurs de synchronisation ou des données Google immuables. Un échec se rejoue au run suivant (cadence 5 min) — c'est le mécanisme de reprise naturel de ce workflow.

## 7. Observability

- **Auto SDK** : `workflow.started/completed/failed`, durée, `workflow_id` pour le parent ET chaque branche `parallel()` (visibles comme branches dans la vue Op grâce à leur `description`).
- **Description Op du workflow parent** : « Synchronise l'agenda et les mails Google de l'utilisateur : récupère les changements, met à jour le cockpit et déclenche le tri des nouveaux mails. »
- **Descriptions Op des sous-workflows** : « Synchronise le calendrier Google de l'utilisateur. » / « Synchronise les mails Gmail de l'utilisateur. »
- **Summaries Op obligatoires** (chemins d'erreur et cas vides inclus) :
  - `load_connection` : « Connexion Google vérifiée » / « Reconnexion Google nécessaire » / « Synchronisation déjà en cours, run ignoré »
  - `fetch_calendar_changes` : « {n} changements d'agenda récupérés » / « Resynchronisation complète de l'agenda »
  - `apply_calendar_changes` : « Agenda mis à jour : {c} créés, {u} modifiés, {d} supprimés »
  - `push_local_events` : « {p} événements locaux remontés vers Google » / « Aucun événement local à remonter »
  - `fetch_gmail_changes` : « {n} changements de mails récupérés » / « Resynchronisation de la boîte mail »
  - `store_new_mails` : « {n} nouveaux mails enregistrés, {u} statuts mis à jour »
  - `finalize_sync` : « Synchronisation terminée » / « Synchronisation partielle : {branche} en échec »
- **Événements métier** :
  - `google_sync.completed` `{ user_id, trigger, calendar: {...}, gmail: {...}, partial, duration_ms }` — fréquent (288/jour/utilisateur) mais léger ; base du calcul de fraîcheur affiché dans l'UI
  - `google_sync.reauth_required` `{ user_id }` — émis UNE fois par transition (pas à chaque run), déclenche la notification de reconnexion
- **Logs structurés** : `workflow_id`, `user_id`, `trigger`, compteurs par branche, `resync`, `quota_delays` — jamais de contenu de mail/événement ni de jeton.
- **Métriques** : latence par branche, taux de resync (santé des curseurs), taux d'échec par branche, mails/événements par run, 429 Google.
- **Corrélation** : `user_id`, `workflow_id` (parent + branches), `triage_workflow_id` si déclenché.

## 8. Recovery, retries et idempotence

| Risque | Détection | Retry | Idempotence | Compensation | Escalade |
| --- | --- | --- | --- | --- | --- |
| Crash en plein run | Reprise DBOS | branches `COMPLETED` skippées au replay | upserts `(userId, googleId)` / `(userId, gmailId)` | verrou expirant (2 min) — jamais bloqué définitivement | — |
| `syncToken` expiré (410) | réponse Google | — | resync complet borné `calendar_window_days`, upserts idempotents | curseur remplacé transactionnellement | métrique resync |
| `historyId` expiré (404) | réponse Google | — | resync borné `gmail_lookback_days` + `max_mails_per_sync` | idem | idem |
| Jeton d'accès expiré | 401 | refresh automatique dans `load_connection` puis 1 re-tentative | — | — | — |
| Refresh token révoqué | échec du refresh | pas de retry | — | statut `reauth_required`, notification UNE fois, runs suivants court-circuités sans erreur | notification utilisateur |
| Quota Google (429) | réponse API | retry backoff exponentiel (3x) | — | run suivant (5 min) reprend naturellement | métrique 429 |
| Une branche échoue, l'autre réussit | exception propagée par `parallel()`, catchée | — | — | résultats partiels enregistrés, `partial=true`, curseur de la branche en échec NON avancé | summary « Synchronisation partielle » |
| Deux runs simultanés | verrou `user_id` | — | second run `skipped` immédiatement | — | — |
| Conflit local/Google sur un événement | comparaison à l'apply | — | **Google source de vérité** (décision revue) : la version Google écrase la locale | l'édition locale perdue est journalisée (log) | — |
| Curseur avancé sans données | — | — | curseur + données dans la MÊME transaction | impossible par construction | — |
| Core/observability indisponible | échec émission | best effort | — | le run continue | — |

Timeouts : 15 s BDD/connexion, 30 s appels Google. Aucun appel LLM.

## 9. Sécurité et limites

- **Secrets requis** : `DATABASE_URL` ; clé de chiffrement des jetons (`TOKEN_ENCRYPTION_KEY`, hors BDD — décision revue) lue par le service interne de connexions. Les jetons ne transitent jamais par le state DBOS, les events ni les logs.
- **Données personnelles** : métadonnées et extraits de mails/événements = PII — BDD uniquement, purge à la suppression du compte (avec révocation de l'accès Google).
- **Validation des inputs** : `user_id` UUID valide et actif ; `trigger` ∈ {scheduled, manual, onboarding} ; garde-fou endpoint manuel : max 1 rafraîchissement/30 s/utilisateur.
- **Permissions opérateur HITL** : sans objet.
- **Rate limits externes** : quotas Google Calendar + Gmail — sync incrémentale = quelques requêtes/run ; backoff sur 429 ; le plafond `max_mails_per_sync` borne les resyncs. Scopes restreints Gmail : contrainte de vérification Google documentée dans `decisions.md` (chemin critique avant ouverture publique).

## 10. Plan d'implémentation

- **Fichiers workflow** : `backend/agents/google_sync.py` (parent + orchestration), `backend/agents/sync_calendar_branch.py`, `backend/agents/sync_gmail_branch.py` (un workflow par fichier, ~150 lignes max chacun)
- **Tests** : `backend/tests/agents/test_google_sync.py` (+ un fichier par branche)
  - happy path incrémental : changements agenda + nouveaux mails → upserts, curseurs avancés, `mail_triage` déclenché
  - premier sync (onboarding) : fenêtres bornées, `max_mails_per_sync` respecté
  - `syncToken` 410 / `historyId` 404 → resync borné, aucun doublon
  - conflit local/Google → Google gagne, édition locale journalisée
  - branche gmail en échec → branche agenda aboutit, `partial=true`, curseur gmail non avancé
  - jeton révoqué → `reauth_required`, notification unique, pas d'échec de workflow
  - verrou : deux runs simultanés → second `skipped`
  - replay après crash → aucun doublon, branches complétées skippées
  - confirmation d'un envoi `sending_unconfirmed` de l'assistant (mail trouvé dans Sent)
- **Tests error_recovery / retry_with_input** : sans objet (aucun `@safe_step` — documenté section 6)
- **Fixtures/mocks** : `workflow_runner`, mock API Google Calendar + Gmail (réponses incrémentales, 410/404, 429), fixtures connexion/jetons
- **Endpoints/API à connecter** :
  - scheduler FastAPI : boucle cron ~5 min → un run par utilisateur actif à connexion valide ;
  - `POST /api/sync/refresh` (rafraîchissement manuel, auth, anti-spam 1/30 s) ;
  - appel en fin d'onboarding (`trigger="onboarding"`), suivi de `daily_brief(trigger="onboarding")` une fois le sync terminé ;
  - déclenchement de `mail_triage` via WorkflowHandle SDK dans `finalize_sync`.
- **Critères d'acceptation** :
  - re-run ou replay = zéro doublon (événements ET mails) — vérifié par test d'idempotence
  - jamais de curseur avancé sans données appliquées (transaction commune)
  - une branche en panne n'empêche jamais l'autre de synchroniser
  - l'UI peut afficher la fraîcheur (« à jour il y a 3 min ») depuis `last_sync_at`
  - la vue Op montre le parent et les 2 branches avec leurs descriptions en français

## 11. Détail par step

### `load_connection`

**Type SDK** : `@step` db
**Fonction cible** : `async def load_connection(user_id: str) -> ConnectionState`
**Responsabilité** : vérifier et préparer la connexion Google : (1) poser le verrou anti-chevauchement (`UPDATE ... SET sync_locked_until = now() + interval '2 minutes' WHERE user_id = $1 AND (sync_locked_until IS NULL OR sync_locked_until < now())` — 0 row = run déjà en cours → `status="locked"`) ; (2) charger l'état de connexion et les curseurs `syncToken`/`historyId` ; (3) si le jeton d'accès est expiré, le rafraîchir via le service interne de connexions ; (4) si le refresh échoue (révoqué) → `status="reauth_required"` + notification de reconnexion émise UNE seule fois (flag `reauth_notified` en BDD).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID, utilisateur actif avec connexion Google enregistrée |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.connection` | workflow state | `ConnectionState` | `{"status": "ok", "calendar_sync_token": "CPDA...", "gmail_history_id": "412872"}` | branche `if` du workflow, `fetch_calendar_changes`, `fetch_gmail_changes` |

Les jetons OAuth ne figurent PAS dans la sortie : les steps qui appellent Google les relisent au moment de l'appel via le service interne.

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="load_connection", retry_max_attempts=3, timeout_seconds=15)
async def load_connection(user_id: str) -> dict:
    locked = await acquire_sync_lock(user_id)      # UPDATE conditionnel, expiration 2 min
    if not locked:
        events.set_step_summary("Synchronisation déjà en cours, run ignoré")
        return {"status": "locked"}
    conn = await load_google_connection(user_id)    # curseurs + état
    if conn.needs_refresh:
        ok = await refresh_access_token(user_id)    # service interne de connexions
        if not ok:
            await mark_reauth_required(user_id)     # + notification si première fois
            events.set_step_summary("Reconnexion Google nécessaire")
            return {"status": "reauth_required"}
    events.set_step_summary("Connexion Google vérifiée")
    return {"status": "ok", "calendar_sync_token": conn.sync_token, "gmail_history_id": conn.history_id}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- APIs : Postgres + endpoint OAuth Google (`token`) via le service interne de connexions
- Secrets : `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY` (service connexions), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (refresh)
- Idempotency key : verrou `sync_locked_until` (UPDATE conditionnel atomique)
- Rate limit : endpoint token Google (négligeable — 1 refresh/heure max par utilisateur)
- Compensation : le verrou expire seul en 2 min — jamais de blocage définitif

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (le cas « jeton révoqué » se résout par le parcours OAuth de reconnexion dans l'UI, pas par un formulaire de correction)

#### Observability

- Summary Op : « Connexion Google vérifiée » / « Reconnexion Google nécessaire » / « Synchronisation déjà en cours, run ignoré »
- Events métier : `google_sync.reauth_required` `{ user_id }` — émis uniquement à la transition (flag `reauth_notified`)
- Logs structurés : `workflow_id`, `user_id`, `status`, `token_refreshed`
- Métriques : taux de refresh, taux de `reauth_required`, taux de `locked`
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | run suivant dans 5 min | `workflow.failed` auto |
| Refresh token révoqué | déconnexion Google | pas de retry | `reauth_required`, notification unique, runs suivants court-circuités | notification utilisateur |
| Endpoint token Google en panne | 5xx | retry 3x backoff | run suivant dans 5 min | métrique |
| Verrou orphelin (crash d'un run précédent) | expiration 2 min | acquisition normale après expiration | — | — |

#### Tests requis

- Cas nominal : verrou posé, curseurs chargés, `status="ok"`
- Jeton expiré → refresh réussi → `ok`
- Refresh échoué → `reauth_required`, notification émise UNE fois (pas au 2e run)
- Deux acquisitions simultanées → une seule passe, l'autre `locked`
- Verrou expiré d'un ancien crash → acquisition réussie

---

### `sync_calendar_branch` (sous-workflow)

**Type SDK** : sous-workflow — `@workflow(name="sync_calendar_branch", version=1, description="Synchronise le calendrier Google de l'utilisateur.")`
**Fonction cible** : `async def sync_calendar_branch(user_id: str) -> CalendarBranchResult`
**Responsabilité** : orchestrer la branche agenda : `fetch_calendar_changes → apply_calendar_changes → push_local_events` (ce dernier seulement si `push_local_events=true` en config). Lancé par le parent via `parallel()` — apparaît comme branche dans la vue Op grâce à sa description. Retourne les compteurs agrégés de la branche. Pas de logique propre au-delà du chaînage : les contrats sont portés par ses steps ci-dessous.

---

### `fetch_calendar_changes`

**Type SDK** : `@step` tool
**Fonction cible** : `async def fetch_calendar_changes(user_id: str, sync_token: str | None, window_days: int) -> dict`
**Responsabilité** : appeler Google Calendar `events.list` en mode incrémental (`syncToken`) avec pagination complète (`nextPageToken`). Si `sync_token` est absent (premier sync) ou expiré (HTTP 410 GONE) : listing complet borné (`timeMin` = aujourd'hui − 7 j, `timeMax` = aujourd'hui + `window_days`). Retourne les changements bruts + le nouveau `nextSyncToken` — SANS l'écrire (c'est `apply_calendar_changes` qui l'écrit transactionnellement avec les données).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload branche | `str` | oui | UUID |
| `state.connection.calendar_sync_token` | `load_connection` | `str \| None` | non | absent = sync complet |
| `config.calendar_window_days` | config SDK | `int` | non (défaut 60) | 7-90 |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.cal_changes` | state branche | `dict` | `{"items": [{"id": "gid1", "status": "confirmed", "summary": "Padel", ...}], "next_sync_token": "CPDA...", "resync": false}` | `apply_calendar_changes` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="fetch_calendar_changes", retry_max_attempts=3, timeout_seconds=30)
async def fetch_calendar_changes(user_id: str, sync_token: str | None, window_days: int) -> dict:
    import httpx  # httpx autorisé dans @step
    # jeton lu via le service interne au moment de l'appel
    # boucle de pagination ; si 410 GONE : repartir en listing complet borné, resync=True
    ...
    if resync:
        events.set_step_summary("Resynchronisation complète de l'agenda")
    else:
        events.set_step_summary(f"{len(items)} changements d'agenda récupérés")
    return {"items": items, "next_sync_token": next_token, "resync": resync}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Google Calendar `events.list` (lecture seule)
- Secrets : jeton OAuth via service interne (jamais dans le state)
- Idempotency key : lecture pure — rejouable sans effet
- Rate limit : quota Calendar ; 429 → retry backoff (3x) ; sync incrémentale = 1-2 requêtes/run
- Compensation : aucune (lecture)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « {n} changements d'agenda récupérés » / « Resynchronisation complète de l'agenda »
- Logs : `workflow_id`, `user_id`, `items_count`, `pages`, `resync` ; métriques : taux de resync (santé des curseurs), latence, 429 ; corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| 410 GONE | syncToken expiré | pas une erreur : resync borné dans le même step | fenêtre `window_days` | métrique resync |
| 401 | jeton invalidé entre load et fetch | 1 refresh + re-tentative, sinon échec de branche | curseur NON avancé, run suivant | log |
| 429 / 5xx | quota ou panne | retry 3x backoff puis échec de branche | `partial=true` au parent, run suivant reprend | métrique |
| Réponse tronquée/pagination interrompue | réseau | l'échec relance le step entier (lecture idempotente) | — | — |

#### Tests requis

- Incrémental nominal (mock avec pagination 2 pages)
- 410 → resync borné, `resync=true`
- Premier sync (token absent) → listing borné 7 j passés + `window_days` futurs
- 429 → backoff puis succès
- Échec définitif → branche en échec, curseur intact

---

### `apply_calendar_changes`

**Type SDK** : `@step` db
**Fonction cible** : `async def apply_calendar_changes(user_id: str, cal_changes: dict) -> dict`
**Responsabilité** : appliquer les changements en UNE transaction : upsert par `(user_id, google_event_id)` (créations/modifications, **Google écrase toujours la version locale** — décision revue, l'édition locale perdue est journalisée), suppression des événements `status="cancelled"`, et écriture du `next_sync_token` DANS LA MÊME transaction (invariant : jamais de curseur avancé sans données appliquées).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload branche | `str` | oui | UUID |
| `state.cal_changes` | `fetch_calendar_changes` | `dict` | oui | `items` peut être vide (curseur avancé quand même) |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.apply_result` | state branche | `dict` | `{"created": 2, "updated": 1, "deleted": 0, "conflicts_overwritten": 0}` | résultat de branche → `finalize_sync` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="apply_calendar_changes", retry_max_attempts=3, timeout_seconds=15)
async def apply_calendar_changes(user_id: str, cal_changes: dict) -> dict:
    # UNE transaction : upserts (userId, googleId) + DELETE cancelled + UPDATE curseur
    ...
    events.set_step_summary(f"Agenda mis à jour : {c} créés, {u} modifiés, {d} supprimés")
    return {"created": c, "updated": u, "deleted": d, "conflicts_overwritten": k}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres uniquement ; Secrets : `DATABASE_URL`
- Idempotency key : contrainte d'unicité `(user_id, google_event_id)` + upserts — transaction rejouable
- Rate limit : aucun
- Compensation : transaction atomique — échec = rien d'appliqué, curseur intact

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Agenda mis à jour : {c} créés, {u} modifiés, {d} supprimés »
- Logs : `workflow_id`, `user_id`, compteurs + `conflicts_overwritten` (éditions locales écrasées, journalisées avec l'id événement)
- Métriques : volume par run, conflits ; corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis échec de branche | curseur intact, run suivant refait le fetch | `partial=true` |
| Conflit local/Google | édition des deux côtés | Google gagne, version locale journalisée | — | log `conflicts_overwritten` |
| Replay | crash | transaction + upserts | zéro doublon | — |

#### Tests requis

- Créations/modifications/suppressions mélangées ; conflit local → Google gagne + journal ; `items=[]` → curseur avancé quand même ; échec transactionnel → curseur intact ; replay → zéro doublon

---

### `push_local_events`

**Type SDK** : `@step` tool
**Fonction cible** : `async def push_local_events(user_id: str) -> dict`
**Responsabilité** : remonter vers Google les événements MyDay en statut `sync_pending` (créés pendant une panne Google ou dont la remontée par l'assistant a échoué — filet de sécurité du `@safe_step create_event`). Insertion Google avec id client dérivé de la clé de l'événement (idempotent), puis row locale passée en `synced` avec le `google_event_id`. Lot borné à 10 par run.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload branche | `str` | oui | UUID |
| BDD | événements `sync_pending` | — | — | lot de 10 max, plus anciens d'abord |
| `config.push_local_events` | config SDK | `bool` | non (défaut `true`) | si `false` → step sauté par la branche |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.pushed` | state branche | `dict` | `{"pushed": 2, "failed": 0}` | résultat de branche → `finalize_sync` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="push_local_events", retry_max_attempts=3, timeout_seconds=30)
async def push_local_events(user_id: str) -> dict:
    import httpx  # httpx autorisé dans @step
    # SELECT sync_pending LIMIT 10 → POST events.insert (id client) → UPDATE synced
    ...
    if pushed:
        events.set_step_summary(f"{pushed} événements locaux remontés vers Google")
    else:
        events.set_step_summary("Aucun événement local à remonter")
    return {"pushed": pushed, "failed": failed}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- APIs : Postgres + Google Calendar `events.insert`
- Secrets : jeton OAuth via service interne ; `DATABASE_URL`
- Idempotency key : id client Google dérivé de la clé d'événement — un événement déjà inséré (409/duplicate) est réconcilié (récupération du `google_event_id` existant) au lieu d'échouer
- Rate limit : ≤ 10 insertions/run ; 429 → backoff
- Compensation : un échec individuel laisse l'événement en `sync_pending` (nouvel essai au run suivant) sans bloquer le reste du lot

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (la correction des données d'un événement refusé appartient au `@safe_step create_event` de l'assistant ; ici c'est un rattrapage technique en boucle de fond)

#### Observability

- Summary Op : « {p} événements locaux remontés vers Google » / « Aucun événement local à remonter »
- Logs : `workflow_id`, `user_id`, `pushed`, `failed`, `reconciled` ; métriques : taille de la file `sync_pending` (backlog anormal = signal d'alerte) ; corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| Insertion refusée (4xx données) | événement invalide | pas de retry aveugle : marqué `sync_error` + visible dans l'UI planning (badge « non synchronisé ») | l'utilisateur corrige l'événement dans l'UI | log |
| 409 duplicate | replay/id client déjà connu | réconciliation (lecture de l'existant) | zéro doublon | — |
| 429 / 5xx | quota/panne | retry 3x puis reste `sync_pending` | run suivant | métrique backlog |

#### Tests requis

- Remontée nominale de 2 événements ; 409 → réconcilié sans doublon ; 4xx → `sync_error`, lot non bloqué ; file vide → summary dédié ; replay → zéro doublon

---

### `sync_gmail_branch` (sous-workflow)

**Type SDK** : sous-workflow — `@workflow(name="sync_gmail_branch", version=1, description="Synchronise les mails Gmail de l'utilisateur.")`
**Fonction cible** : `async def sync_gmail_branch(user_id: str) -> GmailBranchResult`
**Responsabilité** : orchestrer la branche mails : `fetch_gmail_changes → store_new_mails`. Lancé par le parent via `parallel()`. Retourne compteurs + `new_mail_ids` pour le déclenchement du tri.

---

### `fetch_gmail_changes`

**Type SDK** : `@step` tool
**Fonction cible** : `async def fetch_gmail_changes(user_id: str, history_id: str | None, lookback_days: int, max_mails: int) -> dict`
**Responsabilité** : appeler Gmail `history.list` en incrémental (`startHistoryId`) pour obtenir les messages ajoutés/modifiés/supprimés, puis `messages.get` (format metadata + snippet) pour les nouveaux, plafonné à `max_mails`. Si `history_id` absent (premier sync) ou expiré (HTTP 404) : `messages.list` borné à `newer_than:{lookback_days}d`, plafonné pareil. Retourne changements bruts + nouveau `historyId` — sans l'écrire (transaction dans `store_new_mails`).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload branche | `str` | oui | UUID |
| `state.connection.gmail_history_id` | `load_connection` | `str \| None` | non | absent = sync fenêtré |
| `config.gmail_lookback_days` | config SDK | `int` | non (défaut 7) | 1-30 |
| `config.max_mails_per_sync` | config SDK | `int` | non (défaut 50) | 10-200 |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.gmail_changes` | state branche | `dict` | `{"new_messages": [{"gmail_id": "...", "from": "...", "subject": "...", "snippet": "...", "internal_date": "..."}], "status_updates": [{"gmail_id": "...", "read": true}], "next_history_id": "412990", "resync": false, "truncated": false}` | `store_new_mails` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="fetch_gmail_changes", retry_max_attempts=3, timeout_seconds=30)
async def fetch_gmail_changes(user_id: str, history_id: str | None, lookback_days: int, max_mails: int) -> dict:
    import httpx  # httpx autorisé dans @step
    # history.list paginé ; 404 → messages.list newer_than:{lookback_days}d ; messages.get par lot
    ...
    if resync:
        events.set_step_summary("Resynchronisation de la boîte mail")
    else:
        events.set_step_summary(f"{len(new_messages) + len(status_updates)} changements de mails récupérés")
    return {"new_messages": new_messages, "status_updates": status_updates,
            "next_history_id": next_hid, "resync": resync, "truncated": truncated}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- APIs : Gmail `history.list`, `messages.list`, `messages.get` (lecture seule — JAMAIS de suppression/modification côté Gmail)
- Secrets : jeton OAuth via service interne
- Idempotency key : lecture pure
- Rate limit : quota Gmail (unités par méthode) ; `messages.get` par lot borné `max_mails` ; 429 → backoff
- Compensation : aucune (lecture)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « {n} changements de mails récupérés » / « Resynchronisation de la boîte mail »
- Logs : `workflow_id`, `user_id`, `new_count`, `updates_count`, `resync`, `truncated` — jamais d'objet/expéditeur ; métriques : taux de resync, latence, unités de quota consommées ; corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| 404 historyId | curseur trop ancien | resync fenêtré dans le même step | `lookback_days` + plafond | métrique resync |
| 401 | jeton invalidé | 1 refresh + re-tentative, sinon échec de branche | curseur intact | log |
| 429 / 5xx | quota/panne | retry 3x backoff puis échec de branche | `partial=true`, run suivant | métrique |
| Volume énorme (resync) | grosse boîte | plafond `max_mails` + `truncated=true` | le reste au run suivant (curseur avancé prudemment : voir `store_new_mails`) | log |

#### Tests requis

- Incrémental nominal ; 404 → resync fenêtré ; premier sync borné ; plafond 50 dépassé → `truncated=true` ; 429 → backoff

---

### `store_new_mails`

**Type SDK** : `@step` db
**Fonction cible** : `async def store_new_mails(user_id: str, gmail_changes: dict) -> dict`
**Responsabilité** : en UNE transaction : (1) insérer les nouveaux mails (métadonnées + extrait ≤ 2000 caractères) en statut `pending_triage`, dédupliqués par `(user_id, gmail_id)` ; (2) appliquer les mises à jour de statut (lu, répondu, supprimé côté Gmail → marqué `archived_remote` localement, jamais re-suppression côté Google) ; (3) confirmer les envois `sending_unconfirmed` de l'assistant (message retrouvé dans les changements du label SENT → statut `sent`) ; (4) écrire le `next_history_id` — SAUF si `truncated=true` (curseur inchangé pour reprendre le reste au run suivant, quitte à relire des messages déjà dédupliqués).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload branche | `str` | oui | UUID |
| `state.gmail_changes` | `fetch_gmail_changes` | `dict` | oui | listes éventuellement vides |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.gmail_result` | state branche → parent | `GmailBranchResult` | `{"new_mails": 4, "updated": 2, "new_mail_ids": ["m1", "m2", "m3", "m4"], "resync": false}` | `finalize_sync` (déclenchement `mail_triage`) |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="store_new_mails", retry_max_attempts=3, timeout_seconds=15)
async def store_new_mails(user_id: str, gmail_changes: dict) -> dict:
    # UNE transaction : INSERT ON CONFLICT (user_id, gmail_id) DO NOTHING + updates statuts
    # + confirmation sending_unconfirmed + UPDATE historyId (sauf truncated)
    ...
    events.set_step_summary(f"{new_count} nouveaux mails enregistrés, {upd_count} statuts mis à jour")
    return {"new_mails": new_count, "updated": upd_count, "new_mail_ids": new_ids, "resync": gmail_changes["resync"]}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres uniquement ; Secrets : `DATABASE_URL`
- Idempotency key : `(user_id, gmail_id)` — les relectures dues à un curseur non avancé (`truncated`) sont neutralisées par le `ON CONFLICT DO NOTHING`
- Rate limit : aucun
- Compensation : transaction atomique — échec = rien d'écrit, curseur intact

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « {n} nouveaux mails enregistrés, {u} statuts mis à jour »
- Logs : `workflow_id`, `user_id`, `new_count`, `upd_count`, `confirmed_sends`, `cursor_advanced` ; métriques : volume par run ; corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis échec de branche | curseur intact, run suivant | `partial=true` |
| Replay | crash | transaction + `ON CONFLICT DO NOTHING` | zéro doublon | — |
| `truncated=true` | resync volumineux | curseur non avancé, relecture partielle au run suivant | dédup neutralise les relectures | log |

#### Tests requis

- Insertion + updates nominaux ; dédup `(user_id, gmail_id)` sur relecture ; `truncated` → curseur inchangé ; confirmation `sending_unconfirmed` → `sent` ; suppression distante → `archived_remote` local sans effet Google ; échec transactionnel → curseur intact

---

### `finalize_sync`

**Type SDK** : `@step` db
**Fonction cible** : `async def finalize_sync(user_id: str, calendar_result: dict | None, gmail_result: dict | None, auto_trigger_triage: bool) -> dict`
**Responsabilité** : clôturer le run : agréger les résultats des deux branches (une branche en échec → résultat `None` → `partial=true`), mettre à jour `last_sync_at` (fraîcheur affichée dans l'UI — seulement pour les branches réussies : `calendar_synced_at` / `gmail_synced_at` distincts), libérer le verrou, émettre `google_sync.completed`, et si `new_mail_ids` non vide et `auto_trigger_triage` → démarrer `mail_triage` via le SDK (fire-and-forget, l'échec du démarrage n'échoue pas le sync : les mails restent `pending_triage` et seront pris au prochain run de triage).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID |
| `state.calendar_result` | branche agenda via `parallel()` | `dict \| None` | oui | `None` si branche en échec |
| `state.gmail_result` | branche gmail via `parallel()` | `dict \| None` | oui | `None` si branche en échec |
| `config.auto_trigger_triage` | config SDK | `bool` | non (défaut `true`) | — |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `result` | résultat final du workflow | `GoogleSyncResult` | `{"calendar": {...}, "gmail": {...}, "triage_started": true, "connection_status": "ok"}` | scheduler/endpoint appelant, journal d'usage |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="finalize_sync", retry_max_attempts=3, timeout_seconds=10)
async def finalize_sync(user_id: str, calendar_result, gmail_result, auto_trigger_triage: bool) -> dict:
    # UPDATE last_sync (par branche réussie) + libération du verrou
    # events.emit("google_sync.completed", {...})
    # si new_mail_ids et auto_trigger_triage : démarrage mail_triage (WorkflowHandle, fire-and-forget)
    ...
    if calendar_result is None or gmail_result is None:
        events.set_step_summary(f"Synchronisation partielle : {failed_branch} en échec")
    else:
        events.set_step_summary("Synchronisation terminée")
    return result
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- APIs : Postgres + démarrage de workflow `mail_triage` via le SDK (`AgentPlatform`/`WorkflowHandle`)
- Secrets : `DATABASE_URL`
- Idempotency key : le démarrage de `mail_triage` utilise un WorkflowID déterministe dérivé du run parent → replay ne double pas le triage
- Rate limit : aucun
- Compensation : échec du démarrage du triage → loggé, mails restent `pending_triage` (rattrapés au prochain déclenchement)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Synchronisation terminée » / « Synchronisation partielle : {branche} en échec »
- Events métier : `google_sync.completed` `{ user_id, trigger, calendar: {...}, gmail: {...}, partial, duration_ms }`
- Logs : `workflow_id`, `user_id`, `partial`, `triage_started`, `triage_workflow_id` ; métriques : taux de partiels ; corrélation : `workflow_id`, `user_id`, `triage_workflow_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | verrou expire seul (2 min) | `workflow.failed` auto |
| Démarrage triage échoué | Core/DBOS occupé | pas de retry bloquant (fire-and-forget) | mails `pending_triage` rattrapés ensuite | log warning |
| Replay | crash | WorkflowID triage déterministe | zéro double triage | — |

#### Tests requis

- Agrégation nominale + triage déclenché avec les bons `mail_ids` ; branche en échec → `partial=true`, `last_sync` de la seule branche réussie avancé ; `auto_trigger_triage=false` → pas de triage ; zéro nouveau mail → pas de triage ; replay → un seul triage

---

### Vérification croisée (faite)

- Tous les inputs ont un producteur (payload, step précédent, config section 5, BDD documentée) ; tous les outputs sont consommés ou terminaux.
- Toutes les clés de config sont consommées : `gmail_lookback_days` + `max_mails_per_sync` (fetch_gmail), `calendar_window_days` (fetch_calendar), `push_local_events` (branche agenda), `auto_trigger_triage` (finalize).
- Aucun step LLM (workflow purement technique) — sections Prompt/LLM toutes en N/A.
- Invariant transactionnel vérifié aux deux endroits : `apply_calendar_changes` et `store_new_mails` écrivent curseur + données dans la même transaction ; cas `truncated` explicitement traité (curseur non avancé + dédup).
- Chaque appel Google a : idempotence (lecture pure, ou id client/réconciliation 409), retry borné, et un chemin d'échec qui laisse le curseur intact.
- Le lien avec les autres workflows est fermé : `store_new_mails` confirme les `sending_unconfirmed` de l'assistant ; `finalize_sync` déclenche `mail_triage` avec WorkflowID déterministe ; le badge « non synchronisé » relie `push_local_events` à l'UI planning.
- Chaque step a un summary Op exact en français, chemins d'erreur et cas vides inclus ; les deux sous-workflows ont leur description Op propre (branches visibles dans la vue Op).
- Aucun step n'a d'input métier corrigeable — documenté step par step, cohérent avec la section 6 (le cas jeton révoqué passe par le parcours OAuth, pas par error_recovery).
