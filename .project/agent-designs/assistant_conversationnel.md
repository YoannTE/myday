---
kind: agent-platform-design
sdk: agent-platform
runtime: dbos
langgraph: false
workflow: assistant_conversationnel
status: validated
validated_at: "2026-07-09"
detail_validated_at: "2026-07-09"
---

# Agent Design : assistant_conversationnel

## 1. Vue d'ensemble

- **Workflow SDK** : `assistant_conversationnel`
- **Description Op** : « Traite un message de l'utilisateur à son assistant : comprend la demande, crée les tâches, événements ou notes demandés, prépare les mails et attend la validation avant tout envoi. »
- **Objectif métier** : le différenciateur n°1 de MyDay (F9) — l'utilisateur écrit en langage naturel (« ajoute le pain à ma liste », « cale un padel vendredi 18h », « réponds à ce mail pour dire que je suis d'accord ») et l'assistant exécute : création de tâches, d'événements (MyDay + Google Agenda), de notes, réponse à des questions sur ses données, rédaction de brouillons de mails. **Règle absolue : aucun mail ne part sans validation explicite de l'utilisateur** (pause HITL native).
- **Déclencheur** : API — un run par message utilisateur envoyé dans le chat (`POST /api/assistant/message`, auth `get_current_user`).
- **Entrée initiale** : `{ "user_id": str, "conversation_id": str, "message": str, "context_ref": { "mail_id": str | null, "event_id": str | null } }` (`context_ref` est rempli quand l'utilisateur lance l'assistant depuis un mail ou un événement précis, ex. « réponds à CE mail »).
- **Sortie finale** : `{ "reply": str, "actions_done": list[dict], "email_sent": bool, "clarification_needed": bool }`
- **Opérateurs humains** : l'utilisateur lui-même — il valide, modifie ou refuse les brouillons de mails (approbation dans l'UI du chat) ; il peut corriger les champs d'un envoi échoué (reprise sur erreur).
- **Volume / SLA** : quelques dizaines de messages/jour/utilisateur. Latence cible < 8 s pour une action simple (c'est un chat). Un brouillon en attente de validation peut rester en pause jusqu'à 24 h (configurable) avant annulation automatique.

## 2. Workflow SDK-native

Orchestration Python déterministe. Un run = un message utilisateur. Les clarifications ne bloquent PAS le run : si la demande est ambiguë, l'assistant répond par une question dans le chat et le run se termine (le message suivant de l'utilisateur est un nouveau run) — le HITL est réservé à la validation d'envoi de mail.

- Décorateur : `@workflow(name="assistant_conversationnel", version=1, description="Traite un message de l'utilisateur à son assistant : comprend la demande, crée les tâches, événements ou notes demandés, prépare les mails et attend la validation avant tout envoi.")`
- Fonction : `async def assistant_conversationnel(payload: dict, *, config: dict | None = None) -> dict`
- Branches conditionnelles : `if/elif` Python —
  - plan `clarification` → répondre par une question, terminer le run ;
  - boucle déterministe sur les actions planifiées (max `max_actions_per_message`), dispatch par type : `create_task` | `create_note` | `create_event` | `query_data` | `draft_email` ;
  - si un brouillon de mail existe ET `allow_email_send` → `wait_for_review` (pause HITL) → si approuvé → `send_email` ; si rejeté → pas d'envoi ; si modifié → envoi de la version éditée ;
  - `compose_reply` produit toujours la réponse du chat, quelle que soit la branche.
- Parallélisme : aucun — les actions d'un même message s'exécutent dans l'ordre demandé (volume faible, dépendances possibles entre actions).
- Persistance/reprise : DBOS — un crash pendant la pause de validation ne perd rien : le brouillon et la conversation reprennent où ils en étaient.

Séquence :

```
load_context → plan_actions (LLM)
  ├─ clarification → compose_reply → persist_turn (fin)
  └─ pour chaque action planifiée :
       create_task | create_note | query_data (db)
       create_event (db + Google Agenda, @safe_step)
       draft_email (LLM)
     → [si brouillon] review_email_draft (HITL wait_for_review)
       → [si approuvé] send_email (Gmail, @safe_step)
     → compose_reply (LLM) → persist_turn (db)
```

## 3. Steps

