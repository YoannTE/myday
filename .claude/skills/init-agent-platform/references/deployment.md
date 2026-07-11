<!-- Référence pédagogique de l'API SDK `agent-platform` accessible depuis le projet scaffoldé.
     En cas de doute sur une signature, introspecter le package installé :
     `python -c "import agent_platform, inspect; print(inspect.getsource(agent_platform.<symbole>))"`. -->

# Déploiement du SDK agent-platform

Pour les options de configuration runtime (`AgentPlatform.from_env`, var d'env), introspecter le SDK installé :
`python -c "from agent_platform import AgentPlatform; help(AgentPlatform.from_env)"`.

## Variables d'environnement runtime

Les 5 variables `AGENT_PLATFORM_*` sont à poser dans `.env.local` :

```bash
# URL du Core Reborn Agents (donné par /provision-tenant)
# Doit inclure le préfixe path exposé par ton reverse proxy (le SDK construit {URL}/v1/...).
# En prod Reborn (Traefik route /api/v1/* vers le backend FastAPI) :
#   AGENT_PLATFORM_URL=https://agents.reborn.dev/api
# En dev local du Core (pas de reverse proxy) :
#   AGENT_PLATFORM_URL=http://localhost:8000
AGENT_PLATFORM_URL=https://agents.reborn.dev/api

# Clé API du tenant (visible une seule fois à la création)
AGENT_PLATFORM_API_KEY=apk_xxx

# Postgres CENTRALE du Core - port 6432 DIRECT, PAS PgBouncer (SOP 10).
# NE PAS confondre avec DATABASE_URL (Postgres locale de l'app cliente).
# Format : postgresql://client_<slug>:<pwd>@<host-core>:6432/client_<slug>_dbos_sys
# Donné par /provision-tenant (Core >= 0.2.0). Si absent, récupère la DSN dans le panel admin.
AGENT_PLATFORM_DATABASE_URL=postgresql://client_acme:<pwd>@<host>:6432/client_acme_dbos_sys

# UUID du tenant (donné par /provision-tenant)
AGENT_PLATFORM_TENANT_ID=acme-uuid

# Nom libre de l'app cliente (pour l'observabilité dans le dashboard)
AGENT_PLATFORM_APP_NAME=acme-app
```

## Installation - Gemfury (CORR C3)

Le package est sur PyPI privé (Gemfury), **PAS** sur PyPI public.

**Via pip** :

```bash
pip install agent-platform \
  --index-url https://<token>@pypi.fury.io/<handle>/
```

**Via uv** (recommandé) - ajouter dans `pyproject.toml` :

```toml
[[tool.uv.index]]
name = "gemfury"
url = "https://<token>@pypi.fury.io/<handle>/"
explicit = true

[tool.uv.sources]
agent-platform = { index = "gemfury" }
```

Puis dans `[project] dependencies` :

```toml
"agent-platform>=0.4,<1.0",
```

## SEC-1 - Rôle Postgres dédié par tenant

Chaque tenant a un rôle `tenant_<slug>` avec les droits minimaux :

- `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`
- `CONNECT` uniquement sur sa propre DB `client_<slug>_dbos_sys`
- `REVOKE` sur toutes les autres DB tenant

Ce rôle est créé par `/provision-tenant` - l'app cliente ne le gère pas.

## SEC-4 - Override `verify_local_auth` obligatoire

L'endpoint `POST /api/agents/workflows/{name}/run` du SDK vérifie l'auth **locale**
de l'app cliente (Better-auth), PAS le SSO Reborn.

Sans cet override, tous les `POST /api/agents/workflows/*/run` retournent **403**.

```python
from agent_platform.fastapi_router import router, verify_local_auth
from app.auth.session import get_current_user

app.include_router(router, prefix="/api/agents")

# Override OBLIGATOIRE
app.dependency_overrides[verify_local_auth] = get_current_user
```

Voir le snippet complet dans `snippets/main-py-additions.py`.

## Healthcheck `/api/agents/health`

```json
{
  "status": "ok",
  "events_dropped_count": 0,
  "version": "0.1.0",
  "registered_workflows": 3
}
```

**Monitoring recommandé** : alerter si `events_dropped_count > 0` sur une
fenêtre de 5 minutes. Ce compteur augmente quand le flusher events perd des
messages (réseau vers Core coupé, buffer saturé).

## ⚠️ Uvicorn `--workers 1` OBLIGATOIRE (CORR H4)

DBOS est un singleton process-global. Avec `--workers N > 1` :

- N instances DBOS se lancent sur la même Postgres centrale
- N signal pollers actifs → conflits sur les tables `dbos.*`
- Events dupliqués vers le Core

**Pour scaler horizontalement** : déployer N replicas Dokploy, pas N workers.

```bash
# OK - un seul worker DBOS par process
uvicorn app.main:app --workers 1 --port 8000

# KO - ne pas faire
uvicorn app.main:app --workers 4 --port 8000
```

## Connectivité Postgres centrale

- **Port 6432 direct** (Postgres natif, PAS PgBouncer)
- DBOS effectue des DDL et des prepared statements au démarrage - incompatibles
  avec PgBouncer en transaction-mode
- 1 DB par tenant : `client_<slug>_dbos_sys`
- Schema `dbos.*` codé en dur (singleton SQLAlchemy DBOS)

**En développement local** : port 6432 exposé en hôte par le docker-compose du Core.

**En production** (réseau Docker interne Dokploy) : remplacer `localhost:6432`
par `postgres:5432` (nom du service Docker, port interne).

## SEC-3 - Credentials Postgres dans les logs

Le SDK attache un `DsnRedactingFilter` au boot pour masquer les mots de passe
dans les logs (`postgresql://user:***@...`).

Pattern recommandé pour éviter le mot de passe inline :

```bash
export AGENT_PLATFORM_DATABASE_URL="postgresql://client_acme@<host>:6432/client_acme_dbos_sys"
export PGPASSWORD="mon_mot_de_passe_secret"
```

## Setup hybride dev local + Core prod

Ce pattern est le cas d'usage principal pour un collaborateur sans accès au
repo `agent-platform-core` : l'API HTTP pointe vers le Core de prod
(`https://agents.reborn.dev`) mais la BDD DBOS tourne en local dans le
Postgres du projet.

### Variables d'environnement

```bash
# Core prod - fournis par /provision-tenant
AGENT_PLATFORM_URL=https://agents.reborn.dev/api
AGENT_PLATFORM_API_KEY=apk_xxx
AGENT_PLATFORM_TENANT_ID=<uuid-tenant>
AGENT_PLATFORM_APP_NAME=mon-app

# BDD DBOS locale - auto-provisionnée par le service dbos-init
# !!! PROD : remplacer par la DSN du Core avant tout déploiement !!!
AGENT_PLATFORM_DATABASE_URL=postgresql://app_admin:app_password_dev@localhost:5433/dbos_local
```

### Flux de démarrage

```bash
docker compose up -d          # démarre Postgres + MinIO + dbos-init (crée dbos_local)
npm run db:migrate            # applique les migrations Drizzle
uvicorn app.main:app --workers 1 --reload
```

Le service `dbos-init` est idempotent (pattern `SELECT 1 ... || CREATE DATABASE`) :
le relancer sur un volume déjà initialisé ne cause aucune erreur. Il termine
toujours en `Exited (0)`.

### En production

Remplacer `AGENT_PLATFORM_DATABASE_URL` par la DSN fournie par `/provision-tenant`.
Format : `postgresql://client_<slug>:<pwd>@<host-core>:6432/client_<slug>_dbos_sys`

Ne pas exposer le service `dbos-init` en prod (il peut rester dans le compose
mais ne fait rien si la BDD existe déjà).

### Alternative écartée : script SQL d'init via `/docker-entrypoint-initdb.d/`

Plus simple mais ne fonctionne que sur un volume Postgres vierge. Si l'utilisateur
a déjà lancé `docker compose up -d` avant de greffer agent-platform, le script
n'est jamais relu. Le service one-shot `dbos-init` gère les deux cas (volume
vierge et volume déjà initialisé).
