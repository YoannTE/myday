<!-- Référence pédagogique de l'API SDK `agent-platform` accessible depuis le projet scaffoldé.
     En cas de doute sur une signature, introspecter le package installé :
     `python -c "import agent_platform, inspect; print(inspect.getsource(agent_platform.<symbole>))"`. -->

# Agents - patterns `@agent` et `@multi_agent`

## `@agent` - Agent ReAct autonome

```python
def agent(
    name: str,
    *,
    version: int = 1,
    description: str | None = None,
    tools: list[Callable] = [],
    model: str = "claude-sonnet-4-5",
    max_iterations: int = 10,
    timeout_seconds: float | None = None,
    state_schema: type[BaseModel] | None = None,
) -> Callable: ...
```

**Pattern ReAct** : Reason → Act → Observe en boucle. L'agent décide
dynamiquement quel outil invoquer à chaque étape, jusqu'à arriver à la réponse
finale ou atteindre `max_iterations`.

```python
from agent_platform import agent, step, events

@step()
async def search_web(query: str) -> list[dict]:
    """Cherche sur le web et retourne les résultats."""
    results = ...
    events.set_step_summary(f"{len(results)} résultats web trouvés")
    return results

@step()
async def fetch_url(url: str) -> str:
    """Récupère le contenu d'une URL."""
    content = ...
    events.set_step_summary("Contenu de la page récupéré")
    return content

@step()
async def summarize(text: str) -> str:
    """Résume un texte long."""
    summary = ...
    events.set_step_summary("Texte résumé")
    return summary

@agent(
    name="research_assistant",
    description="Recherche et synthétise des informations sourcées.",
    tools=[search_web, fetch_url, summarize],
    model="claude-sonnet-4-5",
    max_iterations=8,
)
async def research_assistant(question: str) -> str:
    """L'agent décide quoi chercher, où aller, quand répondre."""
    return f"Réponds précisément à : {question}"
```

**Sous le capot** (moteur agentique masqué par le SDK) :

- Construit une boucle agentique ReAct avec les `tools` fournis
- Emballe l'exécution dans un workflow durable du SDK
- Chaque tool décorée `@step` bénéficie de l'idempotence DBOS
- Streaming / events des étapes vers Reborn Core via l'instrumentation SDK

## `@multi_agent` - Supervisor + Workers

```python
def multi_agent(
    name: str,
    *,
    version: int = 1,
    supervisor: str,           # nom de l'agent superviseur
    workers: list[str],        # noms des agents workers
    pattern: str = "supervisor",
    max_iterations: int = 15,
    timeout_seconds: float | None = None,
) -> Callable: ...
```

### 3 patterns disponibles

| Pattern        | Description                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `supervisor`   | Superviseur qui dispatch dynamiquement vers les workers selon le contexte (défaut) |
| `hierarchical` | Sous-superviseurs avec leurs propres équipes (orchestration imbriquée côté SDK)    |
| `plan_execute` | Le superviseur produit un plan, puis exécute les workers dans l'ordre planifié     |

### Exemple - content_pipeline (pattern `supervisor`)

```python
from agent_platform import agent, multi_agent

@agent(name="researcher", description="Recherche des faits et sources fiables.", tools=[web_search, fetch_url])
async def researcher(topic: str) -> str:
    """Recherche des faits et sources sur un sujet."""
    return f"Recherche sur : {topic}"

@agent(name="writer", description="Rédige un contenu structuré à partir d'un brief.", tools=[generate_outline, write_section])
async def writer(brief: str) -> str:
    """Rédige un article à partir d'un brief."""
    return f"Rédige : {brief}"

@agent(name="fact_checker", description="Vérifie les affirmations factuelles d'un contenu.", tools=[verify_claim])
async def fact_checker(text: str) -> str:
    """Vérifie les affirmations factuelles d'un texte."""
    return f"Vérifie : {text}"

@multi_agent(
    name="content_pipeline",
    supervisor="orchestrator",
    workers=["researcher", "writer", "fact_checker"],
    pattern="supervisor",
)
async def content_pipeline(topic: str) -> str:
    """Le superviseur orchestre research → write → check."""
    return f"Produis un article documenté sur : {topic}"
```

## Streaming SSE (retour incrémental)

Pour streamer les étapes intermédiaires en temps réel, utiliser `llm.stream`
**à l'intérieur d'un `@step`** dans un agent :

```python
from agent_platform import events, llm, step

@step()
async def generate_section(brief: str) -> str:
    chunks = []
    async for chunk in llm.stream(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": brief}],
    ):
        chunks.append(chunk)
    section = "".join(chunks)
    events.set_step_summary("Section rédigée en streaming")
    return section
```

Les événements agentiques du SDK sont automatiquement transmis vers Reborn Core ; le dashboard affiche la progression en temps réel.

## Règle stricte - aucun import direct du moteur agentique

```python
# INTERDIT - import direct LangGraph dans un agent
from langgraph.graph import StateGraph  # jamais
from langgraph.prebuilt import create_react_agent  # jamais

# CORRECT - uniquement via agent_platform
from agent_platform import agent, multi_agent, step
```

Le moteur agentique interne du SDK n'est pas une API projet. Le développeur n'importe **jamais** `langgraph.*` dans ses fichiers d'agents.

→ Voir `references/primitives.md` pour choisir entre `@workflow`, `@agent` et `@multi_agent`.
→ Voir `references/llm-usage.md` pour `llm.complete`, `llm.stream`, `llm.parse`.
