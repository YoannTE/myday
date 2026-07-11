---
description: Conventions agent-platform pour les workflows d'agents IA (workflows DBOS, agents ReAct, multi-agent)
globs:
  - "backend/agents/**"
  - "backend/tests/agents/**"
  - "lib/prompts/**"
---

# Conventions agent-platform

Règles à respecter pour tout fichier dans `backend/agents/`, `backend/tests/agents/` et `lib/prompts/`.

## Imports

**TOUJOURS** importer depuis `agent_platform` :

```python
from agent_platform import (
    workflow, step, safe_step, agent, multi_agent,
    llm, configurable, events,
    wait_for_input, wait_for_review, wait_for_signal,
    AgentPlatform, WorkflowHandle,
)
```

**INTERDIT au niveau module (top-level)** :

- `import dbos` / `from dbos import ...`
- `import langgraph` / `from langgraph import ...`
- `import litellm` / `from litellm import ...`
- `import openai` / `import anthropic` - utiliser `agent_platform.llm` à la place
- `import httpx` hors d'un `@step`

**AUTORISÉ dans un `@step`** (déterminisme garanti par DBOS retry) :

- `import httpx` pour les appels HTTP externes légitimes
- `import openai` / `import anthropic` (déconseillé - préférer `agent_platform.llm`)
- Tout autre I/O externe spécifique

**Clés API tierces** : `os.environ["OPENAI_API_KEY"]` (Décision N - pas de système central de secrets en V1).

## Structure d'un fichier d'agent

- 1 agent ou 1 workflow par fichier
- Nom de fichier en `snake_case` = nom du `@workflow`/`@agent` : `qualify_lead.py` pour `@workflow(name="qualify_lead")`
- Toujours `async def`, jamais `def` synchrone

**Template `@workflow` déterministe :**

```python
from agent_platform import workflow, step, llm, events

@workflow(
    name="qualify_lead",
    version=1,
    description="Qualifie un lead entrant et produit un score exploitable par l'équipe commerciale.",
)
async def qualify_lead(lead_id: str) -> dict:
    enriched = await enrich_lead(lead_id)
    score = await score_lead(enriched)
    return {"status": "qualified" if score >= 50 else "rejected", "score": score}

@step()
async def enrich_lead(lead_id: str) -> dict:
    import httpx  # httpx autorisé dans @step
    async with httpx.AsyncClient() as client:
        lead = (await client.get(f"https://api.example.com/leads/{lead_id}")).json()
    events.set_step_summary(f"Lead {lead_id} enrichi depuis le CRM")
    return lead

@step()
async def score_lead(enriched: dict) -> int:
    r = await llm.complete(model="claude-sonnet-4-5", messages=[{"role": "user", "content": str(enriched)}])
    score = int(r.content.strip())
    events.set_step_summary(f"Lead scoré à {score}/100")
    return score
```

## Pattern fan-out parallèle (`parallel()` + sous-workflows)

**IMPORTANT - depuis `agent-platform >= 0.3.0`** : `asyncio.gather(...)` sur
des `@step` **ne fonctionne pas** avec DBOS. Le ContextVar workflow n'est pas
propagé aux tâches concurrentes → `AssertionError` interne (ou `RuntimeError`
explicite depuis 0.3.0). C'est une limite intrinsèque au modèle de durabilité,
pas un bug.

**Pattern correct** : déclarer chaque branche comme un sous-workflow distinct,
les lancer via `agent_platform.parallel(...)`.

