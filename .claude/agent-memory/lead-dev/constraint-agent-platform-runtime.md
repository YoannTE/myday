---
name: constraint-agent-platform-runtime
description: Agent Platform impose Uvicorn --workers 1 (DBOS singleton) et Postgres direct port 6432 — impact concurrence backend
metadata:
  type: project
---

Agent Platform (DBOS) activée sur MyDay impose deux contraintes runtime issues du kit :
- **Uvicorn `--workers 1`** (singleton DBOS process-global) : tout le backend FastAPI multi-utilisateurs tourne dans un seul process. OK en async I/O, mais toute étape CPU sérialise l'ensemble des requêtes de tous les comptes.
- **Postgres central en connexion directe port 6432, PAS PgBouncer** (SOP 10) — sinon les workflows durables échouent au boot.

**Why:** le brief activait Agent Platform sans mentionner l'impact concurrence ni l'infra Postgres.

**How to apply:** dans les revues, exiger que les endpoints HTTP restent fins (validation + enqueue + lecture BDD) et que tout traitement lourd (sync, scoring LLM, brief) passe par un `@workflow`/`@step` durable hors requête HTTP. Vérifier la connectivité Postgres directe dès le provisioning du tenant (Round 1).
