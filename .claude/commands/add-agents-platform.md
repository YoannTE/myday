Greffe le SDK agent-platform dans l'app courante pour ajouter des agents IA durables.

# /add-agents-platform

Greffe le SDK `agent-platform` (DBOS + agents IA) dans une app dual-stack existante.
Lance cette commande dans le dossier d'une app dual-stack après `/provision-tenant`.

Pas d'argument. Toutes les étapes sont idempotentes (re-run safe).

---

## Préconditions

- **Stack dual-stack obligatoire** : FastAPI + Next.js + Postgres.
- **Tenant provisionné** : section `## Agent Platform` dans `.project/decisions.md`.
- **SDK installable** : token PyPI privé Gemfury configuré (fourni par `/provision-tenant`).

---

## Étape 1 - Vérifier la stack

Lire `.project/index.md`, section `## Stack`.

Si « FastAPI » est absent de la section Stack, ou si le dossier `backend/` n'existe pas dans le projet courant → **BLOQUER** avec ce message :

```
Cette greffe nécessite une stack dual-stack (FastAPI + Next.js).
Ton app est en frontend-only. 3 options :
1. Pivoter vers dual-stack (lance `/feature ajouter un backend FastAPI`)
2. Ajourner les agents IA pour une V2
3. Annuler
```

Sinon → continuer.

---

## Étape 2 - Vérifier le tenant

Lire `.project/decisions.md`, chercher la section `## Agent Platform`.

Si absente → **BLOQUER** avec ce message :

```
Aucun tenant Reborn Agents configuré.
Lance `/provision-tenant <slug-de-ton-app> "<nom de ton app>"` d'abord.
Cela créera un tenant côté Core et te donnera les 5 lignes copier-collables :
  AGENT_PLATFORM_URL, AGENT_PLATFORM_API_KEY, AGENT_PLATFORM_DATABASE_URL,
  AGENT_PLATFORM_TENANT_ID, AGENT_PLATFORM_APP_NAME
Colle-les dans backend/.env.local puis relance /add-agents-platform.
```

Sinon → continuer.

---

## Étape 3 - Invoquer le skill `init-agent-platform`

Invoquer le skill `init-agent-platform`. Il exécute 8 étapes idempotentes :

1. Vérification tenant dans `decisions.md`
2. Ajout de `agent-platform>=0.4,<1.0` dans `backend/pyproject.toml` ou `backend/requirements.txt`
3. Patch de `backend/app/main.py` (imports, lifespan, router `/api/agents`)
4. Création de `backend/agents/` avec `__init__.py` + template `qualify_lead.py`
5. Ajout des 5 variables `AGENT_PLATFORM_*` dans `backend/.env.example`
6. Note connectivité Postgres centrale dans `decisions.md`
7. Création de `backend/tests/agents/` avec `conftest.py` (fixtures testing)
8. Mise à jour de `.project/index.md` + `patterns.md`

Le skill gère lui-même l'idempotence - re-run safe.

---

## Étape 3bis - Vérifier l'override `verify_local_auth`

Après le skill, lire `backend/app/main.py` et vérifier que la ligne suivante est présente :

```python
app.dependency_overrides[verify_local_auth] = get_current_user
```

Si absente → **ALERTER** :

```
⚠️  verify_local_auth N'EST PAS surchargé dans main.py.
Sans cette ligne, TOUS les POST /api/agents/workflows/*/run retournent 403.
Le skill init-agent-platform a normalement ajouté l'override automatiquement.
Vérifie ton main.py manuellement et adapte get_current_user à ton implémentation.
Modèle dans : skills/init-agent-platform/snippets/main-py-additions.py
```

---

## Étape 4 - Mettre à jour `.project/index.md`

Lire `.project/index.md`, section `## Stack`.

Si `+ Agents IA` est déjà présent → skip.
Sinon → ajouter `+ Agents IA` à la fin de la ligne Stack.

---

## Étape 5 - Confirmer à l'utilisateur

```
Greffe `agent-platform` terminée !

Tu peux maintenant créer des agents dans `backend/agents/<name>.py`.
Crée un round dédié dans la roadmap via `/feature ajouter un agent qualify_lead`,
ou ajoute des features qui mentionnent « agent IA » et le pipeline saura
déléguer à `agent-platform-developer`.

⚠️  IMPORTANT : Lancer Uvicorn avec `--workers 1` (DBOS singleton process-global).
   Exemple : uvicorn app.main:app --workers 1 --port 8000
   Pour scaler : déployer N replicas Dokploy plutôt que N workers par process.

Prochaine étape : `/code 1` (ou le round où tu crées tes premiers agents).
```