**Réflexe** : avant d'introduire un fan-out, s'assurer que les branches sont
indépendantes (pas de dépendance latérale, pas d'état externe partagé). En cas
de doute, garder le séquentiel.

```python
from agent_platform import workflow, parallel

@workflow(name="fetch_price", version=1, description="Récupère le prix fournisseur du produit.")
async def fetch_price(product_id: str) -> dict: ...

@workflow(name="fetch_manufacturer", version=1, description="Récupère les informations fabricant du produit.")
async def fetch_manufacturer(product_id: str) -> dict: ...

@workflow(name="fetch_notice", version=1, description="Récupère la notice technique du produit.")
async def fetch_notice(product_id: str) -> dict: ...

@workflow(name="product_draft_builder", version=1, description="Génère une fiche produit complète à partir des sources fournisseur.")
async def product_draft_builder(product_id: str) -> dict:
    price, manufacturer, notice = await parallel(
        (fetch_price, product_id),
        (fetch_manufacturer, product_id),
        (fetch_notice, product_id),
    )
    return {"price": price, "manufacturer": manufacturer, "notice": notice}
```

**Si une branche est déjà écrite comme `@step`** : wrapper dans un `@workflow`
ad-hoc qui appelle juste le step. Le step conserve son retry policy individuel.

```python
@step()
async def scrape_price(pid: str) -> dict: ...

@workflow(name="branch_scrape_price", version=1, description="Scrape le prix du produit chez le fournisseur.")
async def branch_scrape_price(pid: str) -> dict:
    return await scrape_price(pid)
```

**Garanties** :

- Chaque sous-workflow obtient son propre `WorkflowID` déterministe.
- En cas de replay DBOS, les sous-workflows déjà `COMPLETED` sont skippés.
- Une exception dans une branche est propagée par `parallel()` (catchable
  côté workflow parent ; déclenche le HITL `error_recovery` côté `@step` interne).

**Coût** :

- ~30-80ms d'overhead par sous-workflow (insertion d'un row + lecture du
  résultat). Acceptable jusqu'à ~10 branches.
- Au-delà : préférer `dbos.Queue` avec concurrence contrôlée.

**Anti-patterns** :

```python
# ❌ asyncio.gather sur @step - lève RuntimeError
await asyncio.gather(step_a(x), step_b(y))

# ❌ parallel() sur @step - TypeError
await parallel((step_a, x), (step_b, y))

# ❌ parallel() hors d'un @workflow - AgentPlatformError
async def main():
    await parallel((branch, 1))
```

**Représentation dans le design** : documenter le fan-out dans `## 3. Steps` et `## 8. Recovery` de `.project/agent-design.md`. Un Mermaid optionnel peut aider, mais il n'est jamais la source de vérité.

**Template `@agent` ReAct :**

```python
from agent_platform import agent, step

@step()
async def search_web(query: str) -> list[dict]: ...

@agent(name="research_assistant", tools=[search_web], model="claude-sonnet-4-5")
async def research_assistant(question: str) -> str:
    return f"Réponds précisément à : {question}"
```

**Template `@multi_agent` :**

```python
from agent_platform import multi_agent

@multi_agent(name="content_pipeline", supervisor="orchestrator", workers=["researcher", "writer"], pattern="supervisor")
async def content_pipeline(topic: str) -> str:
    return f"Article documenté sur : {topic}"
```

## Choix de la primitive

| Situation                                                | Primitive      |
| -------------------------------------------------------- | -------------- |
| Étapes connues à l'avance, branchements `if/else` Python | `@workflow`    |
| L'agent décide dynamiquement quel outil utiliser         | `@agent`       |
| Plusieurs agents qui se coordonnent                      | `@multi_agent` |

## Observabilité opérateur obligatoire

Ces deux champs sont consommés directement par la vue Op. Ils doivent être renseignés dans tout code généré ou modifié dans `backend/agents/**`.

1. **Description de workflow** : chaque `@workflow` doit définir `description="..."` avec une phrase courte en français, métier, lisible par un opérateur non-tech. Cette valeur est enregistrée dans `workflow_definitions.description` au boot SDK et affichée pour les workflows et branches issues de `parallel()`.
2. **Résumé de step** : chaque `@step` observable (LLM, recherche, écriture BDD, appel externe, fichier, HITL, calcul métier visible) doit appeler `events.set_step_summary("...")` juste avant chaque `return`. Cette valeur est envoyée dans `step.completed.payload.summary` et affichée dans la timeline.
3. Si un step a plusieurs chemins de sortie, chaque branche doit poser son propre summary avant de retourner.
4. Les summaries doivent être courts, au présent, en français, concrets, sans secret, token, PII brute ni payload volumineux.

Exemple :

```python
from agent_platform import events, step

@step()
async def classify_product(product: dict) -> dict:
    typology = await classify(product)
    events.set_step_summary(
        f"Classé comme « {typology['label']} » avec {typology['confidence']:.0%} de confiance"
    )
    return typology
```

## Observabilité automatique (depuis 0.4.0)

**NE PAS** appeler manuellement `events.emit("workflow.started")` ni
`events.emit("workflow.completed")` ni `events.emit("workflow.failed")`.
Depuis 0.4.0, le SDK auto-instrumente chaque `@workflow` :

