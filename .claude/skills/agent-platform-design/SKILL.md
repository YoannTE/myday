---
name: agent-platform-design
description: "Conçoit des workflows et agents autonomes SDK-native pour agent-platform. À utiliser pour choisir @workflow, @step, @agent, @multi_agent, définir steps, config, HITL, observabilité, recovery et tests avant l'implémentation."
---

# Agent Platform Design

Ce skill remplace le vieux contrat « graph LangGraph ». Il sert à produire un design **SDK-native** pour le SDK public `agent_platform`.

## Principe central

Claude Code est une couche dev-time : il conçoit, génère et relit. Le runtime de production reste :

```text
FastAPI → agent-platform SDK → DBOS → Core supervision
```

## Primitives publiques

- `@workflow` : flux déterministe, steps connus, branchements Python.
- `@step` : unité durable pour I/O, LLM, DB, HTTP, fichiers, temps, hasard, effets externes.
- `@safe_step(recoverable_inputs={...})` : variante obligatoire de `@step` pour les steps à inputs métier corrigeables par un opérateur.
- `parallel()` : fan-out durable avec sous-workflows `@workflow`.
- `@agent` : agent autonome qui choisit dynamiquement ses tools.
- `@multi_agent` : coordination de plusieurs agents autonomes spécialisés.
- `@configurable` / `@configurable_section` : réglages opérateur exposés au Core.
- HITL : `wait_for_input`, `wait_for_review`, `wait_for_signal`.
- Observabilité : instrumentation SDK automatique + events métier + summaries Op.

## Interdits

- `langgraph`, `StateGraph`, `add_messages`, `MessageGraph`, `CompiledGraph` dans le design ou le code applicatif.
- `asyncio.gather` pour paralléliser des `@step`.
- I/O non déterministe dans le corps d'un `@workflow`.
- Promesse que Claude Code reprend un run en production.
- `.claude/**` comme source de configuration runtime.

## Format cible `.project/agent-design.md`

Frontmatter :

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

Sections obligatoires :

1. `## 1. Vue d'ensemble` avec une **Description Op** destinée à `@workflow(description="...")`
2. `## 2. Workflow SDK-native`
3. `## 3. Steps`
4. `## 4. State et contrats de données`
5. `## 5. Config SDK`
6. `## 6. HITL`
7. `## 7. Observability`
8. `## 8. Recovery, retries et idempotence`
9. `## 9. Sécurité et limites`
10. `## 10. Plan d'implémentation`
11. `## 11. Détail par step`

Voir `references/sdk-native-design-format.md` pour le canevas complet.

## Checklist de validation

- Le choix `@workflow` / `@agent` / `@multi_agent` est justifié.
- Chaque workflow a une Description Op courte en français, lisible par un opérateur non-tech.
- Chaque step a input, output, retry/timeout, observabilité, summary Op attendu, inputs corrigeables et failure modes.
- Chaque step à inputs métier corrigeables déclare `@safe_step(recoverable_inputs={...})`; chaque step sans correction possible écrit `Aucun input métier corrigeable`.
- Chaque appel LLM ou tool externe est dans un `@step`, `@safe_step` ou tool décoré d'un agent.
- Chaque branche parallèle utilise `parallel()` + sous-workflows.
- Chaque config opérateur est déclarée dans `## 5. Config SDK`.
- Chaque HITL a payload, rôle cible, timeout, fallback et signal de reprise.
- La reprise après crash est décrite comme responsabilité DBOS/SDK.
- Les summaries Op sont prévus pour alimenter `step.completed.payload.summary` via `events.set_step_summary(...)`.
- Les tests obligatoires sont listés.
