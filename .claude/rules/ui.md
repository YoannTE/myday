---
description: Conventions UI (shadcn/ui, Tailwind, formulaires, icones)
globs:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "tailwind.config.ts"
---

# Conventions UI

- Composants shadcn/ui en priorite absolue
- Tailwind CSS pour le styling, jamais de CSS modules
- Mobile-first : mobile d'abord, adapter avec md:, lg:
- Couleurs : CSS variables du theme shadcn (--primary, --secondary...)
- Dark mode : supporter via les classes dark: de shadcn
- Icones : lucide-react
- Notifications : sonner (toast shadcn)
- Loading : Skeleton de shadcn

## Formulaires

- Form shadcn + react-hook-form + zod pour la validation cote client
- Erreurs inline sous chaque champ (messages en francais correctement accentue)
- Loading state sur le bouton submit (desactiver + spinner pendant la requete)
- Toast de confirmation (sonner) apres succes
- Tous les labels, placeholders et messages visibles en francais accentue
