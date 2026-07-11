Conçoit un workflow agent-platform SDK-native dans .project/agent-design.md, sans LangGraph


Commande dédiée à la conception d'un workflow d'agents IA **SDK-native agent-platform**.
Produit uniquement `.project/agent-design.md` comme source de vérité, sans LangGraph,
sans Mermaid obligatoire, sans `.mmd`.

Arguments Claude Code :

- `$1` = nom du workflow cible en snake_case ou kebab-case, ex: `qualify_lead`
- `${@:2}` = brief libre / contraintes métier optionnelles
- `$@` = tous les arguments bruts

Invocation : `/agent-design <workflow-name> [brief libre]`

Workflow demandé : `$1`
Brief utilisateur : `${@:2}`

---

## Règles non négociables

1. Ne jamais proposer LangGraph, `StateGraph`, nodes/edges LangGraph, ni imports directs `dbos`, `langgraph`, `litellm`.
2. Cibler le SDK `agent_platform` : `@workflow`, `@step`, `@configurable`, `llm`, HITL (`wait_for_input`, `wait_for_review`, `wait_for_signal`), `parallel()` si nécessaire.
3. Prévoir dès le design la lisibilité Op : `@workflow(..., description="...")` obligatoire en français métier, et un `events.set_step_summary(...)` attendu pour chaque step observable.
4. Prévoir dès le design la reprise sur erreur : tout step à inputs métier corrigeables doit déclarer `@safe_step` requis et `recoverable_inputs={...}` ; sinon écrire `Aucun input métier corrigeable`.
5. Produire ou mettre à jour `.project/agent-design.md` immédiatement après chaque étape validée.
6. Si `.project/agent-design.md` existe, le relire d'abord et proposer une modification ciblée plutôt qu'une régénération totale.
7. Le design doit être directement consommable par `agent-platform-developer` pour coder `backend/agents/<workflow>.py`.

---

## Prérequis

Lire, si présents :

- `.project/decisions.md`, surtout `## Agent Platform`
- `.project/app.md`
- `.project/patterns.md`
- `starterkit/.claude/rules/agent-platform.md` ou `.claude/rules/agent-platform.md`
- `sdk/README.md` et `sdk/docs/observability.md` si disponibles

Si `.project/decisions.md` ne contient pas `## Agent Platform`, arrêter avec :

> La section `## Agent Platform` est absente de `.project/decisions.md`.
> Lance d'abord `/start-structure`, puis relance `/agent-design $1`.

---

## Format obligatoire de `.project/agent-design.md`

Créer le fichier avec ce frontmatter YAML exact :

```yaml
---
kind: agent-platform-design
sdk: agent-platform
runtime: dbos
langgraph: false
workflow: $1
status: draft
validated_at: ""
detail_validated_at: ""
---
```

Puis les sections suivantes, dans cet ordre exact :

````markdown
# Agent Design : $1

## 1. Vue d'ensemble

- **Workflow SDK** : `$1`
- **Description Op** : phrase courte en français pour `@workflow(description="...")`
- **Objectif métier** : ...
- **Déclencheur** : API | cron | webhook | action utilisateur | autre
- **Entrée initiale** : payload attendu
- **Sortie finale** : résultat attendu
- **Opérateurs humains** : rôles impliqués
- **Volume / SLA** : runs/jour, latence cible, contraintes

## 2. Workflow SDK-native

Décrire l'orchestration Python déterministe :

- Décorateur : `@workflow(name="$1", version=1, description="<description Op en français>")`
- Fonction : `async def $1(input: dict) -> dict`
- Branches conditionnelles : `if/else` Python
- Parallélisme : `parallel()` ou sous-workflows SDK si branches indépendantes
- Persistance/reprise : assurée par DBOS via le SDK

## 3. Steps

| Step SDK    | Type                               | Responsabilité | Input     | Output    | Retry/timeout | Inputs corrigeables / safe_step                                | Observabilité                         |
| ----------- | ---------------------------------- | -------------- | --------- | --------- | ------------- | -------------------------------------------------------------- | ------------------------------------- |
| `step_name` | pure/llm/tool/hitl/db/sub_workflow | ...            | `state.x` | `state.y` | ...           | `recoverable_inputs={...}` ou `Aucun input métier corrigeable` | summary Op attendu + event/metric/log |

Règles :

- chaque step correspond à une fonction `@step`, `@safe_step` ou à un appel HITL explicite ;
- tout step à inputs métier corrigeables doit être marqué `@safe_step` requis avec les champs `recoverable_inputs` attendus ;
- les steps LLM utilisent `agent_platform.llm`, jamais LiteLLM direct ;
- les steps sans dépendance doivent être marqués comme parallélisables.

