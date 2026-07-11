---
name: api-casing-contract
description: Contrat de casse MyDay — réponses API snake_case de bout en bout, apiCall ne convertit rien
metadata:
  type: project
---

Bug bloquant récurrent (Round 003, SOP `api-response-casing-contract`). FastAPI/Pydantic sérialise en snake_case sans alias ; `src/lib/api.ts` (`apiCall`) ne transforme aucune clé. Les interfaces TS et les accès composant DOIVENT être en snake_case, sinon `undefined` silencieux (compile, aucune 4xx, UI reste à l'état par défaut).

Seul camelCase légitime : noms de propriétés Drizzle dans `src/lib/db/schema/*.ts` (mappés vers colonnes snake_case).

**How to apply :** pour tout nouveau endpoint, exiger que le plan fige le shape de réponse en snake_case et impose un grep anti-camelCase en fin de round. Vérifier que le modèle Pydantic n'a pas d'alias `by_alias`.
