<!-- Référence pédagogique de l'API SDK `agent-platform` accessible depuis le projet scaffoldé.
     En cas de doute sur une signature, introspecter le package installé :
     `python -c "import agent_platform, inspect; print(inspect.getsource(agent_platform.<symbole>))"`. -->

# Patterns de tests

Pour les fixtures exactes exportées, introspecter le sous-module :
`python -c "import agent_platform.testing; print(dir(agent_platform.testing))"`.

## Sous-module `agent_platform.testing`

Trois fixtures pytest sont exportées :

```python
from agent_platform.testing import workflow_runner, mock_llm, mock_hitl
```

### `workflow_runner`

Context manager async. Démarre `AgentPlatform` en mémoire (DBOS in-memory +
core mocké), exécute un workflow, teardown propre.

```python
async with workflow_runner(my_workflow, input={"lead_id": "abc"}) as run:
    result = await run.wait()
    assert result["status"] == "sent"
```

### `mock_llm`

Monkeypatche `agent_platform.llm._client`. Retourne des réponses LLM canned.

```python
mock_llm.queue_response(LLMResponse(
    content='{"score": 75}',
    role="assistant",
    tool_calls=None,
    usage=LLMUsage(input_tokens=50, output_tokens=10, cost_usd=Decimal("0.001")),
    raw={},
    finish_reason="stop",
))
```

### `mock_hitl`

Résout programmatiquement les HITL en envoyant le signal DBOS correct.

```python
# Simule un utilisateur humain qui approve
await mock_hitl.resolve(
    pending_input_id="pi_123",
    payload={"value": "approve", "reason": "looks good", "user_id": "user_42"},
)
```

Utilise `DBOS.send` avec le bon topic (`hitl:{pending_input_id}`) - géré
automatiquement par la fixture, pas besoin de connaître le topic.

## Structure recommandée

```
backend/tests/agents/
├── __init__.py
├── conftest.py          # ré-exporte les 3 fixtures
└── test_qualify_lead.py # 1 fichier par agent
```

**`conftest.py` standard** :

```python
"""Fixtures ré-exportées depuis agent_platform.testing pour les tests d'agents."""
from agent_platform.testing import workflow_runner, mock_llm, mock_hitl

__all__ = ["workflow_runner", "mock_llm", "mock_hitl"]
```

## Exemple - test happy path

```python
import pytest
from decimal import Decimal
from agent_platform.testing import LLMResponse, LLMUsage
from app.agents.qualify_lead import qualify_lead


@pytest.mark.asyncio
async def test_qualify_lead_approve(mock_llm, mock_hitl, workflow_runner):
    # LLM retourne un score > 50 → le workflow demande une review
    mock_llm.queue_response(LLMResponse(
        content="72",
        role="assistant",
        tool_calls=None,
        usage=LLMUsage(input_tokens=30, output_tokens=5, cost_usd=Decimal("0.0005")),
        raw={},
        finish_reason="stop",
    ))

    async with workflow_runner(qualify_lead, input={"lead_id": "lead_42"}) as run:
        # Simuler l'approbation humaine
        await mock_hitl.resolve("pi_001", {"value": "approve", "user_id": "u1"})
        result = await run.wait()

    assert result["status"] == "sent"
    assert result["score"] == 72
```

## Exemple - test edge case (HITL refus)

```python
@pytest.mark.asyncio
async def test_qualify_lead_reject(mock_llm, mock_hitl, workflow_runner):
    mock_llm.queue_response(LLMResponse(
        content="65", role="assistant", tool_calls=None,
        usage=LLMUsage(input_tokens=30, output_tokens=5, cost_usd=Decimal("0")),
        raw={}, finish_reason="stop",
    ))

    async with workflow_runner(qualify_lead, input={"lead_id": "lead_99"}) as run:
        await mock_hitl.resolve("pi_002", {"value": "reject", "user_id": "u1"})
        result = await run.wait()

    assert result["status"] == "skipped"
```

## Exemple - test edge case (score bas, rejet auto sans HITL)

```python
@pytest.mark.asyncio
async def test_qualify_lead_low_score(mock_llm, workflow_runner):
    mock_llm.queue_response(LLMResponse(
        content="30", role="assistant", tool_calls=None,
        usage=LLMUsage(input_tokens=30, output_tokens=5, cost_usd=Decimal("0")),
        raw={}, finish_reason="stop",
    ))

    async with workflow_runner(qualify_lead, input={"lead_id": "lead_00"}) as run:
        result = await run.wait()

    # Aucun HITL requis, rejet automatique
    assert result["status"] == "rejected"
    assert result["score"] < 50
```

## Recommandation

1 test happy path + 1 à 2 edge cases par agent. Les edge cases prioritaires :

- HITL refus ou délai dépassé
- LLM retourne une réponse inattendue (format invalide)
- Valeur `@configurable` hors plage (déclenche 422 au save)
