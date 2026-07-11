<!-- Référence pédagogique de l'API SDK `agent-platform` accessible depuis le projet scaffoldé.
     En cas de doute sur une signature, introspecter le package installé :
     `python -c "import agent_platform, inspect; print(inspect.getsource(agent_platform.<symbole>))"`. -->

# Patterns HITL (Human-in-the-Loop)

Pour les signatures exactes des primitives HITL, introspecter le SDK installé :
`python -c "from agent_platform import wait_for_input, wait_for_review, wait_for_signal, safe_step; help(wait_for_input); help(safe_step)"`.

## Les 3 primitives volontaires

```python
from agent_platform import hitl

# 1. Réponse libre utilisateur
decision = await hitl.wait_for_input(
    prompt="Approuver cet envoi ?",
    options=["approve", "reject", "modify"],
    timeout_days=7,
    metadata={"lead_id": lead_id, "context": "outreach v2"},
)
# decision.value: str  - option choisie
# decision.reason: str | None
# decision.user_id: str  - Better-auth user id
# decision.timestamp: datetime

# 2. Review d'un contenu (l'utilisateur peut éditer)
review = await hitl.wait_for_review(
    content="Brouillon généré par l'agent...",
    prompt="Relisez et validez ce contenu",
    timeout_days=7,
    metadata={"doc_id": doc_id},
)
# review.approved: bool
# review.content: str   - potentiellement édité par l'utilisateur
# review.user_id: str
# review.reason: str | None

# 3. Signal métier arbitraire (intégrations externes)
payload = await hitl.wait_for_signal(
    name="external_event",
    timeout_days=7,
    metadata={"integration": "stripe", "invoice_id": inv_id},
)
```

Ces primitives sont pour les pauses humaines **volontaires**. Elles ne remplacent
pas la reprise sur erreur métier automatique : pour un step qui peut échouer à cause
d'inputs corrigeables par un humain, utiliser `@safe_step(recoverable_inputs=...)`.

## Reprise durable après crash

Si le process FastAPI redémarre pendant un `wait_for_*`, DBOS reprend l'attente
depuis T0 - le workflow ne repart pas de zéro. Le timeout est durable (commence
au premier appel, pas au redémarrage).

Le topic interne est `hitl:{pending_input_id}`. Ne pas le hardcoder côté
utilisateur - il est géré par le SDK via la constante `HITL_TOPIC_PREFIX`
de `_internal/constants.py`.

## `@safe_step` avec dedup retries et formulaire de correction

Pour les opérations sensibles ou métiers qui peuvent échouer à cause d'un input
corrigeable (email invalide, URL fournisseur cassée, montant/devise/date rejetés par
une API externe), le pattern correct est `@safe_step(recoverable_inputs={...})`.

```python
from agent_platform import Email, LongText, events, safe_step

# Le @step DBOS interne retry jusqu'à retry_max_attempts.
# Si l'erreur persiste, @safe_step crée un pending_input type="error_recovery".
# Le Core affiche alors retry / retry_with_input / cancel et préremplit le formulaire
# avec current_inputs pour les champs listés dans recoverable_inputs.
@safe_step(
    recoverable_inputs={
        "customer_email": Email(
            label="Email destinataire",
            description="Adresse email à corriger si l'envoi échoue.",
            required=True,
        ),
        "template": LongText(
            label="Template de prospection",
            description="Message métier modifiable avant un nouvel essai.",
            required=True,
        ),
    },
    retry_max_attempts=3,
)
async def send_outreach_email(customer_email: str, template: str) -> dict:
    result = await email_client.send(to=customer_email, body=template)
    events.set_step_summary("Email de prospection envoyé")
    return {"status": "sent", "provider_id": result.id}
```

Règles :

- `recoverable_inputs` liste uniquement les paramètres réellement corrigeables par
  l'opérateur ; ne pas y mettre `tenant_id`, `workflow_id` ou une clé BDD interne.
- Le schéma peut utiliser les types SDK (`Email`, `URL`, `NumberRange`, `Choice`,
  `LongText`, etc.) ou un dict JSON Schema.
- Si aucun input métier n'est corrigeable, garder `@step` et documenter explicitement
  `Aucun input métier corrigeable` dans le design/détail du step.
- Ne pas écrire un `try/except` manuel autour du step pour demander `retry/skip` via
  `wait_for_input` : ce pattern ne produit pas le formulaire `retry_with_input`.

## `error_recovery` : récupérer un échec avec aide humaine

`error_recovery` est le type de pending input créé automatiquement par `@safe_step`
après épuisement des retries DBOS. Le payload envoyé au Core contient notamment :

```json
{
  "type": "error_recovery",
  "metadata": {
    "error": {
      "exception_type": "ValueError",
      "message": "invalid email",
      "step_name": "send_outreach_email",
      "recoverable_inputs": {
        "customer_email": { "type": "string", "format": "email" }
      },
      "current_inputs": {
        "customer_email": "bad-email"
      }
    }
  }
}
```

L'opérateur voit trois actions exclusives :

- `retry` : réessayer sans modifier les inputs ;
- `retry_with_input` : corriger les champs listés dans `recoverable_inputs` ; la
  résolution contient alors `corrected_inputs` pour la reprise prévue par le code/SDK ;
- `cancel` : annuler le run avec une raison métier.

Dans le SDK actuel, `recover_from_error` retourne la résolution brute
`{"action", "corrected_inputs", "reason"}` au wrapper `@safe_step`. Ne pas promettre
une réexécution applicative magique si le code appelant attend un type métier strict :
prévoir le comportement attendu dans le design et les tests.

### Appel manuel exceptionnel

Un appel manuel à `recover_from_error` n'est acceptable que pour migrer un vieux code
qui ne peut pas encore être décoré avec `@safe_step`. Il doit quand même déclarer les
champs corrigeables :

```python
from agent_platform import Email, hitl

try:
    result = await legacy_call(customer_email)
except Exception as exc:
    recovery = await hitl.recover_from_error(
        exc,
        recoverable_inputs={
            "customer_email": Email(
                label="Email destinataire",
                description="Adresse email à corriger avant nouvel essai.",
                required=True,
            ),
        },
        current_inputs={"customer_email": customer_email},
        step_name="legacy_call",
    )
    return recovery
```

## Règles essentielles

- Toujours passer `metadata` aux primitives HITL volontaires - le dashboard Core
  l'affiche pour contextualiser la pending_input auprès de l'opérateur humain.
- Pour la reprise sur erreur métier, préférer `@safe_step(recoverable_inputs=...)`.
- `wait_for_input` POST sur `/v1/runs/{id}/pending-input`, puis `DBOS.recv(topic=...)`.
- Le signal poller détecte la résolution et appelle `DBOS.send(...)` localement
  pour réveiller le workflow.

## Exemples concrets

**Approval workflow** : scoring d'un lead → HITL si score borderline → envoi outreach.

**Content moderation** : génération d'un post → HITL review+édition → publication.

**Lead qualification HITL** : enrichissement automatique + scoring → validation humaine
pour les leads entre 40 et 70, rejet/acceptation automatique hors de cette plage.

**Error recovery corrigeable** : envoi email / facture / publication externe via
`@safe_step(recoverable_inputs=...)` → formulaire opérateur `retry_with_input` si
l'API rejette les données métier après retries.
