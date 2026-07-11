<!-- Référence pédagogique de l'API SDK `agent-platform` accessible depuis le projet scaffoldé.
     En cas de doute sur une signature, introspecter le package installé :
     `python -c "import agent_platform, inspect; print(inspect.getsource(agent_platform.<symbole>))"`. -->

# Primitives - choisir entre `@workflow`, `@agent`, `@multi_agent`

## Matrice de choix (Décision QQ)

| Situation                                              | Primitive      | Justification                                   |
| ------------------------------------------------------ | -------------- | ----------------------------------------------- |
| Flux prévisible, étapes connues à l'avance             | `@workflow`    | Branchements Python `if/else`, contrôle total   |
| Branchements conditionnels simples                     | `@workflow`    | Python pur, pas de LLM pour décider du flux     |
| Code métier (CRUD, facturation, paie)                  | `@workflow`    | Déterminisme strict requis                      |
| L'agent doit décider dynamiquement quel outil utiliser | `@agent`       | ReAct : Reason + Act + Observe en boucle        |
| Streaming SSE temps-réel des étapes intermédiaires     | `@agent`       | Événements agentiques exposés par le SDK        |
| Plusieurs agents spécialisés à coordonner              | `@multi_agent` | Supervisor qui dispatch et agrège               |
| Pipeline complexe (research → write → review)          | `@multi_agent` | Workers indépendants, traces séparées côté Core |

**Règle d'or** : commence par `@workflow`. Bascule sur `@agent` uniquement quand
le raisonnement autonome est avéré. Bascule sur `@multi_agent` quand tu as besoin
de plusieurs agents spécialisés distincts.

## 5 patterns canoniques

### 1. Workflow déterministe simple

```python
from agent_platform import workflow, step, llm, events

@workflow(name="qualify_lead", version=1, description="Qualifie un lead entrant et produit un score commercial.")
async def qualify_lead(lead_id: str) -> dict:
    enriched = await enrich_lead(lead_id)
    score = await score_lead(enriched)
    if score < 50:
        return {"status": "rejected", "score": score}
    return {"status": "accepted", "score": score}

@step()
async def enrich_lead(lead_id: str) -> dict:
    # HTTP dans @step = déterminisme DBOS garanti
    enriched = ...
    events.set_step_summary(f"Lead {lead_id} enrichi")
    return enriched

@step()
async def score_lead(enriched: dict) -> int:
    response = await llm.complete(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": f"Score: {enriched}"}],
    )
    score = int(response.content.strip())
    events.set_step_summary(f"Lead scoré à {score}/100")
    return score
```

→ Voir `references/decorators.md` pour les paramètres complets de `@workflow` et `@step`.

### 2. Workflow avec HITL

```python
from agent_platform import workflow, step, hitl

@workflow(name="send_outreach", version=1, description="Prépare et envoie un message de prospection après validation humaine.")
async def send_outreach(lead_id: str) -> dict:
    draft = await generate_draft(lead_id)
    review = await hitl.wait_for_review(
        content=draft,
        prompt="Approuver et éventuellement éditer le message avant envoi ?",
        timeout_days=3,
    )
    if not review.approved:
        return {"status": "rejected"}
    await send_email(review.content)
    return {"status": "sent"}
```

→ Voir `references/hitl-patterns.md` pour les 3 primitives HITL et la reprise après crash.

### 3. Workflow configurable

```python
from agent_platform import workflow, step, llm, configurable, Choice, IntRange, LongText

@configurable({
    "tone": Choice(["formal", "casual"], default="casual", label="Ton des emails"),
    "max_followups": IntRange(1, 5, default=3),
    "company_voice": LongText(default="", label="Voix de la marque"),
})
@workflow(name="sdr_outbound", version=1, description="Orchestre une campagne de prospection commerciale personnalisée.")
async def sdr_outbound(lead_id: str, *, config) -> dict:
    if config.tone == "formal":
        ...
```

→ Voir `references/configurable-types.md` pour les 12 types disponibles.

### 4. Agent ReAct simple

```python
from agent_platform import agent, step

@step()
async def search_web(query: str) -> list[dict]: ...

@step()
async def fetch_url(url: str) -> str: ...

@agent(
    name="research_assistant",
    tools=[search_web, fetch_url],
    model="claude-sonnet-4-5",
    max_iterations=8,
)
async def research_assistant(question: str) -> str:
    """L'agent décide quoi chercher, où aller, quand répondre."""
    return f"Réponds précisément à : {question}"
```

→ Voir `references/agents-patterns.md` pour le pattern ReAct complet et le streaming SSE.

### 5. Multi-agent supervisor

```python
from agent_platform import agent, multi_agent

@agent(name="researcher", tools=[web_search])
async def researcher(topic: str) -> str: ...

@agent(name="writer", tools=[generate_outline, write_section])
async def writer(brief: str) -> str: ...

@multi_agent(
    name="content_pipeline",
    supervisor="orchestrator",
    workers=["researcher", "writer"],
    pattern="supervisor",
)
async def content_pipeline(topic: str) -> str:
    return f"Produis un article documenté sur : {topic}"
```

→ Voir `references/agents-patterns.md` pour les 3 patterns supportés (`supervisor`,
`hierarchical`, `plan_execute`).
