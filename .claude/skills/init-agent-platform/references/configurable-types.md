<!-- Référence pédagogique de l'API SDK `agent-platform` accessible depuis le projet scaffoldé.
     En cas de doute sur une signature, introspecter le package installé :
     `python -c "import agent_platform, inspect; print(inspect.getsource(agent_platform.<symbole>))"`. -->

# Types `@configurable`

Pour les signatures exactes des types, introspecter `agent_platform.configurable` dans le venv :
`python -c "import agent_platform.configurable, inspect; print(inspect.getsource(agent_platform.configurable))"`.

## Les 12 types disponibles

```python
from agent_platform import (
    Choice,       # menu déroulant - sélection unique
    MultiSelect,  # multi-checkboxes - sélection multiple
    IntRange,     # slider entier dans une plage
    NumberRange,  # slider float dans une plage
    Number,       # entier libre
    Text,         # texte court (max 200 caractères)
    LongText,     # textarea (max 5000 caractères)
    Toggle,       # switch on/off
    Secret,       # secret masqué dans l'UI, stocké chiffré
    URL,          # URL avec validation de format
    Email,        # email avec validation de format
    JSONField,    # JSON libre validé (pydantic schema optionnel)
)
```

## Exemples concrets d'usage

```python
Choice(["formal", "casual"], default="casual", label="Ton des emails")
MultiSelect(["email", "sms", "slack"], default=["email"], label="Canaux de notif")
IntRange(1, 100, default=50, label="Seuil de score minimum")
NumberRange(0.0, 1.0, default=0.5, label="Température LLM")
Number(default=10, label="Nombre max de relances")
Text(default="", label="Préfixe objet email")
LongText(default="", label="Prompt système personnalisé")
Toggle(default=False, label="Mode debug")
Secret(default="", label="Clé API webhook")
URL(default="", label="Endpoint de callback")
Email(default="", label="Email de copie cachée")
JSONField(default={}, label="Paramètres avancés")
```

Tous ont les champs : `default`, `description`, `label`, `required`.

## Décorateur `@configurable`

```python
from agent_platform import configurable, workflow, Choice, IntRange, LongText

@configurable({
    "tone": Choice(["formal", "casual"], default="casual", label="Ton des emails"),
    "max_followups": IntRange(1, 5, default=3, label="Relances max"),
    "company_voice": LongText(default="", label="Voix de marque"),
})
@workflow(name="sdr_outbound", version=1, description="Prépare une séquence de prospection commerciale personnalisée.")
async def sdr_outbound(lead_id: str, *, config) -> dict:
    if config.tone == "formal":
        template = "formal_outreach"
    else:
        template = "casual_outreach"
    # config.max_followups, config.company_voice, etc.
    return {"template": template, "lead_id": lead_id}
```

**Règles de placement** :

- `@configurable` TOUJOURS AU-DESSUS de `@workflow` (ou `@agent`)
- `config` est un kwarg-only injecté automatiquement à l'exécution
- Ne pas déclarer `config` dans la signature - le SDK l'injecte

## Comportement au boot et à l'exécution

**Au boot** : le SDK inspecte tous les décorateurs `@configurable`,
génère un `config_schema` (JSON Schema), et POST `/v1/admin/definitions`.
Si aucune row `workflow_configs` pour ce tenant → créée avec les valeurs `default`.

**À l'exécution** :

1. SDK lit les valeurs courantes via `GET /v1/configs/{name}`
2. Construit un `AgentConfig` (pydantic dataclass typée)
3. Injecte dans la signature : `sdr_outbound(lead_id="...", config=config_obj)`
4. Crée un snapshot dans `workflow_runs.config_snapshot` pour l'observabilité

## Validation

Pydantic valide au save dans le Core → erreur 422 avec détails par champ si
une valeur soumise via le dashboard ne respecte pas les contraintes du type.

## Génération d'UI automatique

Le dashboard Core lit le `config_schema` posté au boot et génère l'interface
d'administration des paramètres. L'utilisateur final n'a pas à écrire de code UI.
