---
name: pitfalls-dualstack-bootstrap
description: Pièges récurrents du bootstrap dual-stack MyDay (seed, cookie cross-stack, migrations au boot, ordre conteneurs, admin prod)
metadata:
  type: project
---

Pièges vérifiés lors de la revue du Round 001 « Fondations » (à re-checker sur tout round touchant le socle) :

- **Seed non idempotent** : `auth.api.signUpEmail` lève « email déjà utilisé » au 2e run. Exiger check d'existence préalable + UPDATE séparé pour `role=admin` (signUpEmail ne pose pas toujours l'additionalField).
- **Cookie Better-auth cross-stack** : format `<token>.<signature HMAC>`, préfixe `__Secure-` en prod. `get_current_user` (FastAPI) doit splitter/vérifier la signature, pas lire la valeur brute. Un test avec « session factice en BDD » ne valide PAS le vrai format → exiger un test d'intégration login réel → cookie → endpoint FastAPI.
- **Migrations au boot Docker** (`node migrate.js && server.js`) : (1) ordre non coordonné entre conteneur web (qui migre) et conteneur API (qui lit `session`) → API peut booter avant le schéma ; (2) migrations concurrentes multi-replica → advisory lock requis.
- **Pas d'admin en prod** : le seed n'est jamais exécuté en conteneur. Avec accès sur invitation uniquement = deadlock premier déploiement. Exiger un mécanisme de provisioning admin prod.
- **CORS + cookie cross-origin** : `allow_credentials=True` + origine explicite ; config cookie Better-auth (domain/sameSite/secure) à figer dès le socle sinon auth cross-stack cassée en prod.
- **Dépendance inter-agent cachée** : le bundling `esbuild` de `src/lib/db/migrate.ts` dans l'entrypoint web (périmètre nextjs) dépend du schéma + migrate.ts produits par postgres → périmètres « disjoints » en apparence seulement.

**Why:** l'utilisateur non technique ne détectera aucun de ces pièges ; ils cassent tous en prod, pas en dev local.

**How to apply:** sur tout round de socle/déploiement, dérouler cette checklist. Voir [[constraint-agent-platform-runtime]] pour le port 6432 direct (pool asyncpg) et [[project-myday]].
