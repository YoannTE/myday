# Index des SOPs

## Frontend

| SOP                                                                                     | ID                                    | Difficulte   | Tags                                              | Cree le    |
| ------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------ | ------------------------------------------------------ | ---------- |
| [Mapper les messages d'erreur par défaut des SDK/frameworks tiers vers le français](third-party-error-i18n.md) | frontend-third-party-error-i18n | intermediate | i18n, better-auth, error-handling, ux, francais, sdk-tiers | 2026-07-10 |
| [Rendre les assets PWA publics dans le middleware d'auth (Next 16 `proxy.ts`)](pwa-assets-public-proxy.md) | frontend-pwa-assets-public-proxy | intermediate | pwa, manifest, service-worker, middleware, proxy, nextjs-16, auth | 2026-07-11 |

## Backend

| SOP | ID  | Difficulte | Tags | Cree le |
| --- | --- | ---------- | ---- | ------- |
| [Vérifier l'enregistrement des routes FastAPI (piège `app.routes` sous fastapi 0.139+)](fastapi-route-registration-check.md) | backend-fastapi-route-registration-check | intermediate | fastapi, include_router, routing, introspection, version-gotcha, boot-check | 2026-07-11 |
| [Transposer un agent-design (agent-platform) en service FastAPI sans Core](agent-design-to-fastapi-service.md) | backend-agent-design-to-fastapi-service | advanced | agent-platform, sans-core, llm, anthropic, fallback, prêt-pour-ia | 2026-07-11 |
| [Garantir « au plus un envoi » pour un effet externe irréversible (mail)](at-most-once-external-send.md) | backend-at-most-once-external-send | advanced | envoi-mail, gmail, idempotence, irréversible, hitl, machine-etats | 2026-07-11 |

## DevOps

| SOP                                                                                  | ID                                          | Difficulte   | Tags                                             | Cree le    |
| ------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------ | --------------------------------------------------- | ---------- |
| [Docker multi-stage : copier explicitement les fichiers lus sur disque au runtime](docker-multistage-runtime-assets.md) | devops-docker-multistage-runtime-assets | intermediate | docker, multi-stage, drizzle, migrations, esbuild, runtime-assets | 2026-07-10 |

## General

| SOP                                                                                       | ID                                       | Difficulte | Tags                                                   | Cree le    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------- | ----------------------------------------------------------- | ---------- |
| [Contrat de casse des réponses API (snake_case) entre FastAPI et le frontend](api-response-casing-contract.md) | general-api-response-casing-contract | intermediate | api-contract, snake-case, pydantic, typescript, dual-stack, serialization | 2026-07-10 |
| [Auditer les fichiers issus des templates du starterkit à chaque round qui les touche](audit-templates-starterkit.md) | general-audit-templates-starterkit | beginner   | starterkit, templates, accents, better-auth, boilerplate, redirection | 2026-07-10 |
