# Référence design agent-platform SDK-native

Cette référence miroir le skill `.claude/skills/agent-platform-design/`.

À utiliser avant d'implémenter un workflow IA.

## Source de vérité

Le design canonique vit dans :

```text
.project/agent-design.md
```

avec :

```yaml
kind: agent-platform-design
sdk: agent-platform
runtime: dbos
langgraph: false
```

## Primitives

- `@workflow` : flux déterministe, choix par défaut.
- `@step` : I/O, LLM, DB, HTTP, fichiers, temps, hasard, effets externes.
- `parallel()` : fan-out durable avec sous-workflows `@workflow`.
- `@agent` : agent autonome avec tools si le choix des actions est dynamique.
- `@multi_agent` : coordination de plusieurs agents autonomes spécialisés.
- `@configurable` / `@configurable_section` : réglages opérateur.
- HITL : `wait_for_input`, `wait_for_review`, `wait_for_signal`.
- Description Op : `@workflow(description="...")` pour alimenter `workflow_definitions.description`.
- Summary Op : `events.set_step_summary(...)` pour alimenter `step.completed.payload.summary`.

## Règles

- Ne jamais importer `langgraph`, `dbos` ou `litellm` directement dans `backend/agents/**`.
- Ne jamais utiliser `asyncio.gather` pour des `@step`.
- Ne jamais faire porter la reprise durable à Claude Code.
- Toujours documenter observabilité, recovery, tests et idempotence.
- Toujours prévoir une description courte en français pour chaque workflow et sous-workflow.
- Toujours prévoir un summary court en français pour chaque step observable, à poser juste avant chaque `return`.
