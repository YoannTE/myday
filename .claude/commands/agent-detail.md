Détaille les steps d'un workflow agent-platform SDK-native dans .project/agent-design.md


Commande dédiée au détail d'implémentation des steps d'un workflow **SDK-native agent-platform**.
Enrichit `.project/agent-design.md`, section `## 11. Détail par step`, sans LangGraph.

Arguments Claude Code :

- `$1` = nom du workflow, ex: `qualify_lead`
- `$2` = step ciblé ou `all` ; optionnel, défaut mental : `all`
- `${@:3}` = instructions libres complémentaires
- `$@` = tous les arguments bruts

Invocation : `/agent-detail <workflow-name> [step-name|all] [instructions]`

Workflow : `$1`
Cible : `$2`
Instructions : `${@:3}`

---

## Règles non négociables

1. Ne jamais introduire LangGraph, nodes/edges LangGraph ou imports directs `dbos`, `langgraph`, `litellm`.
2. Tout détail doit rester compatible SDK `agent_platform` : `@workflow`, `@step`, `llm`, HITL, `@configurable`, `parallel()`.
3. Chaque step observable détaillé doit inclure le résumé Op exact attendu pour `events.set_step_summary(...)`, à poser juste avant chaque `return` dans l'implémentation.
4. Chaque step détaillé doit déclarer `@safe_step` requis avec `recoverable_inputs={...}` si des inputs métier sont corrigeables, ou écrire exactement `Aucun input métier corrigeable`.
5. Écrire immédiatement chaque step détaillé dans `.project/agent-design.md`.
6. Si un step est déjà détaillé, ne pas le réécrire sauf si `$2` le cible explicitement ou si `${@:3}` demande une correction.
7. Les chemins de données doivent être précis (`input.foo`, `state.bar`, `result.baz`).

---

## Prérequis

Vérifier :

1. `.project/agent-design.md` existe.
2. Son frontmatter contient :
   - `kind: agent-platform-design`
   - `sdk: agent-platform`
   - `langgraph: false`
   - `workflow: $1`
   - `status: validated` ou demander confirmation avant modification si `draft`.
3. La section `## 3. Steps` contient au moins un step à détailler.

Si absent :

> `.project/agent-design.md` est absent ou ne décrit pas le workflow `$1`.
> Lance d'abord `/agent-design $1`.

---

## Processus

1. Lire `.project/agent-design.md` intégralement.
2. Lire le contexte projet disponible : `.project/app.md`, `.project/decisions.md`, `.project/patterns.md`.
3. Extraire les steps depuis `## 3. Steps`.
4. Déterminer la liste à traiter :
   - si `$2` est vide ou `all`, traiter tous les steps non détaillés ;
   - sinon traiter uniquement le step `$2`.
5. Si `.project/agent-design.md` est `validated`, repasser temporairement :
   - `status: draft`
   - `detail_validated_at: ""`
6. Pour chaque step ciblé, ajouter une sous-section sous `## 11. Détail par step`.
7. Faire une vérification croisée inputs/outputs/config/recovery.
8. Quand l'utilisateur valide, repasser :
   - `status: validated`
   - `detail_validated_at: <YYYY-MM-DD>`

---

## Format obligatoire par step

Ajouter exactement ce format pour chaque step :

````markdown
### `<step_name>`

**Type SDK** : `@step` pure | `@step` LLM | `@step` tool | HITL | sous-workflow
**Fonction cible** : `async def <step_name>(...) -> ...`
**Responsabilité** : ...

#### Contrat d'entrée

| Champ     | Source               | Type  | Obligatoire | Validation |
| --------- | -------------------- | ----- | ----------- | ---------- |
| `state.x` | step précédent/input | `str` | oui         | ...        |

#### Contrat de sortie

| Champ     | Destination           | Type   | Exemple | Consommateurs |
| --------- | --------------------- | ------ | ------- | ------------- |
| `state.y` | workflow state/result | `dict` | ...     | ...           |

#### Implémentation SDK attendue

```python
from agent_platform import step, safe_step, llm, events

# Si inputs métier corrigeables : remplacer @step par @safe_step(recoverable_inputs={...}).
# Sinon documenter : Aucun input métier corrigeable.
@step(name="<step_name>", retry_max_attempts=..., timeout_seconds=...)
async def <step_name>(...) -> ...:
    result = ...
    events.set_step_summary("<résumé Op court en français>")
    return result
```

#### Prompt / LLM

Si le step utilise un LLM, fournir :

- **Model/config key** : ...
- **System prompt** :

```text
...
```

- **User prompt template** :

```text
...
```

- **Schema de sortie** : JSON Schema ou Pydantic strict.
- **Parsing** : règle de validation et fallback.

Si le step n'utilise pas de LLM, écrire `N/A`.

#### Tools et effets externes

- APIs appelées
- Secrets/config nécessaires
- Idempotency key
- Rate limit
- Compensation en cas d'échec après effet externe

#### HITL

Si le step attend un humain : primitive (`wait_for_input`, `wait_for_review`, `wait_for_signal`), payload envoyé, options, timeout, reprise.
Sinon : `Aucun HITL dans ce step`.

#### Reprise sur erreur / `@safe_step`

- `@safe_step` requis : oui/non
- Inputs métier corrigeables : liste des champs ou `Aucun input métier corrigeable`
- `recoverable_inputs` exact attendu :

```python
recoverable_inputs={
    "champ": {
        "type": "string",
        "label": "Libellé opérateur",
        "description": "Pourquoi/comment l'opérateur peut corriger ce champ.",
        "required": True,
    }
}
```

Ne pas proposer un `try/except` manuel + `wait_for_input` pour simuler `error_recovery`.

#### Observability

- Summary Op obligatoire : phrase exacte pour `events.set_step_summary(...)`, courte, au présent, en français, sans secret ni payload volumineux
- Events métier à émettre
- Logs structurés
- Métriques
- Champs de corrélation (`workflow_id`, `tenant_id`, etc.)

#### Recovery et failure modes

| Failure mode | Cause | Comportement SDK  | Fallback | Escalade |
| ------------ | ----- | ----------------- | -------- | -------- |
| ...          | ...   | retry/replay/fail | ...      | ...      |

#### Tests requis

- Cas nominal
- Erreur LLM/tool
- Retry/replay/idempotence
- Timeout
- HITL si applicable
````

---

## Vérification finale

Avant validation, contrôler :

- chaque step ciblé a une sous-section `###` ;
- chaque input a un producteur ou vient de l'input initial ;
- chaque output est consommé ou terminal ;
- chaque config utilisée est déclarée en `## 5. Config SDK` ;
- chaque appel externe a idempotence/retry/recovery ;
- chaque step LLM a prompt, schema de sortie et stratégie parsing ;
- chaque step observable a un summary Op défini pour `events.set_step_summary(...)` ;
- chaque step à inputs métier corrigeables a `@safe_step` requis et un `recoverable_inputs` complet ;
- chaque step sans input corrigeable écrit `Aucun input métier corrigeable` ;
- aucun texte ne mentionne LangGraph comme mécanisme d'implémentation.

Message final attendu :

> Détail SDK-native validé dans `.project/agent-design.md` pour `$1`.
> Tu peux lancer `/roadmap` puis coder `backend/agents/$1.py` avec `agent-platform-developer`.

```

```
