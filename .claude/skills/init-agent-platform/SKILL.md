---
name: init-agent-platform
description: "Greffe le SDK agent-platform dans une app dual-stack pour ajouter des agents IA durables. Invoque automatiquement pendant /start-structure si des agents IA sont detectes dans le brief, ou explicitement via /add-agents-platform."
---

# Init Agent Platform SDK

## Overview

Ce skill greffe le SDK `agent-platform` dans une app dual-stack (FastAPI + Next.js)
existante pour lui ajouter un sous-système d'agents IA durables, avec HITL, observabilité
et configurabilité.

**Quand l'utiliser** :

- Invoqué automatiquement par `/start-structure` si le brief mentionne des agents IA
- Invoqué explicitement par `/add-agents-platform`

**Prérequis** :

- Stack dual-stack obligatoire (`backend/` doit exister)
- Tenant provisionné via `/provision-tenant <slug> "<nom>"` au préalable
- SDK `agent-platform>=0.4,<1.0` publié sur Gemfury (tag git poussé), pour bénéficier de l'observabilité steps/LLM récente

## Règles obligatoires de lisibilité Op

Tout workflow ou exemple créé par ce skill doit respecter ces règles, car elles alimentent directement la vue Op du dashboard :

- Chaque `@workflow(...)` doit avoir `description="..."` avec une phrase courte en français métier, lisible par un opérateur non-tech.
- Chaque `@step` observable doit appeler `events.set_step_summary("...")` juste avant chaque `return`.
- Les sous-workflows utilisés par `parallel()` doivent aussi avoir une `description`, car ils apparaissent comme branches dans la timeline.
- Les summaries doivent être courts, concrets, en français, sans secret ni payload volumineux.

## Règles obligatoires de reprise sur erreur métier

Tout exemple ou workflow agent-platform généré par ce skill doit appliquer le
contrat `@safe_step(recoverable_inputs={...})` pour les steps qui reçoivent des
inputs métier corrigeables par un opérateur humain.

- Inputs typiquement corrigeables : email, URL, montant, devise, date, référence
  externe, payload fournisseur, template ou prompt métier.
- Si aucun input n'est corrigeable, le design/détail du step doit écrire
  explicitement : `Aucun input métier corrigeable`.
- Ne pas remplacer `@safe_step` par un `try/except` manuel + `wait_for_input` pour
  demander `retry/skip/escalate` : ce pattern ne produit pas le formulaire de
  correction `retry_with_input`.
- Lire `references/hitl-patterns.md` avant de générer ou modifier un workflow qui
  contient HITL, validation humaine, approbation, escalade ou reprise sur erreur.

## Préconditions à vérifier (étape 0)

Avant tout, vérifier deux conditions :

1. Stack dual-stack : `backend/` doit exister ou `.project/index.md` mentionne FastAPI
2. Section `## Agent Platform` dans `.project/decisions.md` (avec `tenant_id` + `slug`)

Si la section est absente → arrêter :

```
Lance `/provision-tenant <slug> "<nom>"` d'abord pour obtenir le tenant_id
et l'api_key, puis relance ce skill.
```

## 8 étapes idempotentes

Chaque étape teste l'état AVANT d'agir et skip si déjà fait.

---

### Étape 1 - Vérification tenant (re-check)

1. Lire `.project/decisions.md`
2. Chercher la section `## Agent Platform`
3. Si `tenant_id` présent → continuer
4. Si absent → erreur bloquante (voir préconditions)

---

### Étape 2 - Ajout dépendance Python (pyproject.toml OU requirements.txt)

Le starterkit dual-stack peut utiliser deux formats de manifest Python.
Détecter lequel est présent et patcher en conséquence :

1. **Cas A - `backend/pyproject.toml` existe** :
   - Si `"agent-platform"` déjà présent dans `[project] dependencies` → skip
   - Sinon : ajouter `"agent-platform>=0.4,<1.0"` dans la liste dependencies
2. **Cas B - `backend/requirements.txt` existe (pas de pyproject.toml)** :
   - Si une ligne `agent-platform` est déjà présente → skip
   - Sinon : ajouter `agent-platform>=0.4,<1.0` en fin de fichier
3. **Cas C - Ni l'un ni l'autre** : arrêter avec « Aucun manifest Python
   trouvé dans `backend/`. Vérifie que tu es dans un projet dual-stack. »

