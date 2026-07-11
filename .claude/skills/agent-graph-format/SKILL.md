---
name: agent-graph-format
description: "Compatibilité legacy : redirige vers le format SDK-native agent-platform-design. Ne plus utiliser pour créer des designs LangGraph ou .mmd."
---

# Compatibilité : agent-graph-format → agent-platform-design

Ce skill est conservé pour ne pas casser les anciens agents ou commandes qui mentionnent encore `agent-graph-format`.

## Nouveau contrat

Le format canonique est désormais porté par :

```text
.claude/skills/agent-platform-design/SKILL.md
```

Les designs doivent produire uniquement :

```text
.project/agent-design.md
```

avec le frontmatter :

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

## Sections obligatoires

1. `## 1. Vue d'ensemble`
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

## Interdits legacy

- Ne pas créer `.project/agent-design.mmd` comme source obligatoire.
- Ne pas utiliser LangGraph, `StateGraph`, `add_messages`, `MessageGraph`, `CompiledGraph`.
- Ne pas parler de nodes/edges LangGraph comme contrat runtime.
- Ne pas recommander `asyncio.gather` pour des `@step`.

## Fan-out correct

Le fan-out durable se fait avec :

```python
from agent_platform import workflow, parallel

@workflow(name="branch_a", version=1)
async def branch_a(input_id: str) -> dict:
    ...

@workflow(name="root", version=1)
async def root(input_id: str) -> dict:
    a, b = await parallel((branch_a, input_id), (branch_b, input_id))
    return {"a": a, "b": b}
```

Pour le format complet, lire `agent-platform-design`.
