# Conventions versioning

- Frontend : toujours installer avec `npm install <package>@latest` (jamais de version pinée)
- Backend (dual-stack) : `requirements.txt` SANS versions pinées (ex: `fastapi`, pas `fastapi==0.111.0`)
- Raison : facilite les mises à jour de sécurité, évite les conflits de dépendances en équipe

## En cas de breaking change

- Tester localement avant de merger
- Documenter la décision dans `.project/decisions.md` (package + version + raison du pin)
- Pin temporaire acceptable uniquement si le breaking change est non résolu upstream
- Retirer le pin dès que possible

## Rappel

Cette convention est citée dans `CLAUDE.md` section « Règles absolues », règle 7 :
« Toujours installer les packages avec `@latest` (cf. rule versioning.md) »
