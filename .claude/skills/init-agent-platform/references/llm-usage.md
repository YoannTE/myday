<!-- Référence pédagogique de l'API SDK `agent-platform` accessible depuis le projet scaffoldé.
     En cas de doute sur une signature, introspecter le package installé :
     `python -c "import agent_platform, inspect; print(inspect.getsource(agent_platform.<symbole>))"`. -->

# LLM - `llm.complete`, `llm.stream`, `llm.parse`

## Import

```python
from agent_platform import llm
```

**Ne jamais importer directement** `openai`, `anthropic`, `litellm` dans un agent.
LiteLLM est un détail d'implémentation interne du SDK.

## `llm.complete` - appel non-streaming

```python
response: LLMResponse = await llm.complete(
    model="claude-sonnet-4-5",
    messages=[
        {"role": "system", "content": "Tu es un assistant utile."},
        {"role": "user", "content": "Résume ce texte : ..."},
    ],
    *,
    temperature=0.7,
    max_tokens=None,
    response_format=None,     # {"type": "json_object"} pour forcer JSON
    tools=None,
    tool_choice=None,
    timeout=120,
    retry_max_attempts=3,
)
```

## `llm.stream` - appel streaming SSE

```python
from agent_platform import events, llm, step

# Dans un @step - streamer des chunks de texte
@step()
async def generate_draft(brief: str) -> str:
    chunks = []
    async for chunk in llm.stream(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": brief}],
    ):
        chunks.append(chunk)
    draft = "".join(chunks)
    events.set_step_summary("Brouillon généré par le LLM")
    return draft
```

## `llm.parse` - parsing Pydantic strict

```python
from pydantic import BaseModel
from agent_platform import events, llm, step

class LeadScore(BaseModel):
    score: int
    reason: str
    qualified: bool

@step()
async def score_lead(enriched: dict) -> LeadScore:
    result: LeadScore = await llm.parse(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": f"Évalue ce lead : {enriched}"}],
        response_model=LeadScore,
    )
    events.set_step_summary(f"Lead scoré à {result.score}/100")
    return result
```

## Types de réponse

```python
from dataclasses import dataclass
from decimal import Decimal

@dataclass
class LLMResponse:
    content: str
    role: str
    tool_calls: list[ToolCall] | None
    usage: LLMUsage
    raw: dict
    finish_reason: str

@dataclass
class LLMUsage:
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    cached_input_tokens: int = 0
```

## Conventions modèles (mai 2026)

| Provider  | Modèle recommandé      | Usage typique                     |
| --------- | ---------------------- | --------------------------------- |
| Anthropic | `claude-sonnet-4-5`    | Défaut - bon rapport qualité/coût |
| Anthropic | `claude-opus-4-5`      | Tâches complexes, raisonnement    |
| OpenAI    | `gpt-4` (dernière rev) | Alternative ou si déjà sur OpenAI |

**Toujours spécifier le modèle explicitement** - ne pas laisser implicite.

## Clés API (Décision N - obligatoire)

```python
import os

# CORRECT - clés via os.environ (Décision N : pas de secrets centralisés en V1)
api_key = os.environ["OPENAI_API_KEY"]
anthropic_key = os.environ["ANTHROPIC_API_KEY"]

# INTERDIT - système de secrets centralisé (pas en V1)
# api_key = secrets.get("openai_key")  # n'existe pas en V1
```

Les clés sont lues **automatiquement** par le wrapper LLM depuis `os.environ`.
Tu n'as pas à les passer manuellement à `llm.complete` - elles sont récupérées
en interne selon le provider extrait du nom du modèle.

## Retry intégré

Retry automatique sur erreurs réseau et 429 (3 essais, backoff exponentiel).
Pour customiser : `retry_max_attempts=5` dans `llm.complete`.

## Anti-patterns

```python
from agent_platform import events, llm, step, workflow

# INTERDIT - import direct du provider
import openai  # jamais
import anthropic  # jamais

# INTERDIT - modèle implicite
await llm.complete(messages=[...])  # manque model=

# INTERDIT - LLM hors @step (non idempotent sur crash DBOS)
@workflow(name="bad")
async def bad(x: str) -> dict:
    r = await llm.complete(model="claude-sonnet-4-5", messages=[...])  # hors @step !

# CORRECT
@step()
async def analyze(x: str) -> str:
    r = await llm.complete(model="claude-sonnet-4-5", messages=[...])
    events.set_step_summary("Analyse LLM terminée")
    return r.content
```

→ Voir `references/decorators.md` pour la règle sur le déterminisme des `@step`.
→ Voir `references/agents-patterns.md` pour le streaming SSE avec `llm.stream`.
