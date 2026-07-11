# Patterns agent-platform SDK-native

## Workflow déterministe

```python
from agent_platform import workflow, step, events

@workflow(name="qualify_lead", version=1, description="Qualifie un lead entrant et produit un score commercial.")
async def qualify_lead(lead_id: str) -> dict:
    lead = await fetch_lead(lead_id)
    score = await score_lead(lead)
    return {"lead_id": lead_id, "score": score}

@step()
async def fetch_lead(lead_id: str) -> dict:
    lead = ...
    events.set_step_summary(f"Lead {lead_id} récupéré")
    return lead
```

## Fan-out durable

```python
from agent_platform import workflow, step, parallel

@workflow(name="branch_a", version=1, description="Récupère la première source métier.")
async def branch_a(input_id: str) -> dict:
    return await step_a(input_id)

@workflow(name="root", version=1, description="Agrège plusieurs sources métier en parallèle.")
async def root(input_id: str) -> dict:
    a, b = await parallel((branch_a, input_id), (branch_b, input_id))
    return {"a": a, "b": b}
```

Ne jamais faire `asyncio.gather(step_a(...), step_b(...))`.

## Agent autonome

```python
from agent_platform import agent, step

@step()
async def search_web(query: str) -> list[dict]:
    ...

@agent(name="researcher", tools=[search_web], model="claude-sonnet-4-5")
async def researcher(question: str) -> str:
    return f"Réponds avec sources à : {question}"
```

## Observabilité métier

```python
from agent_platform import events, step

@step()
async def extract_price(product_id: str) -> dict:
    result = ...
    events.set_step_summary(f"Prix trouvé : {result['price']} €")
    events.emit("price.extracted", {"product_id": product_id, "found": True})
    return result
```