| Step SDK | Type | Responsabilité | Input | Output | Retry/timeout | Inputs corrigeables / safe_step | Observabilité |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `load_context` | db | Charger l'historique récent de la conversation (10 derniers tours), les préférences utilisateur, et le mail/événement référencé par `context_ref` s'il existe | `input.*` | `state.history`, `state.ref_data` | 3 essais, 10 s | Aucun input métier corrigeable | « Contexte de conversation chargé » |
| `plan_actions` | llm | Interpréter le message → plan JSON strict : liste d'actions typées avec leurs paramètres, ou demande de clarification si ambigu | `input.message`, `state.history`, `state.ref_data` | `state.plan` | 3 essais, 30 s | Aucun input métier corrigeable | « Demande comprise : {n} action(s) planifiée(s) » / « Demande ambiguë, clarification nécessaire » |
| `create_task` | db | Créer une tâche native (titre, priorité, échéance) — idempotent par `(user_id, action_key)` | `state.plan.actions[i]` | `state.action_results[i]` | 3 essais, 10 s | Aucun input métier corrigeable | « Tâche « {titre} » créée » |
| `create_note` | db | Créer ou compléter une note (ex. ajouter un article à la liste de courses) — idempotent par `(user_id, action_key)` | `state.plan.actions[i]` | `state.action_results[i]` | 3 essais, 10 s | Aucun input métier corrigeable | « Note « {titre} » mise à jour » |
| `create_event` | tool | Créer l'événement dans MyDay ET dans Google Agenda (écriture API Google, idempotente par UUID client) | `state.plan.actions[i]` | `state.action_results[i]` | 3 essais, 20 s | **`@safe_step` requis** — `recoverable_inputs={"title", "start", "end", "location"}` (l'utilisateur corrige et relance si Google refuse) | « Événement « {titre} » ajouté au planning » |
| `query_data` | db | Répondre à une question sur les données (« c'est quand mon prochain padel ? ») : requête scopée `user_id`, résultat brut passé à `compose_reply` | `state.plan.actions[i]` | `state.action_results[i]` | 3 essais, 10 s | Aucun input métier corrigeable | « Recherche effectuée dans le planning » |
| `draft_email` | llm | Rédiger le brouillon (nouvelle rédaction ou réponse au mail `context_ref`) : destinataire, objet, corps en français | `state.plan.actions[i]`, `state.ref_data` | `state.draft` | 3 essais, 45 s | Aucun input métier corrigeable | « Brouillon de mail préparé pour {destinataire} » |
| `review_email_draft` | hitl | Pause `wait_for_review` : le brouillon complet est soumis à l'utilisateur dans le chat (approuver / modifier / refuser) | `state.draft` | `state.review` | timeout `hitl_timeout_hours` (défaut 24 h) → annulation | — (primitive HITL, pas un @step) | visible comme pending input dans la vue Op |
| `send_email` | tool | Envoyer le mail approuvé via l'API Gmail (version éditée si l'utilisateur a modifié) ; at-most-once via machine à états du brouillon | `state.draft`, `state.review` | `state.sent` | 3 essais, 20 s | **`@safe_step` requis** — `recoverable_inputs={"to", "subject", "body"}` (correction + relance si l'envoi échoue) | « Mail envoyé à {destinataire} » |
| `compose_reply` | llm | Rédiger la réponse du chat : confirmation des actions faites, réponse à la question, ou question de clarification | `state.plan`, `state.action_results`, `state.sent` | `state.reply` | 3 essais, 30 s ; fallback : confirmation template sans IA | Aucun input métier corrigeable | « Réponse de l'assistant rédigée » |
| `persist_turn` | db | Enregistrer le tour de conversation (message, réponse, actions effectuées) — idempotent par `(conversation_id, turn_key)` | `state.*` | `state.turn_id` | 3 essais, 10 s | Aucun input métier corrigeable | « Conversation enregistrée » |

Aucun step parallélisable (ordre des actions significatif, volume faible).

## 4. State et contrats de données

```python
from typing import NotRequired, TypedDict

class AssistantInput(TypedDict):
    user_id: str            # UUID utilisateur MyDay
    conversation_id: str    # UUID de la conversation
    message: str            # message brut de l'utilisateur
    context_ref: dict       # {"mail_id": str | None, "event_id": str | None}

class PlannedAction(TypedDict):
    type: str               # "create_task" | "create_note" | "create_event" | "query_data" | "draft_email"
    action_key: str         # UUID généré au plan — idempotency key de l'action
    params: dict            # paramètres typés selon l'action

class ActionPlan(TypedDict):
    intent: str             # "actions" | "question" | "clarification"
    actions: list[PlannedAction]      # vide si clarification
    clarification_question: NotRequired[str]

class EmailDraft(TypedDict):
    draft_id: str           # UUID — clé de la machine à états d'envoi
    to: str
    subject: str
    body: str
    in_reply_to_mail_id: NotRequired[str]   # si réponse à un mail existant

class AssistantResult(TypedDict):
    reply: str
    actions_done: list[dict]
    email_sent: bool
    clarification_needed: bool

class AssistantState(TypedDict):
    history: list[dict]
    ref_data: dict
    plan: ActionPlan
    action_results: list[dict]
    draft: NotRequired[EmailDraft]
    review: NotRequired[dict]    # {"decision": "approved"|"rejected"|"edited", "edited_content": ...}
    sent: bool
    reply: str
    turn_id: str
```

Invariants :

- `user_id` obligatoire partout, toutes les requêtes scopées `user_id` (cloisonnement strict) ; `context_ref` vérifié comme appartenant à `user_id` dans `load_context`.
- Idempotency keys : `action_key` (UUID généré par `plan_actions`, un par action) pour tâches/notes/événements ; `draft_id` pour la machine à états d'envoi (`draft → pending_review → approved → sent` / `rejected` / `expired`) ; `(conversation_id, turn_key)` pour le tour de conversation.
- L'événement Google est créé avec un identifiant client dérivé de `action_key` → replay sans doublon dans Google Agenda.
- `send_email` ne s'exécute QUE si la machine à états du brouillon est en `approved` — jamais d'envoi sans décision explicite (règle métier absolue).
- Aucun contenu de mail/message dans les events ni les summaries Op (destinataire tronqué au domaine si besoin : « mail envoyé à j…@gmail.com »).

## 5. Config SDK

| Clé | Type SDK | Défaut | Scope | Description | Secret |
| --- | --- | --- | --- | --- | --- |
| `llm_model` | `Choice(["claude-sonnet-4-5", "claude-opus-4-5"])` | `claude-sonnet-4-5` | workflow | Modèle IA de l'assistant (compréhension + rédaction) | non |
| `max_actions_per_message` | `IntRange(1, 5)` | `3` | workflow | Nombre max d'actions exécutées pour un seul message | non |
| `allow_email_send` | `Toggle` | `true` | workflow | Autoriser l'envoi de mails (si désactivé : brouillons seulement, jamais d'étape d'envoi) | non |
| `hitl_timeout_hours` | `IntRange(1, 72)` | `24` | step `review_email_draft` | Délai avant annulation automatique d'un brouillon non validé | non |
| `reply_tone` | `Choice(["naturel", "concis"])` | `naturel` | step `compose_reply` | Style des réponses du chat | non |

```python
from agent_platform import Choice, IntRange, Toggle, configurable, workflow

@configurable({
    "llm_model": Choice(["claude-sonnet-4-5", "claude-opus-4-5"], default="claude-sonnet-4-5", label="Modèle IA de l'assistant"),
    "max_actions_per_message": IntRange(1, 5, default=3, label="Actions max par message"),
    "allow_email_send": Toggle(default=True, label="Autoriser l'envoi de mails"),
    "hitl_timeout_hours": IntRange(1, 72, default=24, label="Délai de validation des brouillons (heures)"),
    "reply_tone": Choice(["naturel", "concis"], default="naturel", label="Style des réponses"),
})
@workflow(name="assistant_conversationnel", version=1, description="Traite un message de l'utilisateur à son assistant : comprend la demande, crée les tâches, événements ou notes demandés, prépare les mails et attend la validation avant tout envoi.")
async def assistant_conversationnel(payload: dict, *, config: dict | None = None) -> dict:
    ...
```

## 6. HITL

| ID | Primitive SDK | Moment | Question | Options | Timeout | Reprise | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `review_email_draft` | `wait_for_review` | après `draft_email`, avant `send_email` | « Relis ce mail avant envoi » (contenu = brouillon complet : destinataire, objet, corps) | approve / reject + édition du contenu | `hitl_timeout_hours` (défaut 24 h) | `state.review` : `approved` → envoi de la version (éditée ou non) ; `rejected` → pas d'envoi, brouillon marqué `rejected` | timeout → brouillon marqué `expired`, message dans le chat « Le brouillon a expiré sans validation, rien n'a été envoyé » |

L'UI du chat affiche la pause comme une carte de validation (brouillon + boutons Approuver / Modifier / Refuser).

Steps `@safe_step(recoverable_inputs={...})` (reprise sur erreur, distincte du HITL volontaire) :

- `create_event` : champs corrigeables `title`, `start`, `end`, `location` — si l'API Google refuse (créneau invalide, format), l'utilisateur corrige et relance (`retry_with_input`).
- `send_email` : champs corrigeables `to`, `subject`, `body` — si l'envoi Gmail échoue (adresse invalide, quota), l'utilisateur corrige et relance.

## 7. Observability

- **Auto SDK** : `workflow.started`, `workflow.completed`, `workflow.failed`, durée, `workflow_id` ; le pending input HITL est visible dans la vue Op.
- **Description Op du workflow** : « Traite un message de l'utilisateur à son assistant : comprend la demande, crée les tâches, événements ou notes demandés, prépare les mails et attend la validation avant tout envoi. »
- **Summaries Op obligatoires** (via `events.set_step_summary(...)`, chemins d'erreur inclus) :
  - `load_context` : « Contexte de conversation chargé »
  - `plan_actions` : « Demande comprise : {n} action(s) planifiée(s) » / « Demande ambiguë, clarification nécessaire »
  - `create_task` : « Tâche « {titre} » créée »
  - `create_note` : « Note « {titre} » mise à jour »
  - `create_event` : « Événement « {titre} » ajouté au planning »
  - `query_data` : « Recherche effectuée dans le planning »
  - `draft_email` : « Brouillon de mail préparé pour {destinataire tronqué} »
  - `send_email` : « Mail envoyé à {destinataire tronqué} »
  - `compose_reply` : « Réponse de l'assistant rédigée »
  - `persist_turn` : « Conversation enregistrée »
- **Événements métier** :
  - `assistant.message_processed` `{ user_id, conversation_id, intent, actions_count, email_drafted, email_sent, clarification, llm_calls, duration_ms }` — alimente le journal d'usage (`assistant_message_sent`)
  - `assistant.email_review` `{ user_id, decision, edited, latency_to_decision_ms }` — mesure la confiance dans les brouillons (taux d'approbation sans édition)
- **Logs structurés** : `workflow_id`, `user_id`, `conversation_id`, `intent`, types d'actions — jamais le texte des messages ni des mails.
- **Métriques** : tokens/coût par message, répartition des intents, taux de clarification, taux d'approbation des brouillons, latence de bout en bout.
- **Corrélation** : `user_id`, `workflow_id`, `conversation_id`, `draft_id`.

## 8. Recovery, retries et idempotence

| Risque | Détection | Retry | Idempotence | Compensation | Escalade |
| --- | --- | --- | --- | --- | --- |
| Crash en plein run (y compris pendant la pause HITL) | Reprise DBOS | steps complétés rejoués depuis le cache ; la pause HITL survit au redémarrage | `action_key` par action, `draft_id`, `(conversation_id, turn_key)` | — | — |
| LLM indisponible (plan) | Exception `llm.parse` | 3 essais | — | réponse chat « Je n'ai pas réussi à traiter ta demande, réessaie » — AUCUNE action exécutée sans plan valide | `workflow.failed` si définitif |
| Plan non parsable / action inconnue | validation schema | 1 re-tentative format renforcé | — | actions inconnues ignorées + mention dans la réponse | log warning |
| API Google Agenda refuse l'événement | erreur 4xx | pas de retry aveugle sur 4xx | id client dérivé d'`action_key` → replay sans doublon | **`@safe_step`** : formulaire de correction (`title`, `start`, `end`, `location`) + `retry` / `retry_with_input` / `cancel` | pending `error_recovery` visible Op + chat |
| Envoi Gmail échoue | erreur API | 3 essais sur 5xx | machine à états `draft_id` : jamais deux envois (transition `approved → sent` verrouillée en BDD avant l'appel API) | **`@safe_step`** : correction (`to`, `subject`, `body`) + relance | pending `error_recovery` |
| Brouillon jamais validé | timeout `wait_for_review` | — | — | brouillon `expired`, message chat explicite, rien n'est envoyé | — |
| Double soumission du même message (double-clic) | `turn_key` dérivé du message côté endpoint | — | contrainte d'unicité `(conversation_id, turn_key)` | second run court-circuité | — |
| Core/observability indisponible | échec émission event | best effort | — | le run continue | — |

Timeouts : 10 s steps BDD, 30-45 s steps LLM, 20 s appels Google, pause HITL bornée par `hitl_timeout_hours`.

## 9. Sécurité et limites

- **Secrets requis** : `ANTHROPIC_API_KEY` via `os.environ` (Décision N) ; jetons Google de l'utilisateur lus via le service interne de connexions (chiffrés en BDD, jamais dans le state du workflow ni les logs).
- **Données personnelles** : messages, brouillons et mails = PII — uniquement BDD + appels LLM/Google ; summaries Op avec destinataire tronqué ; purge à la suppression du compte.
- **Validation des inputs** : `message` non vide, ≤ 4000 caractères ; `context_ref` vérifié comme appartenant à `user_id` ; `conversation_id` appartenant à `user_id`.
- **Permissions opérateur HITL** : seul l'utilisateur propriétaire de la conversation voit et tranche ses pending inputs (brouillons, corrections d'erreur) — l'admin n'y a jamais accès.
- **Rate limits externes** : Gmail send (quota par utilisateur — les erreurs de quota passent par la reprise `@safe_step`) ; garde-fou côté endpoint : max 10 messages/minute/utilisateur.
- **Garde-fou métier absolu** : `allow_email_send=false` retire l'étape d'envoi du chemin d'exécution — même un plan LLM erroné ne peut pas envoyer de mail.

## 10. Plan d'implémentation

- **Fichier workflow** : `backend/agents/assistant_conversationnel.py` (si > 150 lignes : steps découpés dans `backend/agents/assistant_steps/`, un fichier par domaine)
- **Tests** : `backend/tests/agents/test_assistant_conversationnel.py`
  - happy path actions : « ajoute le pain à ma liste et cale un padel vendredi 18h » → note mise à jour + événement créé (MyDay + mock Google), réponse de confirmation
  - happy path mail : « réponds à ce mail pour dire oui » → brouillon → `mock_hitl` approuve → envoi mock → confirmation
  - refus HITL : brouillon rejeté → aucun envoi, brouillon `rejected`
  - édition HITL : brouillon modifié → la version éditée est envoyée
  - timeout HITL : brouillon `expired`, aucun envoi
  - clarification : message ambigu → question en retour, aucune action
  - erreur LLM au plan : réponse d'excuse, aucune action exécutée
  - idempotence : replay du run → aucune tâche/note/événement/mail en double
- **Tests error_recovery / retry_with_input** (obligatoires — 2 `@safe_step`) :
  - `create_event` : Google refuse → pending `error_recovery` avec formulaire (`title`, `start`, `end`, `location`) → `retry_with_input` corrige et aboutit
  - `send_email` : adresse invalide → pending `error_recovery` (`to`, `subject`, `body`) → correction → envoi ; et `cancel` → brouillon abandonné proprement
- **Fixtures/mocks** : `workflow_runner`, `mock_llm`, `mock_hitl` (via `agent_platform.testing`), mock API Google Agenda + Gmail
- **Endpoints/API à connecter** :
  - `POST /api/assistant/message` (auth, anti-spam 10/min) → lance le run
  - endpoints Core existants pour répondre aux pending inputs (approbation brouillon, correction d'erreur) — l'UI du chat les consomme
- **Critères d'acceptation** :
  - AUCUN chemin de code ne peut envoyer un mail sans passage par `wait_for_review` approuvé
  - un crash serveur pendant une validation en attente ne perd ni le brouillon ni la conversation
  - chaque action est idempotente (replay sans doublon, y compris dans Google Agenda)
  - la timeline Op affiche chaque étape en français métier
  - `assistant.message_processed` alimente le journal d'usage

## 11. Détail par step

### `load_context`

**Type SDK** : `@step` db
**Fonction cible** : `async def load_context(user_id: str, conversation_id: str, context_ref: dict) -> dict`
**Responsabilité** : charger les 10 derniers tours de la conversation, les préférences utilisateur utiles (prénom, fuseau horaire), et — si `context_ref` pointe un mail ou un événement — la donnée référencée complète (après vérification qu'elle appartient bien à `user_id`).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID, utilisateur actif |
| `input.conversation_id` | payload initial | `str` | oui | UUID, appartient à `user_id` (sinon erreur 403 propre) |
| `input.context_ref` | payload initial | `dict` | oui (peut être `{"mail_id": null, "event_id": null}`) | ids appartenant à `user_id`, sinon ignorés + log warning |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.history` | workflow state | `list[dict]` | `[{"role": "user", "content": "...", "at": "..."}, ...]` (10 max) | `plan_actions`, `compose_reply` |
| `state.ref_data` | workflow state | `dict` | `{"mail": {"from": "...", "subject": "...", "body_excerpt": "..."}}` ou `{}` | `plan_actions`, `draft_email` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="load_context", retry_max_attempts=3, timeout_seconds=10)
async def load_context(user_id: str, conversation_id: str, context_ref: dict) -> dict:
    # SELECT scopés user_id : 10 derniers tours, préférences, mail/événement référencé
    ...
    events.set_step_summary("Contexte de conversation chargé")
    return {"history": history, "ref_data": ref_data}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres uniquement
- Secrets : `DATABASE_URL`
- Idempotency key : lecture pure
- Rate limit : aucun
- Compensation : aucune

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Contexte de conversation chargé »
- Events métier : aucun
- Logs structurés : `workflow_id`, `user_id`, `conversation_id`, `history_len`, `has_ref`
- Métriques : latence
- Corrélation : `workflow_id`, `user_id`, `conversation_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | message d'erreur générique dans le chat côté endpoint | `workflow.failed` auto |
| `context_ref` étranger | id d'un autre utilisateur | ref ignorée, `ref_data={}` | le plan traite le message sans référence | log warning |

#### Tests requis

- Cas nominal : historique + ref mail chargés
- `conversation_id` d'un autre utilisateur → erreur propre, aucun accès
- `context_ref.mail_id` étranger → ignoré, `ref_data={}`
- Conversation neuve → `history=[]`, pas d'exception

---

### `plan_actions`

**Type SDK** : `@step` LLM
**Fonction cible** : `async def plan_actions(message: str, history: list, ref_data: dict, llm_model: str, max_actions: int, allow_email_send: bool) -> ActionPlan`
**Responsabilité** : interpréter le message en plan d'actions JSON strict. C'est le SEUL step qui décide quoi faire ; toute la suite est un dispatch Python déterministe. Génère un `action_key` (UUID) par action — clé d'idempotence de toute la chaîne.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.message` | payload initial | `str` | oui | non vide, ≤ 4000 caractères |
| `state.history` | `load_context` | `list[dict]` | oui | peut être vide |
| `state.ref_data` | `load_context` | `dict` | oui | peut être vide |
| `config.llm_model` | config SDK | `str` | non (défaut `claude-sonnet-4-5`) | ∈ Choice |
| `config.max_actions_per_message` | config SDK | `int` | non (défaut 3) | 1-5 |
| `config.allow_email_send` | config SDK | `bool` | non (défaut `true`) | si `false`, l'action `draft_email` reste permise (brouillon seulement) — l'information est donnée au LLM pour qu'il l'annonce |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.plan` | workflow state | `ActionPlan` | `{"intent": "actions", "actions": [{"type": "create_event", "action_key": "uuid", "params": {"title": "Padel", "start": "2026-07-11T18:00", "end": "2026-07-11T19:30"}}]}` | dispatch du workflow, `compose_reply`, `persist_turn` |

#### Implémentation SDK attendue

```python
from agent_platform import events, llm, step
from pydantic import BaseModel, Field
from typing import Literal

class PlannedActionModel(BaseModel):
    type: Literal["create_task", "create_note", "create_event", "query_data", "draft_email"]
    action_key: str
    params: dict

class ActionPlanModel(BaseModel):
    intent: Literal["actions", "question", "clarification"]
    actions: list[PlannedActionModel] = Field(max_length=5)
    clarification_question: str | None = None

@step(name="plan_actions", retry_max_attempts=3, timeout_seconds=30)
async def plan_actions(message, history, ref_data, llm_model, max_actions, allow_email_send) -> dict:
    parsed = await llm.parse(
        model=llm_model,
        messages=[{"role": "system", "content": build_planner_prompt(max_actions, allow_email_send)},
                  {"role": "user", "content": build_planner_input(message, history, ref_data)}],
        schema=ActionPlanModel,
        response_format="json_object",
    )
    plan = validate_and_truncate(parsed, max_actions)  # params typés par action, actions inconnues écartées
    if plan["intent"] == "clarification":
        events.set_step_summary("Demande ambiguë, clarification nécessaire")
    else:
        events.set_step_summary(f"Demande comprise : {len(plan['actions'])} action(s) planifiée(s)")
    return plan
```

#### Prompt / LLM

- **Model/config key** : `config.llm_model` (défaut `claude-sonnet-4-5`)
- **System prompt** :

```text
Tu es le planificateur de l'assistant MyDay, le cockpit personnel de l'utilisateur. Tu transformes son message en plan d'actions JSON. Tu ne réponds JAMAIS en texte libre.

Actions disponibles :
- "create_task" : params {"title": str, "priority": "haute"|"normale"|"basse", "due": "YYYY-MM-DD" | null}
- "create_note" : params {"note_title": str, "content_to_add": str} — pour ajouter à une note existante (ex. liste de courses), reprends son titre exact s'il apparaît dans l'historique
- "create_event" : params {"title": str, "start": "YYYY-MM-DDTHH:MM", "end": "YYYY-MM-DDTHH:MM", "location": str | null} — durée par défaut 1h si non précisée
- "query_data" : params {"entity": "events"|"tasks"|"notes"|"mails", "question": str} — pour répondre à une question sur ses données
- "draft_email" : params {"to": str | null, "subject": str | null, "instruction": str, "reply_to_ref": true|false} — reply_to_ref=true si l'utilisateur répond au mail fourni en référence

Règles :
- "intent" : "actions" si au moins une action, "question" si uniquement query_data, "clarification" si la demande est ambiguë (destinataire inconnu, date impossible à déduire, action floue).
- Maximum {max_actions} actions par message. Si l'utilisateur en demande plus, garde les premières et signale-le via une action de moins.
- "action_key" : génère un UUID v4 unique par action.
- Les dates relatives (« vendredi », « demain ») se résolvent avec la date du jour fournie dans le message d'entrée. Ne devine JAMAIS une date ambiguë : demande une clarification.
- N'invente JAMAIS un destinataire de mail : s'il n'est ni dans le message, ni dans le mail de référence, ni dans l'historique → clarification.
- En cas de clarification : "actions": [] et "clarification_question" en français, une seule question précise.
{email_send_note}

Réponds UNIQUEMENT avec le JSON demandé.
```

(`{email_send_note}` = « Note : l'envoi de mails est désactivé — les brouillons seront préparés mais non envoyés, dis-le si un mail est demandé. » quand `allow_email_send=false`, sinon vide.)

- **User prompt template** :

```text
Date du jour : {today} ({weekday}), fuseau {timezone}.

Historique récent de la conversation :
{history_formatted}

{ref_block : « Mail en référence : de {from}, objet « {subject} », extrait : {body_excerpt} » si présent}

Message de l'utilisateur : {message}
```

- **Schema de sortie** : Pydantic `ActionPlanModel` strict (`Literal` sur les types, max 5 actions) + validation seconde passe des `params` par type d'action (schémas dédiés) — une action aux params invalides est écartée et signalée.
- **Parsing** : `llm.parse` strict ; 1 re-tentative format renforcé ; échec définitif → le workflow répond « Je n'ai pas réussi à traiter ta demande, peux-tu reformuler ? » et AUCUNE action n'est exécutée (jamais de plan deviné hors LLM).

#### Tools et effets externes

- API : LLM via `agent_platform.llm` uniquement
- Secrets : `ANTHROPIC_API_KEY` via `os.environ`
- Idempotency key : aucun effet externe ; les `action_key` générés ici sont mémorisés par DBOS (replay = mêmes clés)
- Rate limit : 1 appel LLM par message
- Compensation : aucune

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (le message utilisateur n'est pas « corrigeable » par un opérateur : en cas d'ambiguïté le flux passe par la clarification conversationnelle)

#### Observability

- Summary Op : « Demande comprise : {n} action(s) planifiée(s) » / « Demande ambiguë, clarification nécessaire »
- Events métier : aucun dédié (repris dans `assistant.message_processed`)
- Logs structurés : `workflow_id`, `user_id`, `intent`, types d'actions, `discarded_actions` — jamais le texte du message
- Métriques : tokens, taux de clarification, taux d'actions écartées
- Corrélation : `workflow_id`, `user_id`, `conversation_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| LLM indisponible | panne | retry 3x | réponse d'excuse, zéro action | `workflow.failed` évité : le run se termine proprement avec `clarification_needed=true` |
| JSON invalide | mauvais format | 1 re-tentative renforcée | idem | log warning |
| Params invalides sur une action | hallucination | action écartée par la validation seconde passe | les actions valides s'exécutent, l'écart est mentionné dans la réponse | log warning |
| Date ambiguë devinée | non-respect consigne | garde-fou : date dans le passé ou > 1 an → action convertie en clarification | — | — |

#### Tests requis

- Cas nominal multi-actions : « ajoute le pain à ma liste et cale un padel vendredi 18h » → 2 actions typées, 2 `action_key` distincts
- Question : « c'est quand mon prochain padel ? » → intent `question`, 1 `query_data`
- Ambiguïté : « envoie un mail à Paul » sans Paul connu → clarification
- LLM en erreur → excuse, zéro action
- 6 actions demandées, max 3 → 3 gardées
- Date passée retournée → convertie en clarification

---

### `create_task`

**Type SDK** : `@step` db
**Fonction cible** : `async def create_task(user_id: str, action_key: str, params: dict) -> dict`
**Responsabilité** : créer une tâche native MyDay (origine `assistant`). Idempotent : contrainte d'unicité `(user_id, action_key)` sur la table des tâches (colonne `assistantActionKey`).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID |
| `state.plan.actions[i].action_key` | `plan_actions` | `str` | oui | UUID |
| `state.plan.actions[i].params` | `plan_actions` | `dict` | oui | `title` non vide ≤ 200 car., `priority` ∈ {haute, normale, basse}, `due` ISO ou null |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.action_results[i]` | workflow state | `dict` | `{"type": "create_task", "ok": true, "task_id": "...", "title": "Acheter le pain"}` | `compose_reply`, `persist_turn` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="create_task", retry_max_attempts=3, timeout_seconds=10)
async def create_task(user_id: str, action_key: str, params: dict) -> dict:
    # INSERT ... ON CONFLICT (user_id, assistant_action_key) DO NOTHING RETURNING id
    ...
    events.set_step_summary(f"Tâche « {params['title'][:60]} » créée")
    return {"type": "create_task", "ok": True, "task_id": task_id, "title": params["title"]}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres
- Secrets : `DATABASE_URL`
- Idempotency key : `(user_id, action_key)`
- Rate limit : aucun
- Compensation : aucune (création simple, visible et supprimable dans l'UI)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (une tâche mal formulée se corrige dans l'UI to-do en un clic — pas de formulaire error_recovery pour un INSERT local)

#### Observability

- Summary Op : « Tâche « {titre tronqué 60} » créée »
- Events métier : aucun dédié ; logs : `workflow_id`, `user_id`, `task_id` ; métriques : compteur d'actions par type ; corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | l'action est signalée en échec dans la réponse du chat | `workflow.failed` si toutes les actions échouent |
| Replay | crash | `ON CONFLICT DO NOTHING` + relecture | zéro doublon | — |

#### Tests requis

- Cas nominal ; replay → une seule tâche ; `due` null accepté ; titre > 200 caractères → tronqué

---

### `create_note`

**Type SDK** : `@step` db
**Fonction cible** : `async def create_note(user_id: str, action_key: str, params: dict) -> dict`
**Responsabilité** : ajouter du contenu à une note existante (correspondance par titre insensible à la casse, ex. « Liste de courses ») ou créer la note si elle n'existe pas. L'ajout est journalisé dans la table `note_appends` avec `action_key` unique — un replay ne ré-ajoute pas la même ligne.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID |
| `state.plan.actions[i].action_key` | `plan_actions` | `str` | oui | UUID |
| `state.plan.actions[i].params` | `plan_actions` | `dict` | oui | `note_title` non vide, `content_to_add` non vide ≤ 2000 car. |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.action_results[i]` | workflow state | `dict` | `{"type": "create_note", "ok": true, "note_id": "...", "created": false, "title": "Liste de courses"}` | `compose_reply`, `persist_turn` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="create_note", retry_max_attempts=3, timeout_seconds=10)
async def create_note(user_id: str, action_key: str, params: dict) -> dict:
    # transaction : upsert note par (user_id, lower(title)) + INSERT note_appends ON CONFLICT (action_key) DO NOTHING
    ...
    events.set_step_summary(f"Note « {params['note_title'][:60]} » mise à jour")
    return {"type": "create_note", "ok": True, "note_id": note_id, "created": created, "title": params["note_title"]}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres ; Secrets : `DATABASE_URL` ; Idempotency key : `action_key` dans `note_appends` ; Rate limit : aucun ; Compensation : aucune (édition visible dans l'UI notes)

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable (une note s'édite directement dans l'UI)

#### Observability

- Summary Op : « Note « {titre tronqué 60} » mise à jour »
- Logs : `workflow_id`, `user_id`, `note_id`, `created` ; métriques : compteur par type ; corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | action signalée en échec dans la réponse | — |
| Replay | crash | `ON CONFLICT (action_key) DO NOTHING` | zéro double ajout | — |
| Deux notes au même titre | données historiques | la plus récemment modifiée gagne | — | log warning |

#### Tests requis

- Ajout à note existante ; création si absente ; replay → un seul ajout ; correspondance insensible à la casse

---

### `create_event`

**Type SDK** : `@step` tool — **`@safe_step` requis**
**Fonction cible** : `async def create_event(user_id: str, action_key: str, title: str, start: str, end: str, location: str | None) -> dict`
**Responsabilité** : créer l'événement dans MyDay (BDD) puis dans Google Agenda (API `events.insert`). L'id client Google est dérivé d'`action_key` → l'insertion Google est idempotente. La row MyDay stocke le `googleEventId` retourné (source `MyDay`, la sync ultérieure la reconnaît).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID, connexion Google active |
| `state.plan.actions[i].action_key` | `plan_actions` | `str` | oui | UUID |
| `params.title` | `plan_actions` | `str` | oui | non vide ≤ 200 car. |
| `params.start` / `params.end` | `plan_actions` | `str` | oui | ISO datetime, `end > start`, pas dans le passé |
| `params.location` | `plan_actions` | `str \| None` | non | ≤ 200 car. |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.action_results[i]` | workflow state | `dict` | `{"type": "create_event", "ok": true, "event_id": "...", "google_event_id": "...", "title": "Padel"}` | `compose_reply`, `persist_turn` |

#### Implémentation SDK attendue

```python
from agent_platform import Text, events, safe_step

@safe_step(
    recoverable_inputs={
        "title": Text(label="Titre de l'événement", description="Titre à corriger si Google refuse l'événement.", required=True),
        "start": Text(label="Début (AAAA-MM-JJTHH:MM)", description="Date et heure de début à corriger.", required=True),
        "end": Text(label="Fin (AAAA-MM-JJTHH:MM)", description="Date et heure de fin à corriger.", required=True),
        "location": Text(label="Lieu", description="Lieu de l'événement (optionnel).", required=False),
    },
    retry_max_attempts=3,
)
async def create_event(user_id: str, action_key: str, title: str, start: str, end: str, location: str | None) -> dict:
    import httpx  # httpx autorisé dans @step
    # 1) UPSERT row MyDay par (user_id, assistant_action_key)
    # 2) POST Google events.insert avec id client dérivé d'action_key (jeton via service connexions)
    # 3) UPDATE row MyDay avec google_event_id
    ...
    events.set_step_summary(f"Événement « {title[:60]} » ajouté au planning")
    return {"type": "create_event", "ok": True, "event_id": event_id, "google_event_id": gid, "title": title}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- APIs : Postgres + Google Calendar API (`events.insert`)
- Secrets : jeton OAuth de l'utilisateur via le service interne de connexions (chiffré, jamais dans le state) ; `DATABASE_URL`
- Idempotency key : id client Google dérivé d'`action_key` + upsert BDD `(user_id, assistant_action_key)`
- Rate limit : quotas Google Calendar (largement suffisants à ce volume) ; 429 → retry avec backoff
- Compensation : si Google échoue définitivement après création de la row MyDay → la row reste en `sync_pending` et `google_sync` retentera la remontée ; en cas de `cancel` opérateur → row MyDay supprimée

#### HITL

Aucun HITL dans ce step (la reprise sur erreur `@safe_step` n'est pas un HITL volontaire).

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : **oui**
- Inputs métier corrigeables : `title`, `start`, `end`, `location`
- `recoverable_inputs` exact attendu : voir bloc d'implémentation ci-dessus (types SDK `Text`). Le Core affiche `retry`, `retry_with_input` (formulaire prérempli par `current_inputs`) et `cancel`.

#### Observability

- Summary Op : « Événement « {titre tronqué 60} » ajouté au planning »
- Events métier : aucun dédié ; logs : `workflow_id`, `user_id`, `event_id`, `google_status` ; métriques : taux d'échec Google ; corrélation : `workflow_id`, `user_id`
- En pending `error_recovery` : visible dans la vue Op ET signalé dans le chat (« L'événement n'a pas pu être créé, corrige les informations »)

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| Google 4xx (données refusées) | date invalide, calendrier absent | pas de retry aveugle → pending `error_recovery` | formulaire de correction (`retry_with_input`) ou `cancel` | visible Op + chat |
| Google 5xx / réseau | panne temporaire | retry 3x backoff | si définitif : row `sync_pending`, remontée par `google_sync` | log + métrique |
| Jeton révoqué | utilisateur a déconnecté Google | détection 401 | événement créé dans MyDay seulement + message « reconnecte ton compte Google » | notification reconnexion |
| Replay | crash | id client idempotent → Google ne duplique pas | zéro doublon | — |

#### Tests requis

- Cas nominal : row MyDay + insert Google mocké + `google_event_id` stocké
- Google 400 → pending `error_recovery` avec formulaire ; `retry_with_input` corrigé → succès
- `cancel` → row MyDay supprimée proprement
- Jeton révoqué → événement local + signalement, pas d'échec du run
- Replay → un seul événement Google (id client)

---

### `query_data`

**Type SDK** : `@step` db
**Fonction cible** : `async def query_data(user_id: str, params: dict) -> dict`
**Responsabilité** : exécuter une recherche en lecture seule sur les données de l'utilisateur selon `params.entity` (events futurs par mot-clé, tâches ouvertes, notes par titre/contenu, mails triés par expéditeur/objet). Retourne des résultats bruts bornés (10 max) que `compose_reply` transformera en réponse naturelle.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` | payload initial | `str` | oui | UUID |
| `params.entity` | `plan_actions` | `str` | oui | ∈ {events, tasks, notes, mails} |
| `params.question` | `plan_actions` | `str` | oui | non vide — mots-clés extraits en Python (pas de SQL généré par le LLM, JAMAIS) |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.action_results[i]` | workflow state | `dict` | `{"type": "query_data", "ok": true, "entity": "events", "results": [{"title": "Padel", "start": "..."}], "truncated": false}` | `compose_reply` |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="query_data", retry_max_attempts=3, timeout_seconds=10)
async def query_data(user_id: str, params: dict) -> dict:
    # requêtes préparées par entity, mots-clés en ILIKE paramétré, LIMIT 10, scope user_id
    ...
    events.set_step_summary("Recherche effectuée dans le planning")
    return {"type": "query_data", "ok": True, "entity": params["entity"], "results": results, "truncated": truncated}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres (requêtes préparées uniquement — le LLM ne produit jamais de SQL) ; Secrets : `DATABASE_URL` ; lecture pure ; pas de rate limit ; pas de compensation

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Recherche effectuée dans le planning »
- Logs : `workflow_id`, `user_id`, `entity`, `result_count` ; corrélation : `workflow_id`, `user_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | réponse « je n'arrive pas à consulter tes données » | — |
| Zéro résultat | rien ne correspond | retour normal `results=[]` | `compose_reply` répond « je n'ai rien trouvé » | — |

#### Tests requis

- Cas nominal : « prochain padel » → événement trouvé ; zéro résultat ; entity invalide → écartée en amont par la validation du plan

---

### `draft_email`

**Type SDK** : `@step` LLM
**Fonction cible** : `async def draft_email(user_id: str, params: dict, ref_data: dict, llm_model: str) -> EmailDraft`
**Responsabilité** : rédiger le brouillon complet (destinataire, objet, corps en français). En mode réponse (`reply_to_ref=true`), reprend le fil du mail de référence (destinataire = expéditeur d'origine, objet préfixé « Re: »). Le brouillon est persisté en BDD avec statut `pending_review` AVANT la pause HITL (survit au crash, visible dans l'UI).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `params.instruction` | `plan_actions` | `str` | oui | non vide (« dire que je suis d'accord pour vendredi ») |
| `params.to` / `params.subject` | `plan_actions` | `str \| None` | non | si `reply_to_ref=false`, `to` obligatoire (garanti par le planificateur, sinon clarification en amont) |
| `params.reply_to_ref` | `plan_actions` | `bool` | oui | si `true`, `state.ref_data.mail` doit exister |
| `state.ref_data` | `load_context` | `dict` | non | mail de référence complet |
| `config.llm_model` | config SDK | `str` | non | ∈ Choice |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.draft` | workflow state + BDD (statut `pending_review`) | `EmailDraft` | `{"draft_id": "...", "to": "paul@ex.com", "subject": "Re: Devis", "body": "Bonjour Paul, ..."}` | `review_email_draft`, `send_email`, `persist_turn` |

#### Implémentation SDK attendue

```python
from agent_platform import events, llm, step
from pydantic import BaseModel, Field

class EmailDraftModel(BaseModel):
    to: str
    subject: str = Field(max_length=200)
    body: str = Field(max_length=5000)

@step(name="draft_email", retry_max_attempts=3, timeout_seconds=45)
async def draft_email(user_id: str, params: dict, ref_data: dict, llm_model: str) -> dict:
    parsed = await llm.parse(model=llm_model, messages=[...], schema=EmailDraftModel, response_format="json_object")
    draft = persist_draft(user_id, parsed)  # INSERT statut pending_review, draft_id UUID
    events.set_step_summary(f"Brouillon de mail préparé pour {truncate_email(draft['to'])}")
    return draft
```

#### Prompt / LLM

- **Model/config key** : `config.llm_model` (défaut `claude-sonnet-4-5`)
- **System prompt** :

```text
Tu rédiges des mails pour l'utilisateur de MyDay, en son nom. Tu écris en français naturel et correctement accentué.

Règles :
- "to" : le destinataire fourni — ne l'invente JAMAIS, ne le modifie JAMAIS.
- "subject" : objet court et clair ; en mode réponse, reprends l'objet d'origine préfixé « Re: » (sans doubler le préfixe).
- "body" : le message. Ton naturel et poli, ni ampoulé ni familier. Va droit au but en 2 à 8 phrases. Termine par une formule brève et la signature « {user_first_name} ».
- Respecte fidèlement l'instruction de l'utilisateur — n'ajoute aucun engagement qu'il n'a pas exprimé.
- En mode réponse, appuie-toi sur le mail d'origine fourni pour le contexte.

Réponds UNIQUEMENT avec le JSON demandé.
```

- **User prompt template** :

```text
Instruction de l'utilisateur : {instruction}
Destinataire : {to}
{reply_block : « Mail d'origine — De : {from} ; Objet : {subject} ; Corps : {body_excerpt 1500 car.} » si reply_to_ref}
Prénom du signataire : {user_first_name}
```

- **Schema de sortie** : Pydantic `EmailDraftModel` (bornes strictes).
- **Parsing** : `llm.parse` strict ; garde-fou post-parsing : `to` doit être IDENTIQUE au destinataire fourni (sinon écrasé par la valeur sûre) ; 1 re-tentative si invalide ; échec définitif → pas de brouillon, l'action est signalée en échec dans la réponse du chat (jamais de brouillon template).

#### Tools et effets externes

- APIs : LLM + Postgres (persistance du brouillon)
- Secrets : `ANTHROPIC_API_KEY`
- Idempotency key : `draft_id` dérivé d'`action_key` → replay ne crée pas deux brouillons
- Rate limit : 1 appel LLM
- Compensation : brouillon abandonné → statut `rejected`/`expired`, jamais supprimé silencieusement

#### HITL

Aucun HITL dans ce step (la pause est le step suivant `review_email_draft`).

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable à ce stade (le brouillon est précisément soumis à validation/édition humaine juste après — c'est le HITL qui porte la correction)

#### Observability

- Summary Op : « Brouillon de mail préparé pour {destinataire tronqué : `p…@ex.com`} »
- Logs : `workflow_id`, `user_id`, `draft_id`, `reply_mode` — jamais le corps ; métriques : tokens ; corrélation : `workflow_id`, `user_id`, `draft_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| LLM en échec définitif | panne | retry 3x | pas de brouillon, échec signalé dans le chat | — |
| Destinataire modifié par le LLM | hallucination | garde-fou post-parsing : valeur sûre réécrite | — | log warning |
| Replay | crash | `draft_id` idempotent | un seul brouillon | — |

#### Tests requis

- Rédaction libre ; mode réponse (Re:, contexte repris) ; LLM altère `to` → réécrit ; LLM en panne → échec propre ; replay → un brouillon

---

### `review_email_draft`

**Type SDK** : HITL — `wait_for_review`
**Fonction cible** : appel direct dans le corps du workflow (pas un `@step`) :
`review = await wait_for_review(content=state.draft, prompt="Relis ce mail avant envoi")`
**Responsabilité** : suspendre le run jusqu'à la décision de l'utilisateur. L'UI du chat affiche le pending input comme carte de validation : destinataire, objet, corps, boutons **Approuver / Modifier / Refuser** (Modifier = édition du contenu puis approbation de la version éditée — capacité native de `wait_for_review`).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `state.draft` | `draft_email` | `EmailDraft` | oui | statut BDD `pending_review` |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.review` | workflow state | `dict` | `{"decision": "approved", "edited_content": {"to": "...", "subject": "...", "body": "..."} \| null}` | branche `if` du workflow, `send_email`, `persist_turn` |

#### Implémentation SDK attendue

```python
from agent_platform import wait_for_review

# Dans le corps du @workflow (pas dans un @step) :
review = await wait_for_review(
    content={"to": draft["to"], "subject": draft["subject"], "body": draft["body"]},
    prompt="Relis ce mail avant envoi",
)
# review.decision ∈ {"approved", "rejected"} ; review.edited_content si modifié
# timeout géré par la plateforme selon hitl_timeout_hours → décision "expired"
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- Aucun appel externe — pending input persisté par la plateforme (topic DBOS interne au SDK, ne pas hardcoder)
- Transition BDD du brouillon : `pending_review → approved | rejected | expired` (écrite par le workflow au réveil)

#### HITL

- **Primitive** : `wait_for_review`
- **Payload envoyé** : le brouillon complet (`to`, `subject`, `body`) + prompt « Relis ce mail avant envoi »
- **Options** : approve / reject, avec édition possible du contenu avant approve
- **Timeout** : `config.hitl_timeout_hours` (défaut 24 h) → décision `expired`, rien n'est envoyé, message chat « Le brouillon a expiré sans validation, rien n'a été envoyé »
- **Reprise** : `state.review` ; le run survit aux redéploiements/crashs pendant la pause (DBOS)

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non (primitive HITL, pas un step d'exécution)
- Inputs métier corrigeables : sans objet — l'édition du brouillon EST le mécanisme de correction

#### Observability

- Le pending input est visible nativement dans la vue Op (et rendu dans le chat MyDay)
- Event métier au réveil : `assistant.email_review` `{ user_id, decision, edited, latency_to_decision_ms }`
- Logs : `workflow_id`, `user_id`, `draft_id`, `decision` ; corrélation : `workflow_id`, `draft_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| Crash pendant la pause | redéploiement | DBOS restaure la pause, rien n'est perdu | — | — |
| Timeout | utilisateur absent | décision `expired` | brouillon `expired`, message chat, aucun envoi | — |
| Double réponse (deux onglets) | UI | la plateforme n'accepte que la première décision | — | — |

#### Tests requis

- Approve → `send_email` appelé ; reject → aucun envoi, statut `rejected` ; edited → version éditée envoyée ; timeout → `expired`, message chat ; crash pendant la pause → reprise correcte (mock_hitl)

---

### `send_email`

**Type SDK** : `@step` tool — **`@safe_step` requis**
**Fonction cible** : `async def send_email(user_id: str, draft_id: str, to: str, subject: str, body: str, in_reply_to_mail_id: str | None) -> dict`
**Responsabilité** : envoyer le mail approuvé (version éditée si édition) via l'API Gmail (`messages.send`, avec en-têtes de fil si réponse). Protection at-most-once : transition BDD `approved → sending` verrouillée (UPDATE conditionnel) AVANT l'appel API ; si la transition échoue (déjà `sent`), le step retourne le résultat existant sans renvoyer.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `state.draft.draft_id` | `draft_email` | `str` | oui | statut BDD `approved` |
| `to` / `subject` / `body` | `state.review.edited_content` si édité, sinon `state.draft` | `str` | oui | `to` = adresse email valide ; bornes de longueur |
| `state.draft.in_reply_to_mail_id` | `draft_email` | `str \| None` | non | si présent : en-têtes `In-Reply-To`/`References` repris du mail d'origine |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.sent` | workflow state | `bool` | `true` | `compose_reply`, résultat final |
| BDD | statut brouillon | — | `sent` + `gmail_message_id` | UI mails |

#### Implémentation SDK attendue

```python
from agent_platform import Email, LongText, Text, events, safe_step

@safe_step(
    recoverable_inputs={
        "to": Email(label="Destinataire", description="Adresse à corriger si l'envoi échoue.", required=True),
        "subject": Text(label="Objet", description="Objet du mail, modifiable avant un nouvel essai.", required=True),
        "body": LongText(label="Corps du mail", description="Contenu métier modifiable avant un nouvel essai.", required=True),
    },
    retry_max_attempts=3,
)
async def send_email(user_id: str, draft_id: str, to: str, subject: str, body: str, in_reply_to_mail_id: str | None) -> dict:
    import httpx  # httpx autorisé dans @step
    # 1) UPDATE drafts SET status='sending' WHERE id=draft_id AND status='approved' — si 0 row : déjà traité, court-circuit
    # 2) POST Gmail messages.send (jeton via service connexions)
    # 3) UPDATE status='sent', gmail_message_id=...
    ...
    events.set_step_summary(f"Mail envoyé à {truncate_email(to)}")
    return {"sent": True, "gmail_message_id": gmail_id}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- APIs : Gmail API `messages.send` + Postgres (machine à états)
- Secrets : jeton OAuth utilisateur via le service interne de connexions ; `DATABASE_URL`
- Idempotency key : machine à états `draft_id` (`approved → sending → sent`) — Gmail n'a pas de clé d'idempotence native, la transition BDD verrouillée garantit l'at-most-once ; le replay DBOS retourne le résultat mémorisé sans rappeler l'API
- Rate limit : quota Gmail send — 429/403 quota → pending `error_recovery` (pas de retry aveugle)
- Compensation : si l'API échoue APRÈS la transition `sending` sans confirmation → statut `sending_unconfirmed`, vérification au run suivant de `google_sync` (recherche du message dans Sent) avant tout renvoi

#### HITL

Aucun HITL dans ce step (l'approbation a eu lieu au step précédent).

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : **oui**
- Inputs métier corrigeables : `to`, `subject`, `body`
- `recoverable_inputs` exact attendu : voir bloc d'implémentation (types SDK `Email`, `Text`, `LongText`). Actions Core : `retry`, `retry_with_input` (formulaire prérempli), `cancel` (brouillon → `rejected`).

#### Observability

- Summary Op : « Mail envoyé à {destinataire tronqué} »
- Events métier : compteur `email_sent` dans `assistant.message_processed` ; alimente le journal d'usage (`mail_replied` si réponse)
- Logs : `workflow_id`, `user_id`, `draft_id`, `gmail_message_id` — jamais le corps ; métriques : taux d'échec d'envoi ; corrélation : `workflow_id`, `draft_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| Adresse invalide (4xx) | faute de frappe | pas de retry aveugle → pending `error_recovery` | correction `to` + relance | visible Op + chat |
| Quota Gmail (429/403) | limite atteinte | pending `error_recovery` | `retry` plus tard ou `cancel` | idem |
| 5xx / réseau | panne temporaire | retry 3x backoff | si envoi non confirmé : `sending_unconfirmed`, vérification anti-doublon avant renvoi | log + métrique |
| Jeton révoqué | déconnexion Google | 401 → pending `error_recovery` | message « reconnecte ton compte Google » | notification |
| Replay après succès | crash post-envoi | transition BDD court-circuite | zéro double envoi | — |

#### Tests requis

- Cas nominal : envoi mock, statut `sent` ; adresse invalide → `error_recovery` + `retry_with_input` → succès ; `cancel` → `rejected` ; replay après envoi → aucun second appel API ; version éditée → contenu édité envoyé ; en-têtes de fil corrects en mode réponse

---

### `compose_reply`

**Type SDK** : `@step` LLM
**Fonction cible** : `async def compose_reply(message: str, plan: dict, action_results: list, review: dict | None, sent: bool, reply_tone: str, llm_model: str) -> dict`
**Responsabilité** : rédiger la réponse du chat en français : confirmation des actions réussies, mention claire des échecs, réponse en langage naturel aux `query_data`, ou question de clarification (reprise telle quelle du plan). Fallback sans IA : confirmation par template à partir des `action_results`.

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.message` | payload initial | `str` | oui | — |
| `state.plan` | `plan_actions` | `ActionPlan` | oui | — |
| `state.action_results` | steps d'action | `list[dict]` | oui | peut être vide (clarification) |
| `state.review` / `state.sent` | HITL / `send_email` | `dict \| None` / `bool` | non | — |
| `config.reply_tone` / `config.llm_model` | config SDK | `str` | non | ∈ Choice |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.reply` | workflow state | `str` | « C'est fait : le pain est sur ta liste de courses et ton padel est calé vendredi à 18h. » | `persist_turn`, résultat final |

#### Implémentation SDK attendue

```python
from agent_platform import events, llm, step

@step(name="compose_reply", retry_max_attempts=3, timeout_seconds=30)
async def compose_reply(message, plan, action_results, review, sent, reply_tone, llm_model) -> dict:
    try:
        r = await llm.complete(model=llm_model, messages=[...])
        reply = r.content.strip()
    except LLMError:
        reply = build_template_reply(action_results, review, sent)  # « ✓ Tâche créée : ... » par template
    events.set_step_summary("Réponse de l'assistant rédigée")
    return {"reply": reply}
```

#### Prompt / LLM

- **Model/config key** : `config.llm_model` ; ton selon `config.reply_tone`
- **System prompt** :

```text
Tu es l'assistant MyDay. Tu confirmes à l'utilisateur ce qui vient d'être fait, en français, à la deuxième personne.

Règles :
- Style {reply_tone} : « naturel » = une ou deux phrases chaleureuses et simples ; « concis » = une phrase factuelle.
- Confirme UNIQUEMENT les actions dont le résultat fourni indique ok=true. Une action en échec est signalée honnêtement avec sa raison simple.
- Pour une recherche (query_data), réponds à la question à partir des résultats fournis — si la liste est vide, dis que tu n'as rien trouvé. N'invente JAMAIS une donnée.
- Pour une clarification, pose uniquement la question fournie dans le plan.
- Si un brouillon attend validation, dis-le (« Je t'ai préparé le mail, valide-le pour l'envoyer »). S'il a été refusé ou a expiré, confirme que rien n'est parti.
- Pas de listes à puces pour une ou deux actions ; pas d'emphase excessive.
```

- **User prompt template** :

```text
Message de l'utilisateur : {message}
Plan : {plan_json}
Résultats des actions : {action_results_json}
Validation de mail : {review_json | "aucune"}
Mail envoyé : {sent}
```

- **Schema de sortie** : texte libre via `llm.complete` (pas de JSON — c'est la réponse du chat), borné à 1000 caractères (tronqué proprement sinon).
- **Parsing** : sortie vide ou > 1000 car. après nettoyage → fallback template.

#### Tools et effets externes

- API : LLM ; Secrets : `ANTHROPIC_API_KEY` ; aucun effet externe ; pas de compensation

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Réponse de l'assistant rédigée »
- Logs : `workflow_id`, `user_id`, `fallback_used` ; métriques : tokens, taux de fallback ; corrélation : `workflow_id`, `conversation_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| LLM en échec définitif | panne | retry 3x | réponse template à partir des `action_results` — l'utilisateur est TOUJOURS informé | métrique |
| Réponse contredisant les résultats | hallucination | prompt strict + les actions ok/échec viennent des données | template si détection d'incohérence grossière (mention d'action absente) | log warning |

#### Tests requis

- Confirmation multi-actions ; échec partiel signalé ; réponse à une question avec résultats ; clarification reprise telle quelle ; LLM en panne → template complet

---

### `persist_turn`

**Type SDK** : `@step` db
**Fonction cible** : `async def persist_turn(user_id: str, conversation_id: str, turn_key: str, message: str, reply: str, plan: dict, action_results: list, sent: bool) -> dict`
**Responsabilité** : enregistrer le tour complet dans la conversation (message utilisateur, réponse assistant, actions et leurs résultats) et émettre l'événement récapitulatif du run. Idempotent par `(conversation_id, turn_key)` (le `turn_key` est dérivé du message côté endpoint — protège aussi du double-clic).

#### Contrat d'entrée

| Champ | Source | Type | Obligatoire | Validation |
| --- | --- | --- | --- | --- |
| `input.user_id` / `input.conversation_id` | payload initial | `str` | oui | UUID |
| `input.turn_key` | payload initial (endpoint) | `str` | oui | unique par tour |
| `state.reply`, `state.plan`, `state.action_results`, `state.sent` | steps précédents | — | oui | — |

#### Contrat de sortie

| Champ | Destination | Type | Exemple | Consommateurs |
| --- | --- | --- | --- | --- |
| `state.turn_id` | workflow state | `str` | UUID | résultat final |

#### Implémentation SDK attendue

```python
from agent_platform import events, step

@step(name="persist_turn", retry_max_attempts=3, timeout_seconds=10)
async def persist_turn(user_id, conversation_id, turn_key, message, reply, plan, action_results, sent) -> dict:
    # INSERT ... ON CONFLICT (conversation_id, turn_key) DO NOTHING RETURNING id
    ...
    events.emit("assistant.message_processed", {
        "user_id": user_id, "conversation_id": conversation_id,
        "intent": plan["intent"], "actions_count": len(action_results),
        "email_drafted": any(r["type"] == "create_draft" for r in action_results) or "draft" in plan_types,
        "email_sent": sent, "clarification": plan["intent"] == "clarification",
    })
    events.set_step_summary("Conversation enregistrée")
    return {"turn_id": turn_id}
```

#### Prompt / LLM

N/A

#### Tools et effets externes

- API : Postgres ; Secrets : `DATABASE_URL` ; Idempotency key : `(conversation_id, turn_key)` ; pas de rate limit ; pas de compensation

#### HITL

Aucun HITL dans ce step.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : non
- Inputs métier corrigeables : Aucun input métier corrigeable

#### Observability

- Summary Op : « Conversation enregistrée »
- Events métier : `assistant.message_processed` (émis ici — dernier point où tout est connu) — alimente le journal d'usage (`assistant_message_sent`)
- Logs : `workflow_id`, `user_id`, `conversation_id`, `turn_id` ; corrélation : `workflow_id`, `conversation_id`

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK | Fallback | Escalade |
| --- | --- | --- | --- | --- |
| BDD indisponible | Postgres down | retry 3x puis fail | les actions sont déjà faites ; l'UI ré-affiche depuis le résultat du run | `workflow.failed` auto |
| Replay | crash | `ON CONFLICT DO NOTHING` | un seul tour enregistré | — |

#### Tests requis

- Cas nominal ; replay → un seul tour ; event `assistant.message_processed` émis avec les bons compteurs

---

### Vérification croisée (faite)

- Tous les inputs ont un producteur (payload initial, step précédent, config section 5) ; tous les outputs sont consommés ou terminaux.
- Toutes les clés de config sont consommées : `llm_model` (plan, draft, reply), `max_actions_per_message` + `allow_email_send` (plan + branche workflow), `hitl_timeout_hours` (review), `reply_tone` (reply).
- Les 3 steps LLM ont prompt système, template, schema/bornes et stratégie parsing/fallback ; garde-fous anti-hallucination : destinataire verrouillé, dates absurdes → clarification, confirmations issues des données.
- Les 2 `@safe_step` (`create_event`, `send_email`) ont leurs `recoverable_inputs` complets en types SDK, avec actions `retry`/`retry_with_input`/`cancel` — pas de `try/except` + `wait_for_input` simulé.
- Le HITL `review_email_draft` utilise la primitive native `wait_for_review` dans le corps du workflow, avec timeout configuré et les 3 issues (approuvé/édité/refusé) + expiration testées.
- Chaîne d'idempotence complète : `action_key` (tâches, notes, événements Google), `draft_id` + machine à états (envoi at-most-once), `(conversation_id, turn_key)` (tour).
- Chaque step a un summary Op exact en français, chemins d'erreur inclus ; les destinataires sont tronqués dans tous les summaries/logs.
- Aucun input métier corrigeable sur les autres steps — documenté explicitement step par step.