- `POST /v1/runs` au démarrage (la row apparaît dans l'UI Reborn Agents)
- `PATCH /v1/runs/{id}` au succès / sur exception (status final)
- Émission des events `workflow.started/completed/failed` avec `duration_ms`
- Pose le ContextVar `workflow_id` pour HITL / LLM logger

**Émettre vos propres events métier** reste utile et nécessaire :

```python
from agent_platform import events

@step()
async def scrape_price(pid: str) -> dict:
    result = ...
    events.emit("scraper.price.completed", {
        "product_id": pid,
        "source": "scraperapi",
        "found": result is not None,
    }, duration_ms=...)
    events.set_step_summary("Prix trouvé" if result is not None else "Aucun prix trouvé")
    return result
```

Le SDK auto-instrumente le niveau workflow. Pour tracer un sous-agent, un appel
LLM coûteux, un fan-in, etc., utilisez `events.emit("<domaine>.<action>", {...})`.
Pour rendre la timeline lisible par l'opérateur, utilisez aussi
`events.set_step_summary(...)` avant de retourner.

Doc complète : `sdk/docs/observability.md`.

## Réglages exposés dans l'UI (`@configurable`)

**OBLIGATOIRE** : tout `@workflow` ou `@agent` qui contient des constantes
métier que l'opérateur final devrait pouvoir ajuster sans redéploiement DOIT
être décoré par `@configurable({...})`. Sinon le dashboard Reborn Agents
n'affiche aucun réglage et l'opérateur est obligé de modifier le code.

**À exposer typiquement** : modèle LLM, température, seuils numériques,
nombre max d'itérations / de relances, toggles de comportement (`include_X`,
`dry_run`, `debug`), clés API tierces (`Secret`), URLs de callback, choix
d'un préset / persona / template, listes de canaux.

**Pas à exposer** : identifiants d'entités (`product_id`, `lead_id`), champs
d'input dynamiques du run.

```python
from agent_platform import workflow, configurable, Choice, IntRange, Toggle, Secret

@configurable({
    "llm_model": Choice(
        ["claude-sonnet-4-5", "claude-opus-4-5", "gpt-4o"],
        default="claude-sonnet-4-5",
        label="Modèle LLM",
    ),
    "max_scrape_pages": IntRange(1, 50, default=5, label="Pages scrappées max"),
    "include_notice": Toggle(default=True, label="Récupérer la notice produit"),
    "scraper_api_key": Secret(default="", label="Clé API ScraperAPI"),
})
@workflow(name="product_draft_builder", version=1, description="Génère une fiche produit complète à partir des sources fournisseur.")
async def product_draft_builder(product_id: str, *, config: dict | None = None) -> dict:
    cfg = config or {}
    if cfg.get("include_notice", True):
        ...
    # cfg.get("llm_model"), cfg.get("max_scrape_pages"), cfg.get("scraper_api_key")
```

**Règles de placement** :

- `@configurable` TOUJOURS AU-DESSUS de `@workflow` / `@agent`
- `config` est un kwarg-only injecté automatiquement par le SDK à l'exécution
- Ne pas déclarer `config` dans le payload d'entrée - il vient du dashboard
- Accès recommandé : `cfg = config or {}` puis `cfg.get("llm_model", "fallback")`

**12 types disponibles** (cf. skill `init-agent-platform` →
`references/configurable-types.md` pour les signatures exhaustives) :
`Choice`, `MultiSelect`, `IntRange`, `NumberRange`, `Number`, `Text`,
`LongText`, `Toggle`, `Secret`, `URL`, `Email`, `JSONField`. Tous acceptent
`default`, `description`, `label`, `required`.

**Pour les workflows à plusieurs sous-agents** : utiliser
`@configurable_section("nom_section", {...})` au-dessus de chaque `@step`
pour grouper les réglages par sous-domaine dans l'UI (cf. CHANGELOG
SDK 0.2.0).

**Comportement** : au boot, le SDK envoie un `config_schema` JSON Schema dans
`POST /v1/admin/definitions`. Le dashboard Core génère le formulaire UI à
partir de ce schema. Une valeur soumise via l'UI met à jour la row
`workflow_configs` et sera injectée au prochain run.

## OBLIGATOIRE - Reprise sur erreur (`@safe_step`)

**Règle bloquante** : tout `@step` qui reçoit des inputs métier qu'un opérateur
humain pourrait corriger DOIT être écrit avec `@safe_step(recoverable_inputs={...})`
au lieu de `@step`. Les champs corrigeables doivent être listés explicitement dans
`recoverable_inputs` avec un schéma exploitable par l'UI Core.

