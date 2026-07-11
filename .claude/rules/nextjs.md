---
description: Conventions Next.js (App Router, Server Components, pages, layouts)
globs:
  - "src/**/*.tsx"
  - "src/lib/api.ts"
---

# Conventions Next.js

- App Router uniquement (jamais Pages Router)
- Server Components par defaut, "use client" seulement si necessaire
- Metadata dans chaque page.tsx (title, description)
- Images via next/image, liens via next/link
- Redirections via redirect() de next/navigation
- Si frontend-only : Server Actions pour les mutations simples,
  Route Handlers (app/api/) pour webhooks et endpoints complexes
- Si dual-stack : PAS de Server Actions, mutations via l'API FastAPI,
  appels API via le helper lib/api.ts
- Tous les textes visibles (titres, labels, boutons, placeholders, messages
  d'erreur) en francais correctement accentue
