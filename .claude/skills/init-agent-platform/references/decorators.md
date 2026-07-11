<!-- Référence pédagogique de l'API SDK `agent-platform` accessible depuis le projet scaffoldé.
     En cas de doute sur une signature, introspecter le package installé :
     `python -c "import agent_platform, inspect; print(inspect.getsource(agent_platform.<symbole>))"`. -->

# Décorateurs - `@workflow` et `@step`

## `@workflow`

```python
def workflow(
    name: str,
    *,
    version: int = 1,
    description: str | None = None,
    timeout_seconds: float | None = None,
) -> Callable: ...
```

| Paramètre         | Défaut | Description                                                                                   |
| ----------------- | ------ | --------------------------------------------------------------------------------------------- |
| `name`            | -      | Identifiant stable du workflow (enregistré sur le Core)                                       |
| `version`         | `1`    | Version de la définition (incrémenter si signature change)                                    |
| `description`     | `None` | Texte affiché dans le dashboard Reborn Agents ; obligatoire dans le starterkit pour la vue Op |
| `timeout_seconds` | `None` | Durée max du workflow ; `None` = illimité                                                     |

**Ce que fait `@workflow` sous le capot** :

- Enregistre la définition via `POST /v1/admin/definitions` au boot (idempotent)
- Injecte `config` en kwarg si `@configurable` est aussi présent
- Émet les events `workflow.started` / `workflow.completed` / `workflow.failed`

```python
from agent_platform import workflow, step, llm, events

@workflow(
    name="invoice_reminder",
    version=1,
    description="Relance un client pour une facture impayée.",
    timeout_seconds=300,
)
async def invoice_reminder(invoice_id: str) -> dict:
    data = await fetch_invoice(invoice_id)
    await send_reminder(data)
    return {"status": "sent", "invoice_id": invoice_id}
```

## `@step`

```python
def step(
    *,
    name: str | None = None,
    retry_max_attempts: int = 3,
    retry_initial_interval_seconds: float = 1.0,
    retry_backoff_factor: float = 2.0,
    timeout_seconds: float | None = None,
) -> Callable: ...
```

| Paramètre                        | Défaut | Description                                         |
| -------------------------------- | ------ | --------------------------------------------------- |
| `name`                           | `None` | Surcharge le nom affiché (défaut = nom de fonction) |
| `retry_max_attempts`             | `3`    | Nombre de tentatives avant échec définitif          |
| `retry_initial_interval_seconds` | `1.0`  | Attente avant le 1ᵉʳ retry                          |
| `retry_backoff_factor`           | `2.0`  | Multiplicateur de délai entre retries               |
| `timeout_seconds`                | `None` | Durée max du step                                   |

## Déterminisme - ce qui DOIT être dans `@step`

DBOS rejoue les workflows après un crash. Tout appel non-déterministe
**doit** être encapsulé dans un `@step` pour que le résultat soit idempotent.

| Cas non-déterministe    | Exemple concret                          |
| ----------------------- | ---------------------------------------- |
| Appel LLM               | `llm.complete(...)`, `llm.stream(...)`   |
| Appel HTTP externe      | `httpx.get(...)`, `requests.post(...)`   |
| Lecture base de données | `conn.fetch(...)`, `conn.execute(...)`   |
| Heure courante          | `datetime.now()`, `time.time()`          |
| Valeur aléatoire        | `random.random()`, `secrets.token_hex()` |
| Génération d'UUID       | `uuid.uuid4()`                           |
| Hash non-déterministe   | Tout hash avec seed implicite            |

```python
from agent_platform import events, step

@step()
async def fetch_invoice(invoice_id: str) -> dict:
    # HTTP dans @step = DBOS garantit l'idempotence sur crash+reprise
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.example.com/invoices/{invoice_id}")
    invoice = resp.json()
    events.set_step_summary(f"Facture {invoice_id} récupérée")
    return invoice

@step(retry_max_attempts=5, retry_backoff_factor=3.0)
async def call_external_api(payload: dict) -> dict:
    # Retry plus agressif pour les APIs instables
    ...
```

## Anti-patterns à éviter

```python
# INTERDIT - def synchrone (le SDK est async-first)
@workflow(name="bad")
def bad_workflow(x: str) -> dict:  # manque async
    ...

# INTERDIT - appel LLM hors @step (non rejoué sur crash)
@workflow(name="also_bad")
async def also_bad(x: str) -> dict:
    response = await llm.complete(...)  # doit être dans un @step

# INTERDIT - état global mutable hors AgentPlatform
cache = {}

@step()
async def step_with_global(x: str) -> str:
    cache[x] = "..."  # état global = bug sur multi-process

# CORRECT - tout I/O dans @step, workflow pur Python, description Op renseignée
@workflow(name="correct", description="Qualifie un lead à partir des données disponibles.")
async def correct(lead_id: str) -> dict:
    data = await fetch_lead(lead_id)   # dans @step
    score = await score_lead(data)      # dans @step
    if score > 50:
        return {"status": "qualified"}
    return {"status": "rejected"}
```

→ Voir `references/primitives.md` pour choisir entre `@workflow`, `@agent`, `@multi_agent`.
→ Voir `references/agents-patterns.md` pour les décorateurs `@agent` et `@multi_agent`.