## 4. State et contrats de données

```python
from typing import TypedDict, NotRequired

class <WorkflowName>Input(TypedDict):
    ...

class <WorkflowName>Result(TypedDict):
    ...

class <WorkflowName>State(TypedDict):
    ...
```
````

Lister aussi les invariants de state : champs obligatoires, champs optionnels,
formats JSON, idempotency keys, tenant/user ids.

## 5. Config SDK

Décrire les paramètres configurables via `@configurable({...})`.

| Clé     | Type SDK | Défaut | Scope         | Description | Secret |
| ------- | -------- | ------ | ------------- | ----------- | ------ |
| `model` | `Choice` | ...    | workflow/step | ...         | non    |

Inclure le squelette attendu :

```python
from agent_platform import configurable, workflow, step, Choice, IntRange, Toggle, Secret

@configurable({
    # champs globaux et/ou sections par step
})
@workflow(name="$1", version=1, description="<description Op en français>")
async def $1(input: dict) -> dict:
    ...
```

## 6. HITL

Pour chaque pause humaine volontaire et chaque reprise sur erreur métier :

| ID         | Primitive SDK     | Moment       | Question | Options        | Timeout | Reprise     | Fallback |
| ---------- | ----------------- | ------------ | -------- | -------------- | ------- | ----------- | -------- |
| `review_x` | `wait_for_review` | après `step` | ...      | approve/reject | ...     | champ state | ...      |

Si aucun HITL volontaire : écrire explicitement `Aucun HITL requis`.
Si aucun step n'a d'input métier corrigeable : écrire explicitement `Aucun @safe_step requis - aucun input métier corrigeable`.
Sinon lister les steps `@safe_step(recoverable_inputs={...})` et les champs corrigibles.

## 7. Observability

Préciser ce qui est automatique par le SDK et ce qui doit être ajouté au niveau métier.

- Auto SDK : `workflow.started`, `workflow.completed`, `workflow.failed`, durée, workflow_id.
- Description Op du workflow : phrase exacte à mettre dans `@workflow(description="...")`, en français métier.
- Steps : timeline `step.started/completed/failed` si disponible SDK.
- Summaries Op obligatoires : pour chaque step observable, phrase attendue pour `events.set_step_summary(...)`, courte, au présent, en français, sans secret ni payload volumineux.
- Événements métier à émettre : ...
- Logs structurés : clés obligatoires.
- Métriques : compteurs, latence, taux d'erreur, coûts LLM, tokens.
- Corrélation : tenant_id, user_id, workflow_id, external_id.

## 8. Recovery, retries et idempotence

| Risque | Détection | Retry | Idempotence | Compensation | Escalade |
| ------ | --------- | ----- | ----------- | ------------ | -------- |
| ...    | ...       | ...   | ...         | ...          | ...      |

Inclure :

- reprise DBOS après crash ;
- retries par step ;
- `@safe_step(recoverable_inputs={...})` pour les steps à inputs métier corrigeables ;
- champs explicitement non corrigeables documentés avec `Aucun input métier corrigeable` ;
- timeouts ;
- appels externes idempotents ;
- comportement si LLM non parsable ;
- comportement si Core/observability indisponible.

## 9. Sécurité et limites

- Secrets requis
- Données personnelles / rétention
- Validation des inputs
- Permissions opérateur HITL
- Rate limits externes

## 10. Plan d'implémentation

- Fichier workflow : `backend/agents/$1.py`
- Tests : `backend/tests/agents/test_$1.py`
- Tests `error_recovery` / `retry_with_input` pour chaque `@safe_step(recoverable_inputs=...)`
- Fixtures/mocks nécessaires
- Endpoints/API à connecter
- Critères d'acceptation

## 11. Détail par step

À remplir par `/agent-detail $1`.

```

---

## Processus

1. Analyser les fichiers projet et le brief `${@:2}`.
2. Poser au maximum 5 questions si des décisions bloquantes manquent : déclencheur, steps, HITL, outils externes, recovery.
3. Écrire `.project/agent-design.md` au format ci-dessus avec `status: draft`.
4. Demander validation ou modifications.
5. Quand l'utilisateur valide, passer `status: validated` et `validated_at: <YYYY-MM-DD>`.

Message final attendu :

> Design SDK-native validé dans `.project/agent-design.md`.
> Lance ensuite `/agent-detail $1` pour détailler les prompts, schemas et failure modes de chaque step LLM/tool/HITL.
```
