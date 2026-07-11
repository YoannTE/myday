---
kind: agent-platform-design
sdk: agent-platform
runtime: dbos
langgraph: false
workflow: daily_brief
status: validated
validated_at: "2026-07-09"
detail_validated_at: "2026-07-09"
---

# Agent Design : daily_brief

## 1. Vue d'ensemble

- **Workflow SDK** : `daily_brief`
- **Description Op** : « Génère le brief du jour de l'utilisateur : priorités, planning, tâches et mails importants en une synthèse lisible. »
- **Objectif métier** : produire le moment signature de MyDay (F8) — une synthèse en français qui répond à « quoi faire maintenant » : les 3 priorités du moment, le planning du jour, les tâches en retard ou dues, les mails importants en attente. Consommé par le dashboard (F3) et les notifications (F10).
- **Déclencheur** :
  - **cron** : chaque jour à l'heure choisie par l'utilisateur (préférence `brief_hour`, planifié par un scheduler FastAPI qui lance un run par utilisateur actif) ;
  - **API** : à la demande (bouton « Régénérer mon brief ») ;
  - **API** : en toute fin d'onboarding, juste après la première synchronisation Google (décision revue : effet immédiat dès la première session).
- **Entrée initiale** : `{ "user_id": str, "trigger": "scheduled" | "manual" | "onboarding", "brief_date": "YYYY-MM-DD" }` (la date est passée par l'appelant — jamais calculée dans le workflow, déterminisme oblige).
- **Sortie finale** : `{ "brief_id": str, "generated": bool, "degraded": bool }`
- **Opérateurs humains** : aucun pendant le run. L'utilisateur consomme le brief dans l'UI.
- **Volume / SLA** : 1 run planifié/jour/utilisateur + quelques runs manuels. Latence cible < 20 s. Le brief ne doit JAMAIS être bloquant : en cas de panne IA, une version dégradée (listes brutes sans synthèse) est produite.

## 2. Workflow SDK-native

Orchestration Python déterministe, séquentielle (chaque étape dépend de la précédente — pas de `parallel()` : la collecte est une seule passe BDD, volume faible).

- Décorateur : `@workflow(name="daily_brief", version=1, description="Génère le brief du jour de l'utilisateur : priorités, planning, tâches et mails importants en une synthèse lisible.")`
- Fonction : `async def daily_brief(payload: dict, *, config: dict | None = None) -> dict`
- Branches conditionnelles : `if` Python —
  - si la collecte ne ramène AUCUNE donnée (agenda vide, zéro tâche, zéro mail important) → brief « journée calme » généré quand même (edge case de la revue : « brief sans données ») ;
  - si l'IA échoue définitivement → assemblage d'un brief dégradé sans LLM (`degraded=true`) ;
  - si `trigger != "scheduled"` ou `notify_ready=false` → pas de notification.
- Persistance/reprise : DBOS via le SDK.

Séquence :

```
collect_context → compose_brief (LLM, fallback dégradé) → persist_brief → [si scheduled et activé] notify_brief_ready
```

## 3. Steps

| Step SDK | Type | Responsabilité | Input | Output | Retry/timeout | Inputs corrigeables / safe_step | Observabilité |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `collect_context` | db | Charger en une passe : événements du jour (+ lendemain matin), tâches dues/en retard/prioritaires, mails importants non traités (score ≥ seuil, non répondus), fraîcheur de la dernière sync Google | `input.user_id`, `input.brief_date` | `state.context` | 3 essais, timeout 10 s | Aucun input métier corrigeable | summary : « Contexte du jour chargé : {e} événements, {t} tâches, {m} mails importants » |
| `compose_brief` | llm | Rédiger le brief en français via `llm.parse` (JSON strict) : accroche, 3 priorités max, synthèse planning, synthèse tâches, synthèse mails, alertes (conflit d'agenda, échéance proche, sync en retard) | `state.context` | `state.brief_content`, `state.degraded` | 3 essais, timeout 45 s ; fallback : brief dégradé assemblé sans IA | Aucun input métier corrigeable | summary : « Brief rédigé avec {p} priorités » / « Brief dégradé assemblé sans IA » |
| `persist_brief` | db | Enregistrer le brief ; upsert idempotent par `(user_id, brief_date, trigger)` pour les runs planifiés (un re-run remplace, pas de doublon) ; insertion simple pour `manual`/`onboarding` | `state.brief_content`, `input.*` | `state.brief_id` | 3 essais, timeout 10 s | Aucun input métier corrigeable | summary : « Brief du {date} enregistré » |
| `notify_brief_ready` | db | Créer la notification « Ton brief est prêt » (uniquement `trigger="scheduled"` et `notify_ready=true`) ; unicité `(user_id, brief_id, type)` | `state.brief_id` | `state.notified` | 3 essais, timeout 10 s | Aucun input métier corrigeable | summary : « Notification de brief envoyée » / « Notification non nécessaire » |

Aucun step parallélisable (dépendances séquentielles strictes).

## 4. State et contrats de données

```python
from typing import NotRequired, TypedDict

class DailyBriefInput(TypedDict):
    user_id: str          # UUID utilisateur MyDay
    trigger: str          # "scheduled" | "manual" | "onboarding"
    brief_date: str       # "YYYY-MM-DD", fourni par l'appelant (jamais datetime.now() dans le workflow)

class BriefContext(TypedDict):
    events: list[dict]        # événements du jour + lendemain matin (titre, début, fin, lieu)
    tasks_due: list[dict]     # tâches dues aujourd'hui ou en retard (titre, échéance, priorité)
    important_mails: list[dict]  # mails triés score >= seuil, non répondus (expéditeur, objet, résumé, score)
    last_sync_at: NotRequired[str]  # ISO 8601 — pour l'alerte « données pas fraîches »

class BriefContent(TypedDict):
    headline: str             # accroche 1 phrase
    priorities: list[str]     # 1 à max_priorities items, phrases courtes actionnables
    schedule_summary: str     # synthèse du planning en 1-3 phrases
    tasks_summary: str        # synthèse des tâches en 1-2 phrases
    mails_summary: str        # synthèse des mails en 1-2 phrases
    alerts: list[str]         # 0-3 alertes (conflit, échéance, sync en retard)

class DailyBriefResult(TypedDict):
    brief_id: str
    generated: bool
    degraded: bool

class DailyBriefState(TypedDict):
    context: BriefContext
    brief_content: BriefContent
    degraded: bool
    brief_id: str
    notified: bool
```

Invariants :

- `user_id` obligatoire partout, toutes les requêtes SQL scopées par `user_id` (cloisonnement strict).
- `brief_date` vient TOUJOURS du payload (le scheduler ou l'endpoint la calcule) — jamais d'horloge dans le workflow.
- Idempotency key runs planifiés : `(user_id, brief_date, "scheduled")` — contrainte d'unicité en BDD, upsert.
- Le contenu des mails/événements ne sort jamais dans les events/summaries Op (compteurs uniquement).
- `BriefContent` validé par schema Pydantic strict via `llm.parse` ; le brief dégradé est construit avec le MÊME schéma (compatible UI sans cas spécial).

## 5. Config SDK

| Clé | Type SDK | Défaut | Scope | Description | Secret |
| --- | --- | --- | --- | --- | --- |
| `llm_model` | `Choice(["claude-sonnet-4-5", "claude-haiku-4-5"])` | `claude-sonnet-4-5` | workflow | Modèle IA de rédaction (qualité par défaut : c'est le moment signature) | non |
| `max_priorities` | `IntRange(1, 5)` | `3` | workflow | Nombre max de priorités dans le brief | non |
| `tone` | `Choice(["neutre", "motivant", "direct"])` | `neutre` | workflow | Ton de rédaction du brief | non |
| `include_mails` | `Toggle` | `true` | workflow | Inclure la section mails importants | non |
| `lookahead_tomorrow` | `Toggle` | `true` | workflow | Mentionner les événements du lendemain matin | non |
| `notify_ready` | `Toggle` | `true` | workflow | Notifier quand le brief planifié est prêt | non |

```python
from agent_platform import Choice, IntRange, Toggle, configurable, workflow

@configurable({
    "llm_model": Choice(["claude-sonnet-4-5", "claude-haiku-4-5"], default="claude-sonnet-4-5", label="Modèle IA du brief"),
    "max_priorities": IntRange(1, 5, default=3, label="Priorités max dans le brief"),
    "tone": Choice(["neutre", "motivant", "direct"], default="neutre", label="Ton du brief"),
    "include_mails": Toggle(default=True, label="Inclure les mails importants"),
    "lookahead_tomorrow": Toggle(default=True, label="Mentionner le lendemain matin"),
    "notify_ready": Toggle(default=True, label="Notifier quand le brief est prêt"),
})
@workflow(name="daily_brief", version=1, description="Génère le brief du jour de l'utilisateur : priorités, planning, tâches et mails importants en une synthèse lisible.")
async def daily_brief(payload: dict, *, config: dict | None = None) -> dict:
    ...
```

## 6. HITL

Aucun HITL requis — le brief est un contenu informatif en lecture seule : il ne modifie rien, n'envoie rien à l'extérieur, ne prend aucune décision irréversible. L'utilisateur le lit (ou le régénère) dans l'UI.

Aucun `@safe_step` requis - aucun input métier corrigeable : les inputs sont des identifiants internes (`user_id`) et une date fournie par le système. En cas d'échec définitif, le run suivant (planifié ou manuel) régénère le brief.

## 7. Observability

- **Auto SDK** : `workflow.started`, `workflow.completed`, `workflow.failed`, durée, `workflow_id` — ne pas émettre manuellement.
- **Description Op du workflow** : « Génère le brief du jour de l'utilisateur : priorités, planning, tâches et mails importants en une synthèse lisible. »
- **Summaries Op obligatoires** (via `events.set_step_summary(...)`, chemins d'erreur et cas vides inclus) :
  - `collect_context` : « Contexte du jour chargé : {e} événements, {t} tâches, {m} mails importants » / « Journée calme : aucune donnée à synthétiser »
  - `compose_brief` : « Brief rédigé avec {p} priorités » / « Brief dégradé assemblé sans IA »
  - `persist_brief` : « Brief du {date} enregistré »
  - `notify_brief_ready` : « Notification de brief envoyée » / « Notification non nécessaire »
- **Événements métier** :
  - `daily_brief.generated` `{ user_id, trigger, degraded, priorities_count, events_count, tasks_count, mails_count, llm_calls, duration_ms }` — alimente le journal d'usage (`brief_generated`) et la baseline de coût IA.
- **Logs structurés** : `workflow_id`, `user_id`, `trigger`, `brief_date`, `degraded` — jamais de contenu de brief, de mail ni d'événement.
- **Métriques** : tokens/coût par brief, taux de briefs dégradés, latence totale, répartition des triggers.
- **Corrélation** : `user_id`, `workflow_id`, `brief_id`.

## 8. Recovery, retries et idempotence

| Risque | Détection | Retry | Idempotence | Compensation | Escalade |
| --- | --- | --- | --- | --- | --- |
| Crash en plein run | Reprise DBOS | steps complétés rejoués depuis le cache | upsert `(user_id, brief_date, trigger)` pour les planifiés | — | — |
| LLM indisponible / timeout | Exception `llm.parse` | 3 essais (backoff SDK) | — | Brief dégradé sans IA : listes brutes formatées dans le schéma `BriefContent`, `degraded=true` | métrique + summary « Brief dégradé assemblé sans IA » |
| Réponse LLM non parsable | Échec validation schema | 1 re-tentative format renforcé | — | brief dégradé idem | idem |
| BDD indisponible | Exception asyncpg | 3 essais | — | échec propre ; le dashboard garde le dernier brief connu | `workflow.failed` auto |
| Double déclenchement planifié (scheduler + retry infra) | même `(user_id, brief_date, "scheduled")` | — | upsert : le second run remplace le premier, pas de doublon | — | — |
| Données pas fraîches (sync Google en panne) | `last_sync_at` ancien dans `collect_context` | — | — | le brief est généré quand même AVEC une alerte « données non actualisées depuis {durée} » | alerte visible utilisateur |
| Core/observability indisponible | Échec émission event | best effort | — | le run continue, l'observabilité n'est jamais bloquante | — |

Timeouts : 10 s steps BDD, 45 s step LLM. Aucun appel externe non idempotent.

## 9. Sécurité et limites

- **Secrets requis** : `ANTHROPIC_API_KEY` via `os.environ` (Décision N). `DATABASE_URL` via config FastAPI. Aucun jeton Google manipulé (les données sont déjà en BDD).
- **Données personnelles** : le contexte (mails, événements) est de la PII — traité uniquement en BDD et dans l'appel LLM ; le brief généré est lui-même personnel, stocké scopé `user_id`, purgé à la suppression du compte.
- **Validation des inputs** : `user_id` UUID valide ; `trigger` ∈ {scheduled, manual, onboarding} ; `brief_date` au format ISO — rejet propre sinon.
- **Permissions opérateur HITL** : sans objet (aucun HITL).
- **Rate limits externes** : LLM uniquement — 1 appel par brief, volume naturellement borné (1-3 briefs/jour/utilisateur) ; garde-fou anti-spam côté endpoint manuel (max 1 régénération/minute).

## 10. Plan d'implémentation

- **Fichier workflow** : `backend/agents/daily_brief.py`
- **Tests** : `backend/tests/agents/test_daily_brief.py`
  - happy path : contexte riche → brief 3 priorités, persisté, notification créée (trigger scheduled)
  - journée calme : 0 événement, 0 tâche, 0 mail → brief « journée calme » généré quand même
  - LLM en erreur définitive → brief dégradé `degraded=true`, run terminé sans échec
  - re-run planifié même jour → upsert, un seul brief en BDD
  - trigger `manual` → pas de notification
  - sync Google en retard → alerte « données non actualisées » présente
- **Tests error_recovery / retry_with_input** : sans objet (aucun `@safe_step` — documenté section 6)
- **Fixtures/mocks** : `workflow_runner`, `mock_llm`, fixtures BDD (événements, tâches, mails triés)
- **Endpoints/API à connecter** :
  - scheduler FastAPI (cron) qui lance un run par utilisateur actif à son `brief_hour` (préférence utilisateur), en passant `brief_date` calculée côté scheduler ;
  - `POST /api/brief/generate` (régénération manuelle, auth `get_current_user`, anti-spam 1/minute) ;
  - appel en fin d'onboarding (après première sync Google réussie), `trigger="onboarding"`.
- **Critères d'acceptation** :
  - un brief existe toujours après un run, même sans données et même sans IA (dégradé)
  - zéro doublon de brief planifié pour un même jour
  - le brief d'onboarding apparaît dans la première session utilisateur
  - la timeline Op affiche un summary en français pour chaque step
  - `daily_brief.generated` alimente le journal d'usage

## 11. Détail par step

### `collect_context`

**Type SDK** : `@step` db
**Fonction cible** : `async def collect_context(user_id: str, brief_date: str, include_mails: bool, lookahead_tomorrow: bool) -> BriefContext`
**Responsabilité** : charger en une passe BDD tout le contexte du brief : événements du jour (00:00 → 23:59, fuseau de l'utilisateur, + lendemain 00:00 → 12:00 si `lookahead_tomorrow`), tâches dues aujourd'hui ou en retard triées par priorité puis échéance, mails importants non traités (statut `triaged`, score ≥ seuil de tri, non répondus, ≤ 7 jours), et l'horodatage de la dernière synchronisation Google réussie.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID valide, utilisateur actif |
| `input.brief_date` | payload initial | `str` | oui | format `YYYY-MM-DD` (fourni par l'appelant, jamais calculé ici) |
| `config.include_mails` | config SDK | `bool` | non (défaut `true`) | si `false` → `important_mails=[]` sans requête |
| `config.lookahead_tomorrow` | config SDK | `bool` | non (défaut `true`) | — |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.context` | workflow state | `BriefContext` | `{"events": [...], "tasks_due": [...], "important_mails": [...], "last_sync_at": "2026-07-09T07:55:00Z"}` | `compose_brief` |

Bornes de volume (pour garder le prompt LLM compact) : max 20 événements, 20 tâches, 10 mails — au-delà, tronqué par pertinence (événements les plus proches, tâches les plus prioritaires, mails les mieux scorés) avec compteur `truncated` par liste.

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="collect_context", retry_max_attempts=3, timeout_seconds=10)
async def collect_context(user_id: str, brief_date: str, include_mails: bool, lookahead_tomorrow: bool) -> dict:
    # 4 SELECT scopés par user_id : événements, tâches, mails triés, dernière sync
    context = ...
    if not (context["events"] or context["tasks_due"] or context["important_mails"]):
        events.set_step_summary("Journée calme : aucune donnée à synthétiser")
    else:
        events.set_step_summary(
            f"Contexte du jour chargé : {len(context['events'])} événements, "
            f"{len(context['tasks_due'])} tâches, {len(context['important_mails'])} mails importants"
        )
    return context
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres uniquement (pool asyncpg)
- Secrets : `DATABASE_URL` (config FastAPI)
- Idempotency key : lecture pure, sans effet
- Rate limit : aucun
- Compensation : aucune (lecture seule)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (`user_id` et `brief_date` sont fournis par le système)

#### Observability

- Summary Op : « Contexte du jour chargé : {e} événements, {t} tâches, {m} mails importants » / « Journée calme : aucune donnée à synthétiser »
- Events métier : aucun (compteurs repris dans `daily_brief.generated`)
- Logs structurés : `workflow_id`, `user_id`, `brief_date`, compteurs par liste + `truncated`
- Métriques : latence, taux de contextes vides
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | le dashboard garde le dernier brief connu | `workflow.failed` auto |
| Sync Google ancienne | `google_sync` en panne | pas une erreur : `last_sync_at` transmis tel quel | `compose_brief` ajoute l'alerte « données non actualisées » | alerte visible utilisateur |
| Contexte vide | journée sans données | retour normal, summary « Journée calme » | brief « journée calme » en aval | — |

#### Tests requis

- Cas nominal : contexte riche chargé et borné (20/20/10)
- `include_mails=false` → aucune requête mails, `important_mails=[]`
- Contexte totalement vide → summary « Journée calme », pas d'exception
- 35 tâches dues → 20 gardées (les plus prioritaires), `truncated` loggé
- BDD en erreur → 3 retries puis échec propre

---

### `compose_brief`

**Type SDK** : `@step` LLM
**Fonction cible** : `async def compose_brief(context: dict, llm_model: str, max_priorities: int, tone: str) -> dict`
**Responsabilité** : rédiger le brief en français via `llm.parse` (JSON strict conforme à `BriefContent`). Calcule d'abord les alertes déterministes en Python (conflit d'agenda = chevauchement d'événements ; échéance < 24 h ; `last_sync_at` > 2 h → « données non actualisées depuis {durée} ») et les passe au LLM pour intégration. Si le contexte est vide, produit le brief « journée calme ». En échec LLM définitif, assemble le brief dégradé sans IA.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `state.context` | `collect_context` | `BriefContext` | oui | listes éventuellement vides |
| `config.llm_model` | config SDK | `str` | non (défaut `claude-sonnet-4-5`) | ∈ Choice |
| `config.max_priorities` | config SDK | `int` | non (défaut 3) | 1-5 |
| `config.tone` | config SDK | `str` | non (défaut `neutre`) | ∈ {neutre, motivant, direct} |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.brief_content` | workflow state | `BriefContent` | `{"headline": "Matinée chargée, après-midi libre pour avancer.", "priorities": ["Répondre au mail du comptable avant midi", ...], ...}` | `persist_brief` |
| `state.degraded` | workflow state | `bool` | `false` | `persist_brief`, résultat final |

#### Implémentation SDK attendue

```python
from agent_platform import events, llm, step
from pydantic import BaseModel, Field

class BriefContentModel(BaseModel):
    headline: str = Field(max_length=140)
    priorities: list[str] = Field(min_length=1, max_length=5)
    schedule_summary: str = Field(max_length=400)
    tasks_summary: str = Field(max_length=280)
    mails_summary: str = Field(max_length=280)
    alerts: list[str] = Field(max_length=3)

@step(name="compose_brief", retry_max_attempts=3, timeout_seconds=45)
async def compose_brief(context: dict, llm_model: str, max_priorities: int, tone: str) -> dict:
    alerts = compute_deterministic_alerts(context)  # conflits, échéances, sync en retard — en Python
    try:
        parsed = await llm.parse(
            model=llm_model,
            messages=[{"role": "system", "content": build_system_prompt(tone, max_priorities)},
                      {"role": "user", "content": build_user_prompt(context, alerts)}],
            schema=BriefContentModel,
            response_format="json_object",
        )
        content, degraded = parsed.model_dump(), False
        events.set_step_summary(f"Brief rédigé avec {len(content['priorities'])} priorités")
    except LLMError:
        content, degraded = build_degraded_brief(context, alerts, max_priorities), True
        events.set_step_summary("Brief dégradé assemblé sans IA")
    return {"brief_content": content, "degraded": degraded}
```

#### Prompt / LLM

- **Model/config key** : `config.llm_model` (défaut `claude-sonnet-4-5`)
- **System prompt** (le bloc `{tone_instruction}` est substitué selon `config.tone`) :

```text
Tu rédiges le brief quotidien de MyDay, le cockpit personnel de l'utilisateur. Tu écris en français, à la deuxième personne (« tu »), au présent.

{tone_instruction}
- neutre : factuel et posé, sans exclamation.
- motivant : énergique et positif, sans être artificiel.
- direct : phrases courtes, droit au but.

Règles :
- "headline" : 1 phrase d'accroche qui donne la couleur de la journée (140 caractères max).
- "priorities" : les {max_priorities} actions les plus importantes MAINTENANT, formulées comme des actions concrètes (« Répondre au mail de X avant midi »), la plus urgente en premier. Croise les mails, les tâches et le planning pour choisir — c'est ta valeur ajoutée.
- "schedule_summary" : le déroulé du jour en 1 à 3 phrases (heures incluses). Mentionne le lendemain matin seulement s'il est fourni.
- "tasks_summary" : l'état des tâches en 1 à 2 phrases ; signale explicitement les retards.
- "mails_summary" : les mails qui attendent une action en 1 à 2 phrases ; si la liste est vide, écris que rien n'attend de réponse.
- "alerts" : recopie les alertes fournies (déjà calculées), reformulées naturellement, sans en inventer.
- Si toutes les listes sont vides : produis un brief « journée calme » qui le dit simplement et propose de profiter du temps disponible.
- N'invente JAMAIS un événement, une tâche ou un mail absent des données.

Réponds UNIQUEMENT avec le JSON demandé, sans texte autour.
```

- **User prompt template** :

```text
Brief du {brief_date} à générer. Données du cockpit au format JSON :

{"events": [{"title": "...", "start": "...", "end": "...", "location": "..."}, ...],
 "tomorrow_morning": [...],
 "tasks_due": [{"title": "...", "due": "...", "priority": "...", "overdue": true|false}, ...],
 "important_mails": [{"from": "...", "subject": "...", "summary": "...", "score": ...}, ...],
 "alerts": ["...", ...]}
```

- **Schema de sortie** : Pydantic `BriefContentModel` (bornes de longueur strictes, 1-5 priorités).
- **Parsing** : `llm.parse` strict ; si invalide → 1 re-tentative avec consigne « Ta réponse précédente était invalide, renvoie uniquement le JSON demandé » ; si encore invalide ou LLM indisponible après retries → `build_degraded_brief` : headline générique (« Voici ta journée en un coup d'œil. »), priorités = les `max_priorities` premières tâches/mails par priorité (règle déterministe), synthèses = listes formatées en phrases simples par template Python, alertes recopiées, `degraded=true`.

#### Tools et effets externes

- API : LLM via `agent_platform.llm` uniquement
- Secrets : `ANTHROPIC_API_KEY` via `os.environ` (Décision N)
- Idempotency key : aucun effet externe ; replay DBOS rejoue le résultat mémorisé
- Rate limit : 1 appel LLM par brief, volume borné (1-3 briefs/jour/utilisateur)
- Compensation : aucune

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (le contexte vient de la BDD ; le ton et le modèle se corrigent via la config SDK)

#### Observability

- Summary Op : « Brief rédigé avec {p} priorités » / « Brief dégradé assemblé sans IA »
- Events métier : aucun dédié (le flag `degraded` part dans `daily_brief.generated`)
- Logs structurés : `workflow_id`, `user_id`, `degraded`, `model`, tokens in/out, `alerts_count` — jamais le texte du brief
- Métriques : tokens/coût par brief, taux de dégradés, latence LLM
- Corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| LLM timeout/indisponible | panne fournisseur | retry 3x (backoff SDK) | brief dégradé sans IA, `degraded=true` | métrique + summary dédié |
| JSON invalide | réponse mal formée | 1 re-tentative format renforcé | brief dégradé | idem |
| Hallucination (élément inventé) | non-respect consigne | garde-fou : les priorités citant un élément absent des données sont remplacées par la règle déterministe | — | log warning |
| Contexte vide | journée calme | pas une erreur : brief « journée calme » via le LLM (ou dégradé) | — | — |
| Crash mid-step | process tué | replay DBOS : step rejoué (aucun effet externe) | — | — |

#### Tests requis

- Cas nominal : contexte riche → `BriefContent` valide, `degraded=false` (mock_llm)
- LLM en erreur définitive → brief dégradé complet, `degraded=true`, aucun champ vide
- Contexte vide → brief « journée calme »
- Réponse avec 7 priorités (> borne) → validation échoue → re-tentative
- `tone="direct"` → l'instruction de ton correspondante est bien injectée dans le system prompt

---

### `persist_brief`

**Type SDK** : `@step` db
**Fonction cible** : `async def persist_brief(user_id: str, brief_date: str, trigger: str, brief_content: dict, degraded: bool) -> dict`
**Responsabilité** : enregistrer le brief en BDD. Runs planifiés : upsert par `(user_id, brief_date, 'scheduled')` — un re-run remplace le brief du jour au lieu d'en créer un deuxième. Runs `manual`/`onboarding` : insertion d'une nouvelle row (l'utilisateur peut régénérer, l'historique Phase 2 les gardera).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID |
| `input.brief_date` | payload initial | `str` | oui | `YYYY-MM-DD` |
| `input.trigger` | payload initial | `str` | oui | ∈ {scheduled, manual, onboarding} |
| `state.brief_content` | `compose_brief` | `BriefContent` | oui | schéma déjà validé en amont |
| `state.degraded` | `compose_brief` | `bool` | oui | — |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.brief_id` | workflow state | `str` | UUID de la row brief | `notify_brief_ready`, résultat final |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="persist_brief", retry_max_attempts=3, timeout_seconds=10)
async def persist_brief(user_id: str, brief_date: str, trigger: str, brief_content: dict, degraded: bool) -> dict:
    # scheduled : INSERT ... ON CONFLICT (user_id, brief_date) WHERE type='scheduled' DO UPDATE
    # manual/onboarding : INSERT simple (type = trigger)
    brief_id = ...
    events.set_step_summary(f"Brief du {brief_date} enregistré")
    return {"brief_id": brief_id}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres (asyncpg)
- Secrets : `DATABASE_URL`
- Idempotency key : index d'unicité partiel `(user_id, brief_date)` pour `type='scheduled'` + upsert → replay et double déclenchement sans doublon
- Rate limit : aucun
- Compensation : transaction unique — tout ou rien

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Brief du {date} enregistré »
- Events métier : `daily_brief.generated` `{ user_id, trigger, degraded, priorities_count, events_count, tasks_count, mails_count, llm_calls, duration_ms }` — émis ici (dernier point où tous les compteurs existent) ; alimente le journal d'usage (`brief_generated`)
- Logs structurés : `workflow_id`, `user_id`, `brief_id`, `trigger`, `degraded`
- Métriques : latence
- Corrélation : `workflow_id`, `user_id`, `brief_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | le brief n'existe pas encore : le dashboard garde le précédent | `workflow.failed` auto |
| Replay après crash | DBOS | upsert rejoué (scheduled) ; pour manual/onboarding le replay DBOS retourne la row déjà créée sans ré-insérer | zéro doublon | — |
| Double déclenchement scheduler | cron + retry infra | second run → upsert remplace | un seul brief planifié par jour | — |

#### Tests requis

- Cas nominal : brief inséré, `brief_id` retourné
- Re-run scheduled même jour → une seule row, contenu remplacé
- Deux runs `manual` le même jour → deux rows distinctes
- Échec transactionnel → aucune row créée

---

### `notify_brief_ready`

**Type SDK** : `@step` db
**Fonction cible** : `async def notify_brief_ready(user_id: str, brief_id: str, trigger: str, notify_ready: bool) -> dict`
**Responsabilité** : créer la notification « Ton brief est prêt » (F10), uniquement pour `trigger="scheduled"` avec `notify_ready=true`. Le step écrit une row `notification` ; l'envoi push effectif est assuré par le service de notifications de l'app (hors workflow), comme pour `mail_triage`.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID |
| `state.brief_id` | `persist_brief` | `str` | oui | UUID |
| `input.trigger` | payload initial | `str` | oui | si ≠ `scheduled` → step sauté par le workflow |
| `config.notify_ready` | config SDK | `bool` | non (défaut `true`) | si `false` → step sauté par le workflow |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.notified` | workflow state | `bool` | `true` | résultat final |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="notify_brief_ready", retry_max_attempts=3, timeout_seconds=10)
async def notify_brief_ready(user_id: str, brief_id: str) -> dict:
    # INSERT ... ON CONFLICT (user_id, brief_id, type) DO NOTHING
    created = ...
    events.set_step_summary("Notification de brief envoyée" if created else "Notification non nécessaire")
    return {"notified": bool(created)}
```

(Le filtrage `trigger`/`notify_ready` est fait par le workflow en `if` Python AVANT d'appeler le step — le step reste simple.)

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres (row `notification`) — pas d'appel direct au service push
- Secrets : `DATABASE_URL`
- Idempotency key : unicité `(user_id, brief_id, type)` → replay sans double notification
- Rate limit : sans objet (1 notification max par brief planifié, 1 brief planifié par jour)
- Compensation : aucune (le service push lit les rows non envoyées)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Notification de brief envoyée » / « Notification non nécessaire »
- Events métier : aucun (l'envoi effectif est tracé par le service push)
- Logs structurés : `workflow_id`, `user_id`, `brief_id`, `created`
- Métriques : aucune dédiée
- Corrélation : `workflow_id`, `user_id`, `brief_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | le brief est déjà persisté — seule la notification manque, le brief reste visible sur le dashboard | `workflow.failed` auto |
| Replay après crash | DBOS | `ON CONFLICT DO NOTHING` | zéro double notification | — |

#### Tests requis

- Cas nominal (scheduled) : 1 notification créée
- `trigger="manual"` → step sauté par le workflow, 0 notification
- `notify_ready=false` → step sauté, 0 notification
- Replay → aucune notification en double

---

### Vérification croisée (faite)

- Tous les inputs ont un producteur (payload initial, step précédent ou config déclarée en section 5) ; tous les outputs sont consommés ou terminaux (`brief_id`, `notified`, `degraded` → résultat final).
- Toutes les clés de config sont consommées : `llm_model`, `max_priorities`, `tone` par `compose_brief` ; `include_mails`, `lookahead_tomorrow` par `collect_context` ; `notify_ready` par le `if` du workflow avant `notify_brief_ready`.
- Le step LLM a prompt système (avec variantes de ton), template, schema Pydantic borné et double fallback (re-tentative puis brief dégradé + garde-fou anti-hallucination).
- Les 4 steps ont un summary Op exact, chemins d'erreur et cas vides inclus.
- Les alertes sont calculées en Python déterministe (pas par le LLM) — le LLM ne fait que les reformuler.
- Aucun step n'a d'input métier corrigeable — documenté step par step, cohérent avec la section 6.
- Idempotence bout en bout : upsert brief planifié + `ON CONFLICT DO NOTHING` notification → un double déclenchement du scheduler ne produit ni doublon ni double notification.
