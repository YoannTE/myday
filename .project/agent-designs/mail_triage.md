---
kind: agent-platform-design
sdk: agent-platform
runtime: dbos
langgraph: false
workflow: mail_triage
status: validated
validated_at: "2026-07-09"
detail_validated_at: "2026-07-09"
---

# Agent Design : mail_triage

## 1. Vue d'ensemble

- **Workflow SDK** : `mail_triage`
- **Description Op** : « Trie les nouveaux mails reçus, calcule leur importance et prépare les résumés affichés dans le cockpit. »
- **Objectif métier** : transformer les mails bruts synchronisés depuis Gmail en une liste priorisée (score d'importance + résumé en français) qui alimente le dashboard (F3), les mails intelligents (F7), le brief quotidien (F8) et les notifications push (F10).
- **Déclencheur** : appelé par le workflow `google_sync` après chaque synchronisation Gmail ayant ramené de nouveaux mails ; déclenchable aussi à la demande (bouton de rafraîchissement manuel).
- **Entrée initiale** : `{ "user_id": str, "mail_ids": list[str], "trigger": "sync" | "manual" }` — les mails sont déjà persistés en BDD par `google_sync`, ce workflow ne parle jamais à l'API Gmail.
- **Sortie finale** : `{ "processed": int, "important_count": int, "skipped_prefilter": int, "llm_calls": int }`
- **Opérateurs humains** : aucun pendant le run. Le feedback utilisateur (boutons « important / pas important ») est asynchrone, hors workflow : il alimente la table `sender_preferences` consommée par le pré-filtre au run suivant.
- **Volume / SLA** : ~10-50 nouveaux mails/jour/utilisateur en régime nominal ; premier sync limité à une fenêtre récente (config `lookback_days`). Latence cible < 30 s par lot. Coût IA maîtrisé : pré-filtre heuristique gratuit avant tout appel LLM, plafond de mails scorés par run.

## 2. Workflow SDK-native

Orchestration Python déterministe, séquentielle (pas de `parallel()` : les lots sont petits et chaque étape dépend de la précédente).

- Décorateur : `@workflow(name="mail_triage", version=1, description="Trie les nouveaux mails reçus, calcule leur importance et prépare les résumés affichés dans le cockpit.")`
- Fonction : `async def mail_triage(payload: dict, *, config: dict | None = None) -> dict`
- Branches conditionnelles : `if` Python — si le pré-filtre ne retient aucun candidat LLM, sauter les steps LLM et aller directement à la persistance ; si `notify_important` désactivé, sauter la préparation des notifications.
- Persistance/reprise : DBOS via le SDK — chaque step complété est rejoué depuis le cache en cas de crash.

Séquence :

```
load_new_mails → prefilter_mails → [si candidats] score_mails → summarize_important_mails → persist_triage → [si activé] queue_notifications
```

## 3. Steps

| Step SDK | Type | Responsabilité | Input | Output | Retry/timeout | Inputs corrigeables / safe_step | Observabilité |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `load_new_mails` | db | Charger depuis Postgres les mails à trier (statut `pending_triage`) + les préférences expéditeurs de l'utilisateur | `state.mail_ids`, `state.user_id` | `state.mails`, `state.sender_prefs` | 3 essais, timeout 10 s | Aucun input métier corrigeable | summary : « {n} mails à trier chargés » |
| `prefilter_mails` | pure | Appliquer les signaux déterministes : expéditeur connu/marqué important, To vs Cc, mots-clés d'action, exclusion newsletters/no-reply. Classe chaque mail : score auto (évident) ou candidat LLM | `state.mails`, `state.sender_prefs` | `state.auto_scored`, `state.candidates` | pas de retry (pur, déterministe) | Aucun input métier corrigeable | summary : « {k} mails envoyés à l'analyse IA, {j} classés automatiquement » |
| `score_mails` | llm | Scorer l'importance (0-100) de chaque candidat avec raison courte, en lot, via `llm.parse` (JSON strict), modèle économique, plafonné à `max_llm_mails_per_run` | `state.candidates` | `state.scored` | 3 essais, timeout 60 s ; fallback score heuristique si LLM non parsable | Aucun input métier corrigeable | summary : « {k} mails scorés par l'IA » + event `mail_triage.scored` |
| `summarize_important_mails` | llm | Générer un résumé de 1-2 phrases en français pour chaque mail ≥ seuil d'importance | `state.scored`, `state.auto_scored` | `state.summaries` | 3 essais, timeout 60 s ; mail affiché sans résumé si échec définitif | Aucun input métier corrigeable | summary : « {m} résumés générés » |
| `persist_triage` | db | Écrire scores, raisons, résumés et statut `triaged` en BDD ; upsert idempotent par `(user_id, gmail_id)` | `state.scored`, `state.auto_scored`, `state.summaries` | `state.persisted_count` | 3 essais, timeout 10 s | Aucun input métier corrigeable | summary : « Résultats de tri enregistrés pour {n} mails » |
| `queue_notifications` | db | Créer les notifications « mail important » (F10) en respectant le plafond anti-spam (`max_push_per_hour`) | `state.scored` (≥ seuil) | `state.notified_count` | 3 essais, timeout 10 s | Aucun input métier corrigeable | summary : « {m} notifications préparées » ou « Aucune notification nécessaire » |

Aucun step parallélisable : volume faible, dépendances séquentielles strictes.

## 4. State et contrats de données

```python
from typing import NotRequired, TypedDict

class MailTriageInput(TypedDict):
    user_id: str            # UUID utilisateur MyDay
    mail_ids: list[str]     # ids internes (BDD) des mails à trier
    trigger: str            # "sync" | "manual"

class ScoredMail(TypedDict):
    mail_id: str            # id interne BDD
    gmail_id: str           # id Gmail (idempotency key avec user_id)
    score: int              # 0-100
    reason: str             # raison courte en français
    source: str             # "prefilter" | "llm" | "fallback"
    summary: NotRequired[str]  # résumé 1-2 phrases si important

class MailTriageResult(TypedDict):
    processed: int
    important_count: int
    skipped_prefilter: int
    llm_calls: int

class MailTriageState(TypedDict):
    user_id: str
    mails: list[dict]
    sender_prefs: dict[str, str]   # email expéditeur -> "important" | "muted"
    auto_scored: list[ScoredMail]
    candidates: list[dict]
    scored: list[ScoredMail]
    summaries: dict[str, str]      # mail_id -> résumé
    persisted_count: int
    notified_count: int
```

Invariants :

- `user_id` obligatoire partout — toute requête SQL est scopée par `user_id` (règle de cloisonnement strict).
- Idempotency key : `(user_id, gmail_id)` — contrainte d'unicité en BDD, les upserts rendent le workflow rejouable sans doublon.
- Le contenu des mails ne sort JAMAIS du couple BDD + appels LLM : ni dans les events, ni dans les summaries Op, ni dans les logs.
- Sortie LLM : JSON strict validé par `llm.parse(..., schema=...)` ; toute réponse invalide déclenche le fallback heuristique.

## 5. Config SDK

| Clé | Type SDK | Défaut | Scope | Description | Secret |
| --- | --- | --- | --- | --- | --- |
| `llm_model` | `Choice(["claude-haiku-4-5", "claude-sonnet-4-5"])` | `claude-haiku-4-5` | workflow | Modèle IA pour le scoring (économique par défaut) | non |
| `summary_model` | `Choice(["claude-haiku-4-5", "claude-sonnet-4-5"])` | `claude-sonnet-4-5` | step `summarize_important_mails` | Modèle IA pour les résumés | non |
| `importance_threshold` | `IntRange(0, 100)` | `60` | workflow | Seuil au-dessus duquel un mail est « important » | non |
| `max_llm_mails_per_run` | `IntRange(1, 100)` | `30` | workflow | Plafond de mails scorés par l'IA par run (maîtrise du coût) | non |
| `lookback_days` | `IntRange(1, 30)` | `7` | workflow | Fenêtre de mails traités au tout premier sync | non |
| `notify_important` | `Toggle` | `true` | workflow | Créer des notifications push pour les mails importants | non |
| `max_push_per_hour` | `IntRange(1, 20)` | `3` | step `queue_notifications` | Plafond anti-spam de notifications | non |

```python
from agent_platform import Choice, IntRange, Toggle, configurable, workflow

@configurable({
    "llm_model": Choice(["claude-haiku-4-5", "claude-sonnet-4-5"], default="claude-haiku-4-5", label="Modèle IA de tri"),
    "summary_model": Choice(["claude-haiku-4-5", "claude-sonnet-4-5"], default="claude-sonnet-4-5", label="Modèle IA des résumés"),
    "importance_threshold": IntRange(0, 100, default=60, label="Seuil d'importance"),
    "max_llm_mails_per_run": IntRange(1, 100, default=30, label="Mails analysés par l'IA max par run"),
    "lookback_days": IntRange(1, 30, default=7, label="Fenêtre du premier sync (jours)"),
    "notify_important": Toggle(default=True, label="Notifier les mails importants"),
    "max_push_per_hour": IntRange(1, 20, default=3, label="Notifications max par heure"),
})
@workflow(name="mail_triage", version=1, description="Trie les nouveaux mails reçus, calcule leur importance et prépare les résumés affichés dans le cockpit.")
async def mail_triage(payload: dict, *, config: dict | None = None) -> dict:
    ...
```

## 6. HITL

Aucun HITL requis — le tri est en lecture seule : il ne rédige rien, n'envoie rien, ne supprime rien. La validation humaine obligatoire (avant envoi de mail) appartient au workflow `assistant_conversationnel`, pas à celui-ci.

Le feedback utilisateur « important / pas important » (boutons dans l'UI) est asynchrone et hors workflow : il écrit dans `sender_preferences`, consommée par `prefilter_mails` au run suivant.

Aucun `@safe_step` requis - aucun input métier corrigeable : tous les inputs sont des identifiants internes (`user_id`, `mail_ids`) ou des données Gmail immuables qu'un opérateur ne peut pas « corriger ». En cas d'échec définitif, le mail reste en statut `pending_triage` et sera repris au run suivant.

## 7. Observability

- **Auto SDK** : `workflow.started`, `workflow.completed`, `workflow.failed`, durée, `workflow_id` — ne pas émettre manuellement.
- **Description Op du workflow** : « Trie les nouveaux mails reçus, calcule leur importance et prépare les résumés affichés dans le cockpit. »
- **Summaries Op obligatoires** (via `events.set_step_summary(...)` juste avant chaque `return`, chemins d'erreur inclus) :
  - `load_new_mails` : « {n} mails à trier chargés »
  - `prefilter_mails` : « {k} mails envoyés à l'analyse IA, {j} classés automatiquement »
  - `score_mails` : « {k} mails scorés par l'IA » / « Score heuristique de secours appliqué à {x} mails »
  - `summarize_important_mails` : « {m} résumés générés »
  - `persist_triage` : « Résultats de tri enregistrés pour {n} mails »
  - `queue_notifications` : « {m} notifications préparées » / « Aucune notification nécessaire »
- **Événements métier** :
  - `mail_triage.scored` `{ user_id, candidates, llm_calls, fallbacks, duration_ms }`
  - `mail_triage.completed` `{ user_id, processed, important_count, skipped_prefilter, llm_calls }` (alimente le journal d'usage et la baseline de coût IA)
- **Logs structurés** : clés obligatoires `workflow_id`, `user_id`, `trigger`, `mail_count` — jamais de sujet, d'expéditeur ni de contenu de mail.
- **Métriques** : nombre d'appels LLM et tokens par run et par utilisateur, taux de fallback heuristique, latence par step, taux de mails importants.
- **Corrélation** : `user_id`, `workflow_id` ; `gmail_id` uniquement dans les logs internes (pas dans les events Core).

## 8. Recovery, retries et idempotence

| Risque | Détection | Retry | Idempotence | Compensation | Escalade |
| --- | --- | --- | --- | --- | --- |
| Crash en plein run | Reprise DBOS automatique | Steps complétés rejoués depuis le cache | Upsert `(user_id, gmail_id)` — rejouable sans doublon | — | — |
| LLM indisponible / timeout | Exception `llm.parse` | 3 essais (backoff SDK) | — | Fallback : score heuristique du pré-filtre, `source="fallback"` | Event `mail_triage.scored` avec `fallbacks > 0` visible dans la vue Op |
| Réponse LLM non parsable | Échec de validation schema | 1 re-tentative avec consigne de format renforcée | — | Fallback heuristique idem | idem |
| BDD indisponible | Exception asyncpg | 3 essais | — | Workflow échoue proprement ; mails restent `pending_triage`, repris au prochain sync | `workflow.failed` auto SDK |
| Notifications en excès | Compteur `max_push_per_hour` | — | Une notification max par mail (clé `(user_id, mail_id, type)`) | Notifications excédentaires silencieusement ignorées | — |
| Core/observability indisponible | Échec émission event | best effort | — | Le run continue — l'observabilité n'est jamais bloquante | — |

Timeouts : 10 s steps BDD, 60 s steps LLM. Aucun appel externe non idempotent dans ce workflow (pas d'écriture Gmail).

## 9. Sécurité et limites

- **Secrets requis** : `ANTHROPIC_API_KEY` via `os.environ` (Décision N — pas de stockage BDD). Aucun jeton Google manipulé ici (les mails sont déjà en BDD).
- **Données personnelles** : le contenu des mails est de la PII — traité uniquement en BDD et dans les appels LLM ; jamais dans events/summaries/logs. Rétention : scores et résumés purgés avec le compte (règle de suppression de compte).
- **Validation des inputs** : `user_id` UUID valide, `mail_ids` non vide et appartenant à `user_id` (vérifié dans `load_new_mails` — un mail d'un autre utilisateur est ignoré et loggé).
- **Permissions opérateur HITL** : sans objet (aucun HITL).
- **Rate limits externes** : LLM uniquement — bornés par `max_llm_mails_per_run` et le batching des candidats.

## 10. Plan d'implémentation

- **Fichier workflow** : `backend/agents/mail_triage.py`
- **Tests** : `backend/tests/agents/test_mail_triage.py`
  - happy path : 10 mails → pré-filtre en écarte 6, l'IA en score 4, 2 importants, résumés + notifications créés
  - edge case LLM en erreur : fallback heuristique, `source="fallback"`, le run se termine
  - edge case pré-filtre total : 0 candidat LLM → steps LLM sautés, 0 appel LLM
  - edge case plafond : 50 candidats, `max_llm_mails_per_run=30` → 30 scorés, 20 laissés en `pending_triage`
- **Tests error_recovery / retry_with_input** : sans objet (aucun `@safe_step` — documenté section 6)
- **Fixtures/mocks** : `workflow_runner`, `mock_llm` (via `agent_platform.testing`), fixtures mails en BDD de test
- **Endpoints/API à connecter** : appel interne depuis `google_sync` (fin de sync Gmail) ; endpoint FastAPI `POST /api/triage/refresh` (rafraîchissement manuel, auth `get_current_user`)
- **Critères d'acceptation** :
  - aucun appel LLM pour un mail exclu par le pré-filtre
  - re-run du même lot = zéro doublon (idempotence vérifiée)
  - le feedback `sender_preferences` change le classement au run suivant
  - la timeline Op affiche un summary en français pour chaque step

## 11. Détail par step

### `load_new_mails`

**Type SDK** : `@step` db
**Fonction cible** : `async def load_new_mails(user_id: str, mail_ids: list[str], lookback_days: int) -> dict`
**Responsabilité** : charger depuis Postgres les mails à trier (statut `pending_triage`) appartenant à l'utilisateur, plus ses préférences expéditeurs. Applique la fenêtre `lookback_days` (les mails plus anciens sont marqués `skipped_old` sans passer par l'IA).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID valide |
| `input.mail_ids` | payload initial | `list[str]` | oui | non vide ; ids appartenant à `user_id` (les autres sont ignorés + loggés) |
| `config.lookback_days` | config SDK | `int` | non (défaut 7) | 1-30 |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.mails` | workflow state | `list[dict]` | `[{"mail_id": "...", "gmail_id": "...", "from_email": "...", "to_type": "to", "subject": "...", "snippet": "...", "received_at": "..."}]` | `prefilter_mails` |
| `state.sender_prefs` | workflow state | `dict[str, str]` | `{"manon@gmail.com": "important"}` | `prefilter_mails` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="load_new_mails", retry_max_attempts=3, timeout_seconds=10)
async def load_new_mails(user_id: str, mail_ids: list[str], lookback_days: int) -> dict:
    # SELECT scopé par user_id (cloisonnement strict) + statut pending_triage
    # + SELECT sender_preferences du même user_id
    mails = ...
    prefs = ...
    events.set_step_summary(f"{len(mails)} mails à trier chargés")
    return {"mails": mails, "sender_prefs": prefs}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres uniquement (pool asyncpg, `async with pool.acquire()`)
- Secrets : `DATABASE_URL` (config FastAPI, jamais dans le code)
- Idempotency key : lecture pure, sans effet
- Rate limit : aucun
- Compensation : aucune (lecture seule)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (`user_id` et `mail_ids` sont des identifiants internes)

#### Observability

- Summary Op : « {n} mails à trier chargés »
- Events métier : aucun (step de lecture)
- Logs structurés : `workflow_id`, `user_id`, `requested`, `loaded`, `ignored_foreign` (mails n'appartenant pas au user)
- Métriques : latence du step
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | mails restent `pending_triage`, repris au prochain sync | `workflow.failed` auto |
| `mail_ids` vide après filtrage | tous étrangers ou déjà triés | retour `mails=[]`, le workflow se termine proprement | résultat `processed=0` | — |

#### Tests requis

- Cas nominal : 10 ids → 10 mails + prefs chargés
- Id appartenant à un autre utilisateur → ignoré + loggé, pas d'exception
- Mails hors fenêtre `lookback_days` → marqués `skipped_old`
- BDD en erreur → 3 retries puis échec propre

---

### `prefilter_mails`

**Type SDK** : `@step` pure
**Fonction cible** : `async def prefilter_mails(mails: list[dict], sender_prefs: dict[str, str]) -> dict`
**Responsabilité** : classer chaque mail sans IA quand c'est évident, sinon le retenir comme candidat LLM. Règles déterministes, dans cet ordre : (1) expéditeur `muted` → score 5 ; (2) expéditeur `important` → score 85 ; (3) no-reply/newsletter (en-têtes `List-Unsubscribe`, motifs `no-reply@`, `newsletter@`) → score 15 ; (4) utilisateur en Cc sans mot-clé d'action → score 30 ; (5) sinon → candidat LLM (avec signaux joints : `known_sender`, `to_type`, `action_keywords` détectés parmi « merci de », « peux-tu », « urgent », « avant le », « confirme », « réponds », « facture », « paiement », « rendez-vous »).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `state.mails` | `load_new_mails` | `list[dict]` | oui | peut être vide (le workflow saute alors les steps LLM) |
| `state.sender_prefs` | `load_new_mails` | `dict[str, str]` | oui | valeurs ∈ {`important`, `muted`} |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.auto_scored` | workflow state | `list[ScoredMail]` | `[{"mail_id": "...", "score": 15, "reason": "Newsletter", "source": "prefilter"}]` | `summarize_important_mails`, `persist_triage` |
| `state.candidates` | workflow state | `list[dict]` | mails + signaux calculés | `score_mails` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="prefilter_mails")
async def prefilter_mails(mails: list[dict], sender_prefs: dict[str, str]) -> dict:
    auto_scored, candidates = [], []
    # règles déterministes 1→5 (voir Responsabilité)
    ...
    events.set_step_summary(
        f"{len(candidates)} mails envoyés à l'analyse IA, {len(auto_scored)} classés automatiquement"
    )
    return {"auto_scored": auto_scored, "candidates": candidates}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- Aucun (fonction pure, déterministe)
- Compensation : aucune

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (données Gmail immuables ; les préférences se corrigent dans l'UI, hors workflow)

#### Observability

- Summary Op : « {k} mails envoyés à l'analyse IA, {j} classés automatiquement »
- Events métier : aucun (les compteurs partent dans `mail_triage.completed`)
- Logs structurés : `workflow_id`, `user_id`, répartition par règle (`muted`, `important_sender`, `newsletter`, `cc_only`, `candidate`)
- Métriques : taux de mails évités au LLM (efficacité du pré-filtre)
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| Champ manquant dans un mail | donnée sync incomplète | le mail devient candidat LLM (choix conservateur) | — | log warning |

#### Tests requis

- Cas nominal : mélange des 5 règles → répartition correcte
- Expéditeur `muted` ET mots-clés d'action → `muted` gagne (règle 1 prioritaire)
- Liste vide → `candidates=[]`, `auto_scored=[]`
- Mail sans en-têtes → candidat LLM, pas d'exception

---

### `score_mails`

**Type SDK** : `@step` LLM
**Fonction cible** : `async def score_mails(candidates: list[dict], llm_model: str, max_llm_mails: int) -> dict`
**Responsabilité** : scorer l'importance (0-100) de chaque candidat avec une raison courte, en un seul appel LLM par lot (jusqu'à `max_llm_mails_per_run`). Les candidats au-delà du plafond restent `pending_triage` pour le run suivant.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `state.candidates` | `prefilter_mails` | `list[dict]` | oui | non vide (sinon le step est sauté par le workflow) |
| `config.llm_model` | config SDK | `str` | non (défaut `claude-haiku-4-5`) | ∈ Choice |
| `config.max_llm_mails_per_run` | config SDK | `int` | non (défaut 30) | 1-100 |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.scored` | workflow state | `list[ScoredMail]` | `[{"mail_id": "...", "score": 72, "reason": "Demande de réponse sur le devis", "source": "llm"}]` | `summarize_important_mails`, `persist_triage`, `queue_notifications` |
| `state.deferred` | workflow state | `list[str]` | ids au-delà du plafond | `persist_triage` (restent `pending_triage`) |

#### Implémentation SDK attendue

```python
from agent_platform import events, llm, step
from pydantic import BaseModel, Field

class MailScore(BaseModel):
    mail_id: str
    score: int = Field(ge=0, le=100)
    reason: str = Field(max_length=120)

class ScoreBatch(BaseModel):
    results: list[MailScore]

@step(name="score_mails", retry_max_attempts=3, timeout_seconds=60)
async def score_mails(candidates: list[dict], llm_model: str, max_llm_mails: int) -> dict:
    batch, deferred = candidates[:max_llm_mails], [c["mail_id"] for c in candidates[max_llm_mails:]]
    parsed = await llm.parse(
        model=llm_model,
        messages=[{"role": "system", "content": SYSTEM_PROMPT},
                  {"role": "user", "content": build_user_prompt(batch)}],
        schema=ScoreBatch,
        response_format="json_object",
    )
    scored = merge_with_fallback(batch, parsed)  # fallback heuristique pour tout mail_id absent de la réponse
    fallbacks = sum(1 for s in scored if s["source"] == "fallback")
    if fallbacks:
        events.set_step_summary(f"{len(scored) - fallbacks} mails scorés par l'IA, score de secours appliqué à {fallbacks} mails")
    else:
        events.set_step_summary(f"{len(scored)} mails scorés par l'IA")
    return {"scored": scored, "deferred": deferred}
```

#### Prompt / LLM

- **Model/config key** : `config.llm_model` (défaut `claude-haiku-4-5`)
- **System prompt** :

```text
Tu es le moteur de tri des mails de MyDay, un cockpit personnel. Tu évalues l'importance de chaque mail pour son destinataire.

Pour chaque mail fourni, attribue :
- "score" : un entier de 0 à 100
- "reason" : une raison courte en français (12 mots maximum)

Barème :
- 80-100 : demande d'action urgente, échéance proche, expéditeur humain qui attend une réponse
- 60-79 : demande de réponse ou d'action sans urgence, information personnelle importante
- 30-59 : information utile sans action attendue
- 0-29 : notification automatique, publicité, contenu promotionnel

Signaux fournis avec chaque mail : known_sender (expéditeur déjà en contact), to_type ("to" = destinataire direct, "cc" = en copie), action_keywords (mots d'action détectés). Un destinataire direct avec demande d'action score plus haut qu'une copie informative.

Réponds UNIQUEMENT avec le JSON demandé, sans aucun texte autour. Chaque mail_id reçu doit apparaître exactement une fois dans "results".
```

- **User prompt template** :

```text
Voici {n} mails à évaluer, au format JSON :

{"mails": [
  {"mail_id": "...", "from": "...", "to_type": "to|cc", "subject": "...", "snippet": "... (200 premiers caractères)", "known_sender": true|false, "action_keywords": ["..."]},
  ...
]}
```

- **Schema de sortie** : Pydantic `ScoreBatch` (`results: list[MailScore]`, `score` borné 0-100, `reason` ≤ 120 caractères) — validé par `llm.parse`.
- **Parsing** : `llm.parse` valide le JSON strict. Si validation échouée → 1 re-tentative avec consigne de format renforcée (« Ta réponse précédente était invalide, renvoie uniquement le JSON »). Si encore échouée, ou si un `mail_id` manque dans la réponse → score heuristique de secours pour les mails concernés : `known_sender → 65`, `to_type=="to" et action_keywords → 70`, sinon `40`, avec `source="fallback"` et `reason="Score automatique (IA indisponible)"`.

#### Tools et effets externes

- API : LLM via `agent_platform.llm` uniquement (jamais anthropic/openai direct)
- Secrets : `ANTHROPIC_API_KEY` via `os.environ` (Décision N)
- Idempotency key : aucun effet externe persistant ; le replay DBOS rejoue le résultat mémorisé
- Rate limit : borné par `max_llm_mails_per_run` (1 appel LLM par run)
- Compensation : aucune (pas d'effet externe)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (contenu Gmail immuable ; le seuil et le modèle se corrigent via la config SDK, pas via error_recovery)

#### Observability

- Summary Op : « {k} mails scorés par l'IA » / « {k} mails scorés par l'IA, score de secours appliqué à {x} mails »
- Events métier : `mail_triage.scored` `{ user_id, candidates, llm_calls, fallbacks, duration_ms }` (émis via `events.emit`, sans contenu de mail)
- Logs structurés : `workflow_id`, `user_id`, `batch_size`, `deferred`, `fallbacks`, `model`, tokens in/out
- Métriques : tokens et coût par run (baseline coût IA/utilisateur), taux de fallback
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| LLM timeout/indisponible | panne fournisseur | retry 3x (backoff SDK) | scores heuristiques `source="fallback"` pour tout le lot | `fallbacks > 0` visible dans l'event et le summary |
| JSON invalide | réponse mal formée | 1 re-tentative format renforcé | fallback heuristique | idem |
| `mail_id` manquant/inventé dans la réponse | hallucination | ids inventés ignorés ; ids manquants → fallback | — | log warning |
| Crash mid-step | process tué | replay DBOS : le step complet est rejoué (aucun effet externe) | — | — |

#### Tests requis

- Cas nominal : 4 candidats → 4 scores valides `source="llm"` (mock_llm)
- LLM en erreur définitive → 4 scores `source="fallback"`, run terminé
- Réponse avec `mail_id` manquant → fallback ciblé sur ce mail seulement
- 50 candidats, plafond 30 → 30 scorés, 20 dans `deferred`
- Score hors bornes renvoyé → validation Pydantic échoue → re-tentative

---

### `summarize_important_mails`

**Type SDK** : `@step` LLM
**Fonction cible** : `async def summarize_important_mails(scored: list, auto_scored: list, threshold: int, summary_model: str) -> dict`
**Responsabilité** : générer un résumé de 1-2 phrases en français pour chaque mail dont le score ≥ `importance_threshold` (issus du LLM comme du pré-filtre). Un seul appel LLM par lot.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `state.scored` | `score_mails` | `list[ScoredMail]` | oui | peut être vide |
| `state.auto_scored` | `prefilter_mails` | `list[ScoredMail]` | oui | peut être vide |
| `config.importance_threshold` | config SDK | `int` | non (défaut 60) | 0-100 |
| `config.summary_model` | config SDK | `str` | non (défaut `claude-sonnet-4-5`) | ∈ Choice |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.summaries` | workflow state | `dict[str, str]` | `{"mail_123": "Le comptable demande la facture de juin avant vendredi."}` | `persist_triage` |

#### Implémentation SDK attendue

```python
from agent_platform import events, llm, step
from pydantic import BaseModel

class MailSummary(BaseModel):
    mail_id: str
    summary: str

class SummaryBatch(BaseModel):
    results: list[MailSummary]

@step(name="summarize_important_mails", retry_max_attempts=3, timeout_seconds=60)
async def summarize_important_mails(scored, auto_scored, threshold: int, summary_model: str) -> dict:
    important = [m for m in scored + auto_scored if m["score"] >= threshold]
    if not important:
        events.set_step_summary("Aucun mail important à résumer")
        return {"summaries": {}}
    parsed = await llm.parse(model=summary_model, messages=[...], schema=SummaryBatch, response_format="json_object")
    summaries = {r.mail_id: r.summary for r in parsed.results}
    events.set_step_summary(f"{len(summaries)} résumés générés")
    return {"summaries": summaries}
```

#### Prompt / LLM

- **Model/config key** : `config.summary_model` (défaut `claude-sonnet-4-5`)
- **System prompt** :

```text
Tu résumes des mails pour le dashboard personnel MyDay. Pour chaque mail fourni, écris un résumé de 1 à 2 phrases en français, au présent, factuel : qui demande quoi, et pour quand si une échéance existe. Pas de formule de politesse, pas de mise en forme, pas d'opinion. 220 caractères maximum par résumé.

Réponds UNIQUEMENT avec le JSON demandé. Chaque mail_id reçu doit apparaître exactement une fois dans "results".
```

- **User prompt template** :

```text
Voici {n} mails importants à résumer, au format JSON :

{"mails": [
  {"mail_id": "...", "from": "...", "subject": "...", "body_excerpt": "... (1000 premiers caractères du corps)"},
  ...
]}
```

- **Schema de sortie** : Pydantic `SummaryBatch` (`results: list[MailSummary]`).
- **Parsing** : `llm.parse` strict ; 1 re-tentative si invalide ; en échec définitif, le mail est affiché SANS résumé (le dashboard montre l'objet + l'extrait brut) — jamais de résumé inventé hors LLM.

#### Tools et effets externes

- API : LLM via `agent_platform.llm`
- Secrets : `ANTHROPIC_API_KEY` via `os.environ`
- Idempotency key : aucun effet externe ; replay DBOS rejoue le résultat
- Rate limit : borné par la taille du lot important (≤ `max_llm_mails_per_run`)
- Compensation : aucune

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « {m} résumés générés » / « Aucun mail important à résumer »
- Events métier : aucun dédié (compteur `important_count` dans `mail_triage.completed`)
- Logs structurés : `workflow_id`, `user_id`, `important_count`, `summarized`, tokens
- Métriques : tokens/coût du step, taux de mails importants sans résumé (échecs)
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| LLM en échec définitif | panne | retry 3x puis continue | mails affichés sans résumé (objet + extrait) | log warning, métrique |
| Résumé > 220 caractères | non-respect consigne | tronqué à 217 + « ... » côté code | — | — |
| Aucun mail important | seuil élevé | step court-circuité | `summaries={}` | — |

#### Tests requis

- Cas nominal : 2 importants → 2 résumés
- Seuil 60, tous les scores < 60 → `summaries={}` sans appel LLM
- LLM en erreur → run terminé, mails sans résumé
- Résumé trop long → tronqué

---

### `persist_triage`

**Type SDK** : `@step` db
**Fonction cible** : `async def persist_triage(user_id: str, scored: list, auto_scored: list, summaries: dict, deferred: list[str]) -> dict`
**Responsabilité** : écrire en BDD les scores, raisons, résumés et le statut `triaged` — upsert idempotent par `(user_id, gmail_id)`. Les mails `deferred` (plafond LLM atteint) restent `pending_triage`.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID |
| `state.scored` | `score_mails` | `list[ScoredMail]` | oui | peut être vide |
| `state.auto_scored` | `prefilter_mails` | `list[ScoredMail]` | oui | peut être vide |
| `state.summaries` | `summarize_important_mails` | `dict[str, str]` | oui | peut être vide |
| `state.deferred` | `score_mails` | `list[str]` | oui | peut être vide |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.persisted_count` | workflow state | `int` | `12` | résultat final |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="persist_triage", retry_max_attempts=3, timeout_seconds=10)
async def persist_triage(user_id: str, scored, auto_scored, summaries, deferred) -> dict:
    # UPSERT ... ON CONFLICT (user_id, gmail_id) DO UPDATE — idempotent
    # statut 'triaged' pour scored + auto_scored ; deferred inchangés (pending_triage)
    count = ...
    events.set_step_summary(f"Résultats de tri enregistrés pour {count} mails")
    return {"persisted_count": count}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres (asyncpg)
- Secrets : `DATABASE_URL`
- Idempotency key : contrainte d'unicité `(user_id, gmail_id)` + UPSERT → replay sans doublon
- Rate limit : aucun
- Compensation : transaction unique — tout ou rien ; en échec, aucun statut ne change

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Résultats de tri enregistrés pour {n} mails »
- Events métier : `mail_triage.completed` `{ user_id, processed, important_count, skipped_prefilter, llm_calls }` — émis ici (dernier point où tous les compteurs existent), alimente le journal d'usage
- Logs structurés : `workflow_id`, `user_id`, `persisted`, `deferred_count`
- Métriques : latence, taille de transaction
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | transaction annulée, mails restent `pending_triage` | `workflow.failed` auto |
| Replay après crash | DBOS | UPSERT rejoué | idempotent, zéro doublon | — |

#### Tests requis

- Cas nominal : 12 mails → 12 rows mises à jour, statut `triaged`
- Re-exécution du même lot → zéro doublon (idempotence)
- `deferred` non vide → ces mails restent `pending_triage`
- Échec transactionnel → aucun statut modifié

---

### `queue_notifications`

**Type SDK** : `@step` db
**Fonction cible** : `async def queue_notifications(user_id: str, scored: list, auto_scored: list, summaries: dict, threshold: int, max_push_per_hour: int) -> dict`
**Responsabilité** : créer les notifications « mail important » (F10) pour les mails ≥ seuil, en respectant le plafond anti-spam. Le step écrit des rows `notification` ; l'envoi push effectif est fait par le système de notifications de l'app (hors workflow).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID |
| `state.scored` + `state.auto_scored` | steps précédents | `list[ScoredMail]` | oui | filtrés ≥ `threshold` |
| `state.summaries` | `summarize_important_mails` | `dict[str, str]` | oui | résumé utilisé comme corps de notification si présent |
| `config.notify_important` | config SDK | `bool` | non (défaut `true`) | si `false`, le workflow saute ce step |
| `config.max_push_per_hour` | config SDK | `int` | non (défaut 3) | 1-20 |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.notified_count` | workflow state | `int` | `2` | résultat final |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="queue_notifications", retry_max_attempts=3, timeout_seconds=10)
async def queue_notifications(user_id: str, scored, auto_scored, summaries, threshold: int, max_push_per_hour: int) -> dict:
    important = [m for m in scored + auto_scored if m["score"] >= threshold]
    # COUNT des notifications 'mail_important' de la dernière heure → budget restant
    # INSERT ... ON CONFLICT (user_id, mail_id, type) DO NOTHING — une notif max par mail
    created = ...
    if created:
        events.set_step_summary(f"{created} notifications préparées")
    else:
        events.set_step_summary("Aucune notification nécessaire")
    return {"notified_count": created}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres (rows `notification`) — pas d'appel direct au service push depuis le workflow
- Secrets : `DATABASE_URL`
- Idempotency key : unicité `(user_id, mail_id, type)` → replay sans double notification
- Rate limit : plafond métier `max_push_per_hour` (fenêtre glissante 1 h)
- Compensation : aucune nécessaire (le service push lit les rows non envoyées)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « {m} notifications préparées » / « Aucune notification nécessaire »
- Events métier : aucun dédié (compteur dans les logs ; l'envoi effectif est tracé par le service push)
- Logs structurés : `workflow_id`, `user_id`, `eligible`, `created`, `suppressed_by_cap`
- Métriques : notifications supprimées par le plafond (détecte un seuil d'importance mal réglé)
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | le tri est déjà persisté (step précédent) — seules les notifications manquent | `workflow.failed` auto ; mails visibles au prochain passage sur le dashboard |
| Plafond atteint | rafale de mails importants | insertions excédentaires ignorées | l'utilisateur voit tout sur le dashboard | métrique `suppressed_by_cap` |
| Replay après crash | DBOS | `ON CONFLICT DO NOTHING` | zéro doublon | — |

#### Tests requis

- Cas nominal : 2 importants → 2 notifications créées
- `notify_important=false` → step sauté par le workflow, 0 notification
- 6 importants, plafond 3, 0 notification dans l'heure → 3 créées, 3 supprimées
- Replay → aucune notification en double

---

### Vérification croisée (faite)

- Tous les inputs ont un producteur (payload initial, step précédent ou config déclarée en section 5) ; tous les outputs sont consommés ou terminaux (`persisted_count`, `notified_count` → résultat final).
- Ajout par rapport à la section 3 : `state.deferred` (produit par `score_mails`, consommé par `persist_triage`) — cohérent avec le plafond `max_llm_mails_per_run`.
- Toutes les clés de config utilisées sont déclarées en section 5 ; `lookback_days` est consommé par `load_new_mails`.
- Les 2 steps LLM ont prompt système, template, schema Pydantic et stratégie de parsing/fallback.
- Les 6 steps ont un summary Op exact, y compris les chemins d'erreur et les cas vides.
- Aucun step n'a d'input métier corrigeable — documenté step par step, cohérent avec la section 6.