**Exemples d'inputs corrigeables** : email destinataire, URL fournisseur, montant,
devise, date d'échéance, identifiant externe, référence produit, payload fournisseur,
template métier, prompt métier, canal de publication.

**Pas corrigeable** : identifiant interne stable (`tenant_id`, `workflow_id`, clé
primaire BDD), valeur dérivée recalculable, compteur technique. Dans ce cas, garder
`@step` est autorisé, mais le design/détail doit documenter explicitement :
`Aucun input métier corrigeable`.

**Interdit** : remplacer ce pattern par un `try/except` manuel qui appelle
`wait_for_input` avec des options `retry/skip/escalate`. Ce faux pattern ne crée pas
le pending input `type="error_recovery"` et ne rend pas le formulaire de correction
`retry_with_input`.

Template correct :

```python
from agent_platform import Email, LongText, events, safe_step

@safe_step(
    recoverable_inputs={
        "customer_email": Email(
            label="Email destinataire",
            description="Adresse à corriger si l'envoi échoue.",
            required=True,
        ),
        "message": LongText(
            label="Message envoyé",
            description="Contenu métier modifiable avant un nouvel essai.",
            required=True,
        ),
    },
    retry_max_attempts=3,
)
async def send_outreach_email(customer_email: str, message: str) -> dict:
    result = await email_client.send(to=customer_email, body=message)
    events.set_step_summary("Email de prospection envoyé")
    return {"status": "sent", "provider_id": result.id}
```

`recoverable_inputs` accepte les types de configuration SDK (`Email`, `URL`,
`NumberRange`, `Choice`, `LongText`, etc.) ou des fragments JSON Schema `dict`.
Le SDK sérialise ces champs dans `metadata.error.recoverable_inputs`; le Core affiche
alors les actions `retry`, `retry_with_input` et `cancel` avec un formulaire prérempli
par `current_inputs`.

**Revue obligatoire** : une implémentation avec inputs métier corrigeables mais sans
`@safe_step(recoverable_inputs={...})` est un Fail bloquant.

## Déterminisme - cas obligatoirement dans `@step` / `@safe_step`

- Appels LLM (`llm.complete`, `llm.stream`, `llm.parse`)
- Appels HTTP externes (`httpx.AsyncClient`)
- Lectures BDD (asyncpg, ORM)
- `time.time()`, `datetime.now()`, `random.*`, `uuid.uuid4()`
- Lecture ou écriture de fichiers
- Toute opération non-déterministe

## HITL

Utiliser la signature réelle du SDK :

```python
# wait_for_input accepte options + metadata
await wait_for_input(
    prompt="Valide ?",
    options=["approve", "reject"],
    metadata={"lead_id": lead_id, "step": "approval"},
)

# wait_for_review prend un contenu et un prompt ; metadata est géré côté SDK
review = await wait_for_review(content=draft, prompt="Relis ce brouillon")

# wait_for_signal attend un signal externe nommé
payload = await wait_for_signal("external_payment_confirmed")
```

Les 3 primitives : `wait_for_input` (réponse libre/choix), `wait_for_review` (approve/reject + édition), `wait_for_signal` (signal externe).

Topic DBOS : `hitl:{pending_input_id}` (constante interne SDK - ne pas hardcoder).

## LLM

- Préférer `llm.complete` pour les cas non-streaming (retry intégré)
- Toujours spécifier `model="..."` explicitement (jamais de défaut implicite)
- JSON strict : `response_format="json_object"` + parser avec `llm.parse(..., schema=MyModel)`
- Modèles recommandés : `claude-sonnet-4-5`, `claude-opus-4-5`

## Clés API tierces (Décision N)

- Lecture via `os.environ["OPENAI_API_KEY"]` etc.
- JAMAIS stockées en BDD
- Documenter dans `.env.example` les variables nécessaires
- V2 (futur) : système central de secrets - pas en V1

## Tests

- 1 fichier de test par agent : `backend/tests/agents/test_<name>.py`
- Fixtures `workflow_runner`, `mock_llm`, `mock_hitl` ré-exportées par `conftest.py` depuis `agent_platform.testing`
- Couverture minimale : 1 test happy path + 1 test edge case (erreur LLM, refus HITL, etc.)

## Qualité code

- Type hints partout
- Max ~150 lignes par fichier
- Pas de TODO, jamais
- Français accentué dans docstrings et commentaires
- Pas d'état global mutable hors `AgentPlatform`
