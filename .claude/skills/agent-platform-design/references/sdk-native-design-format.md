# Format SDK-native de `.project/agent-design.md`

## Frontmatter

```yaml
---
kind: agent-platform-design
sdk: agent-platform
runtime: dbos
langgraph: false
workflow: <workflow_name>
status: draft
validated_at: ""
detail_validated_at: ""
---
```

## Sections

### 1. Vue d'ensemble

- Workflow SDK
- Description Op pour `@workflow(description="...")`
- Objectif métier
- Déclencheur
- Entrée initiale
- Sortie finale
- Opérateurs humains
- Volume / SLA

### 2. Workflow SDK-native

Décrire le `@workflow` parent avec sa `description`, les branchements Python, les sous-workflows et les points où `@agent` ou `@multi_agent` sont justifiés.

### 3. Steps

| Step SDK | Type | Responsabilité | Input | Output | Retry/timeout | Observabilité |
| -------- | ---- | -------------- | ----- | ------ | ------------- | ------------- |

Dans `Observabilité`, indiquer le summary Op attendu pour `events.set_step_summary(...)` sur chaque step observable.

Types : `pure`, `llm`, `tool`, `hitl`, `db`, `sub_workflow`, `agent`, `multi_agent`.

### 4. State et contrats de données

Utiliser `TypedDict` ou Pydantic. Documenter les invariants, idempotency keys, tenant/user ids et outputs terminaux.

### 5. Config SDK

| Clé | Type SDK | Défaut | Scope | Description | Secret |
| --- | -------- | ------ | ----- | ----------- | ------ |

### 6. HITL

| ID  | Primitive SDK | Moment | Question | Options | Timeout | Reprise | Fallback |
| --- | ------------- | ------ | -------- | ------- | ------- | ------- | -------- |

### 7. Observability

Distinguer instrumentation automatique SDK, description Op du workflow, summaries Op des steps et events métier.

Ne jamais émettre manuellement `workflow.started`, `workflow.completed`, `workflow.failed`.

Chaque workflow doit fournir une description courte en français pour `@workflow(description="...")`.
Chaque step observable doit fournir un résumé court en français à envoyer via `events.set_step_summary(...)` avant retour.

### 8. Recovery, retries et idempotence

| Risque | Détection | Retry | Idempotence | Compensation | Escalade |
| ------ | --------- | ----- | ----------- | ------------ | -------- |

### 9. Sécurité et limites

Secrets, données personnelles, permissions HITL, rate limits.

### 10. Plan d'implémentation

Fichiers, tests, endpoints, critères d'acceptation.

### 11. Détail par step

À remplir par `/agent-detail`.