Dans les deux cas A et B, expliquer à l'utilisateur que le package est sur
Gemfury (PyPI privé), pas sur PyPI public. Référence : `snippets/pyproject-additions.toml`
(inclut la config index Gemfury pour `pyproject.toml`, et la commande
`pip install --index-url ...` pour `requirements.txt`).

---

### Étape 3 - Structure `backend/agents/` (DOIT être faite AVANT l'étape 4)

**Ordre important** : créer le dossier `agents/` ET le template `qualify_lead.py`
AVANT de modifier `main.py`. Sinon, si l'utilisateur redémarre le serveur entre
les deux étapes, il obtient `ModuleNotFoundError: app.agents.qualify_lead`.

1. Si `backend/agents/` existe déjà → skip toute cette étape
2. Créer `backend/agents/__init__.py` (vide)
3. Créer `backend/agents/README.md` avec la convention : 1 workflow par fichier, snake_case
4. Créer `backend/agents/qualify_lead.py` (template d'exemple) :

```python
"""TEMPLATE D'EXEMPLE généré automatiquement par le skill init-agent-platform.

Ce fichier n'a PAS été créé par un agent ou par l'utilisateur - c'est un
workflow factice qui sert de :
- test de fumée (preuve que la greffe agent-platform fonctionne)
- référence syntaxique (forme d'un @workflow + @step avec llm.complete)
- point d'ancrage pour l'import dans main.py (from app.agents import qualify_lead)

3 options selon ton projet :

1. LE GARDER comme test de fumée tant que tu n'as pas de vrai workflow.
2. LE RENOMMER en <ton_workflow>.py, adapter la signature @workflow(name="...", description="..."),
   puis MAJ l'import dans backend/app/main.py.
3. LE SUPPRIMER si tu veux un projet propre vide. Dans ce cas, retire AUSSI
   l'import 'from app.agents import qualify_lead' dans backend/app/main.py,
   sinon ModuleNotFoundError au prochain boot.
"""
from agent_platform import workflow, step, llm, events


@workflow(
    name="qualify_lead",
    version=1,
    description="Qualifie un lead entrant à partir des informations disponibles.",
)
async def qualify_lead(lead_id: str) -> dict:
    enriched = await enrich_lead(lead_id)
    return {"status": "done", "lead_id": lead_id, "data": enriched}


@step()
async def enrich_lead(lead_id: str) -> dict:
    response = await llm.complete(
        model="claude-sonnet-4-5",
        messages=[{"role": "user", "content": f"Enrich lead {lead_id}"}],
    )
    events.set_step_summary(f"Lead {lead_id} enrichi par le LLM")
    return {"summary": response.content}
```

---

### Étape 4 - Modification `backend/app/main.py` (C1 + C2 + M1)

**Précondition** : l'étape 3 a créé `backend/agents/qualify_lead.py`. Sinon
l'import inséré ici plantera au démarrage avec `ModuleNotFoundError`.

1. Lire `backend/app/main.py`
2. **Check idempotence renforcé** - tester DEUX marqueurs séparément :
   - `"agent_platform"` (substring large) ET `"agent_platform_router"` présents → skip (déjà patché)
   - UN seul présent → log `WARNING : état partiellement patché, intervention manuelle requise`
     puis suggérer un Edit ciblé
   - AUCUN présent → procéder à l'ajout
3. Insérer selon `snippets/main-py-additions.py` :
   - Pattern **lifespan** avec `asynccontextmanager` (PAS `@app.on_event` - déprécié)
   - Import `from app.agents import qualify_lead` (PAS `backend.agents` - PYTHONPATH = `backend/`)
   - Override `verify_local_auth` avec `get_current_user` (SEC-4 obligatoire)

---

### Étape 5a - Variables d'environnement (H3)

1. Lire `backend/.env.example`
2. Si les variables `AGENT_PLATFORM_*` sont déjà présentes → skip
3. Sinon : ajouter le contenu de `snippets/env-vars.txt` en fin de fichier

Le bloc commentaire distingue le cas dev local (DSN pré-remplie, fonctionnelle
immédiatement) du cas prod (OBLIGATOIRE de remplacer, warning bruyant dans le snippet).

---

### Étape 5b - Provisionnement auto de la BDD DBOS locale

**Pré-requis** : l'utilisateur `${POSTGRES_USER}` doit avoir `CREATEDB`.
Par défaut, l'image officielle `postgres:16-alpine` lui donne `SUPERUSER`
(donc `CREATEDB`). Si le projet a personnalisé les droits, ajouter
`GRANT CREATEDB TO ${POSTGRES_USER};` dans le script d'init Postgres
avant de relancer ce skill.

1. Si `dbos-init:` est déjà présent dans `docker-compose.yml` → skip toute cette étape
2. Lire `docker-compose.yml`
3. Insérer le bloc du snippet `snippets/docker-compose-dbos-init.yml` :
   - **AVANT** la clé `volumes:` de premier niveau (la section globale, pas celle d'un service)
   - **APRÈS** le dernier service existant (`postgres`, `minio`, `minio-init` ou autres)
   - **NE JAMAIS** dupliquer la clé `volumes:` de premier niveau - si elle apparaît
     plusieurs fois dans le fichier résultant, le YAML est invalide et `docker compose up`
     échoue
4. Lancer la création :

   ```bash
   docker compose up -d dbos-init
   ```

**Message à afficher après l'étape :**

```
BDD dbos_local créée (ou déjà existante - idempotent).
Le container dbos-init apparaîtra en statut Exited (0) dans docker ps -a -
c'est normal, c'est un container one-shot qui termine après avoir créé la BDD.
Pour le ré-exécuter manuellement : docker compose up -d dbos-init
```

---

### Étape 6 - Doc connectivité Postgres centrale dans `decisions.md`

1. Lire `.project/decisions.md`
2. Si section `## Agent Platform - connectivité Postgres centrale` déjà présente → skip
3. Sinon : ajouter la section :

```markdown
## Agent Platform - connectivité Postgres centrale

La DB `client_<slug>_dbos_sys` est provisionnée par `/provision-tenant`.
DBOS se connecte en direct sur le port 6432 (Postgres direct, PAS PgBouncer - SOP 10).
Ne pas confondre avec `DATABASE_URL` (Postgres locale de cette app).
Format : `postgresql://client_<slug>:<pwd>@<host-core>:6432/client_<slug>_dbos_sys`
```

---

### Étape 7 - Structure `backend/tests/agents/`

1. Si `backend/tests/agents/` existe déjà → skip toute cette étape
2. Créer `backend/tests/agents/__init__.py` (vide)
3. Créer `backend/tests/agents/conftest.py` :

```python
"""Fixtures ré-exportées depuis agent_platform.testing pour les tests d'agents."""
from agent_platform.testing import workflow_runner, mock_llm, mock_hitl

__all__ = ["workflow_runner", "mock_llm", "mock_hitl"]
```

---

### Étape 8 - MAJ `.project/index.md` + `.project/patterns.md`

**index.md** :

1. Lire `.project/index.md`
2. Si `Agents IA` déjà dans la section `## Stack` → skip
3. Sinon : ajouter `+ Agents IA` à la ligne Stack

**patterns.md** :

1. Lire `.project/patterns.md`
2. Si section `## Déclencher un agent depuis un endpoint métier` déjà présente → skip
3. Sinon : ajouter :

````markdown
## Déclencher un agent depuis un endpoint métier

```python
# Dans un endpoint FastAPI - le platform est disponible via app.state
handle = await platform.start_workflow("qualify_lead", input={"lead_id": lead_id})
return {"workflow_id": handle.workflow_id}
```
````

Pour attendre le résultat synchronement : `await platform.run_workflow(...)`.

```

---

## Résumé final (template d'output)

Afficher à la fin du skill :

```

init-agent-platform terminé.

Étapes :

- Étape 1 (tenant) : OK / SKIP
- Étape 2 (pyproject) : OK / SKIP
- Étape 3 (main.py) : OK / SKIP / WARNING partiel
- Étape 4 (agents/) : OK / SKIP
- Étape 5a (.env.example) : OK / SKIP
- Étape 5b (dbos-init docker) : OK / SKIP
- Étape 6 (decisions.md) : OK / SKIP
- Étape 7 (tests/agents/) : OK / SKIP
- Étape 8 (index + patterns): OK / SKIP

Prochaine étape :

1. Installer le SDK depuis Gemfury :
   pip install agent-platform --index-url https://<token>@pypi.fury.io/<handle>/
2. Le fichier backend/agents/qualify_lead.py est un TEMPLATE D'EXEMPLE généré
   par ce skill (pas un vrai workflow). Adapte-le pour ton premier vrai workflow,
   ou supprime-le proprement (avec son import dans backend/app/main.py).
3. Lancer ton premier workflow avec /code N (où N est le round qui crée tes agents)

⚠️ IMPORTANT : Lancer Uvicorn avec --workers 1 (DBOS ne supporte pas le multi-process).
Pour scaler horizontalement → déployer N replicas Dokploy plutôt que N workers.

```

```
