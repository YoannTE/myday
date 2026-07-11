# Tools/mockups - infrastructure partagee des mockups HTML

Ce dossier contient les outils reutilises par la commande `/mockup` :

- **`shared/base.css`** - reset + base typographique (inclus par chaque page de mockup)
- **`shared/components-loader.js`** - petit script qui charge les composants recurrents via `data-include`
- **`screenshot.mjs`** - script Playwright qui exporte toutes les pages en PNG
- **`package.json`** - dependances (playwright)

## Comment ca fonctionne

1. `/design` (checkpoint final) genere le design system : `design-system.css`, `tailwind-tokens.js` et copie les fichiers statiques dans `.project/mockups/shared/`
2. `/mockup` Phase 2 genere un ecran-pilote, puis extrait les composants recurrents vers `.project/mockups/shared/components/`
3. `/mockup` Phase 3 installe Playwright dans `~/.pi-tools/mockups/` (premier usage uniquement), copie `screenshot.mjs` et lance les screenshots

## Install Playwright (auto)

La premiere fois que `/mockup` Phase 3 est lancee, elle execute :

```bash
mkdir -p ~/.pi-tools/mockups
cp <starterkit>/.claude/tools/mockups/package.json ~/.pi-tools/mockups/
cd ~/.pi-tools/mockups && npm install
npx playwright install chromium
```

Les fois suivantes, l'install est detectee et passee. Chromium est partage
entre tous les projets via `~/.cache/ms-playwright/`.

## Prevusialiser les mockups

Depuis le dossier `.project/mockups/` d'un projet :

```bash
python3 -m http.server 8080
# ou
npx serve .
```

Puis ouvrir http://localhost:8080
