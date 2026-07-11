Explore les directions de design du projet et produit le format dossier v2
attendu par Reborn : `.project/design-directions/{idx}/index.html` + `manifest.json`.

1. Lis BRIEF.md et .project/app.md pour comprendre le projet,
   les pages, les parcours et les fonctionnalités.

=== REGLES STRICTES (lire avant tout) ===

**[A] Interdiction absolue de `<script>` dans les `<template>` variants**

Chaque direction contient un unique `<script data-reborn-runtime="1">` injecté
par Reborn. Aucun autre `<script>` n'est autorisé dans `index.html`, et
particulièrement pas à l'intérieur des blocs `<template data-slot="...">`.
Tout `<script>` non marqué `data-reborn-runtime="1"` est un risque de sécurité.

**[A] Interdiction de `<style>` à l'intérieur des `<template>` variants**

Les blocs `<template data-slot="..." data-variant="...">` ne doivent contenir
ni `<style>`, ni attribut `style=""` avec des valeurs codées en dur. Tout le
styling passe par les CSS vars définies dans `:root` : `var(--bg)`, `var(--ink)`,
`var(--accent)`, `var(--soft)`, `var(--font-display)`, `var(--font-body)`,
`var(--space-base)`. Les classes Tailwind CDN sont autorisées dans les variants
à condition d'utiliser les classes utilitaires standard (pas de valeurs
arbitraires `[#abc]` qui court-circuiteraient les CSS vars).

**[B] Interdiction de modifier `.project/design.md` en mode tweaks**

Une fois `set_design_direction` appelé, la section `## Direction choisie` de
`.project/design.md` est gérée exclusivement par le tool handler Rust côté
desktop. Ne jamais modifier cette section à la main : appelle
`set_design_direction({directionIndex})`. Le reste de `design.md` (tokens,
principes, composants validés) reste éditable via `Edit`. Pendant la phase
tweaks (02·c), l'utilisateur a déjà choisi sa direction : toute modification
automatique de `design.md` créerait un conflit avec la commande Rust
`clear_design_direction`. Claude doit seulement répondre dans le chat en mode
tweaks - les changements HTML/manifest passent par des `Edit` ciblés sur les
fichiers de la direction, pas sur `design.md`.

**[C] Palettes et typos FIXES - ne pas en inventer d'autres**

Les 5 palettes et 3 typos listées ci-dessous sont identiques pour les 3
directions. Claude choisit la `default` parmi ces valeurs fixes. Il ne peut
pas créer de nouvelle palette ni de nouvelle typo : celles-ci sont hardcodées
dans l'interface Reborn (`design-tokens.ts`). Toute référence à un `id` inconnu
provoquera un avertissement console côté frontend et un fallback sur la première
valeur.

**[D] Images : skill `image-generation` OBLIGATOIRE, pas de SVG décoratif**

Quand une direction a besoin d'un visuel (hero, photo d'ambiance, illustration),
invoque le **skill `image-generation`** qui couvre l'usage du tool MCP
`generate_image` (signature, prompt, palette, gestion 429 / refus policy).
NE GÉNÈRE JAMAIS de SVG décoratif ni de placeholder inline à la place.

Pour cette phase, `saveAs` doit pointer vers
`.project/design-directions/{idx}/images/{nom}.png` et le prompt doit
refléter la palette en cours (« teintes chaudes terracotta, sable, lumière
naturelle » pour Sable & Terracotta, « palette verte profonde sur marbre
clair » pour Marbre & Vert Reborn, etc.).

=== PALETTES ET TYPOS FIXES (SSoT) ===

Ces valeurs sont les SEULES autorisées dans `manifest.json`. Elles correspondent
exactement aux constantes de `apps/desktop/src/lib/design-tokens.ts`.

**Palettes (5 - FIXES)** :

| id        | name                 | bg      | ink     | accent  | soft    |
| --------- | -------------------- | ------- | ------- | ------- | ------- |
| sable     | Sable & Terracotta   | #f4ede2 | #1a1815 | #b4461e | #d8cdb8 |
| or-brule  | Encre & Or brûlé     | #faf8f1 | #303440 | #b5914a | #dcdee5 |
| vert      | Marbre & Vert Reborn | #fbf9f5 | #1a1a1a | #2c8265 | #e5e1da |
| olive     | Lait & Olive         | #faf8f1 | #0f1310 | #5e7548 | #e3e1d4 |
| vermillon | Craie & Vermillon    | #fcfaf5 | #1a0c0a | #d94f32 | #e7e3dc |

**Typos (3 - FIXES)** :

| id        | name            | family                        | hint                                |
| --------- | --------------- | ----------------------------- | ----------------------------------- |
| fraunces  | Fraunces        | "Fraunces", serif             | serif éditorial · variable optical  |
| cabinet   | Cabinet Grotesk | "Cabinet Grotesk", sans-serif | grotesque géométrique · sobre       |
| gambarino | Gambarino       | "Gambarino", Georgia, serif   | serif expressif · caractère affirmé |

**Modes** : `light` | `dark`

**Densités** : `compact` | `comfort` | `aere`

=== FORMAT DE SORTIE : DOSSIER V2 ===

Pour chaque direction (index 0, 1, 2), Claude crée :

```
.project/design-directions/
  0/
    index.html      # écran-pilote complet avec slots + variants en <template>
    manifest.json   # métadonnées : palettes, typos, slots, defaults
  1/
    index.html
    manifest.json
  2/
    index.html
    manifest.json
```

`tweaks.json` n'est PAS écrit par Claude. Il est créé au premier tweak
par le frontend Rust (`write_design_tweaks`).

=== SCHEMA MANIFEST.JSON (STRICT) ===

```json
{
  "id": 0,
  "name": "Atelier moderne",
  "default": {
    "palette": "sable",
    "typo": "fraunces",
    "mode": "light",
    "density": "comfort"
  },
  "palettes": [
    {
      "id": "sable",
      "name": "Sable & Terracotta",
      "bg": "#f4ede2",
      "ink": "#1a1815",
      "accent": "#b4461e",
      "soft": "#d8cdb8"
    },
    {
      "id": "or-brule",
      "name": "Encre & Or brûlé",
      "bg": "#faf8f1",
      "ink": "#303440",
      "accent": "#b5914a",
      "soft": "#dcdee5"
    },
    {
      "id": "vert",
      "name": "Marbre & Vert Reborn",
      "bg": "#fbf9f5",
      "ink": "#1a1a1a",
      "accent": "#2c8265",
      "soft": "#e5e1da"
    },
    {
      "id": "olive",
      "name": "Lait & Olive",
      "bg": "#faf8f1",
      "ink": "#0f1310",
      "accent": "#5e7548",
      "soft": "#e3e1d4"
    },
    {
      "id": "vermillon",
      "name": "Craie & Vermillon",
      "bg": "#fcfaf5",
      "ink": "#1a0c0a",
      "accent": "#d94f32",
      "soft": "#e7e3dc"
    }
  ],
  "typos": [
    {
      "id": "fraunces",
      "name": "Fraunces",
      "family": "\"Fraunces\", serif",
      "hint": "serif éditorial · variable optical"
    },
    {
      "id": "cabinet",
      "name": "Cabinet Grotesk",
      "family": "\"Cabinet Grotesk\", sans-serif",
      "hint": "grotesque géométrique · sobre"
    },
    {
      "id": "gambarino",
      "name": "Gambarino",
      "family": "\"Gambarino\", Georgia, serif",
      "hint": "serif expressif · caractère affirmé"
    }
  ],
  "slots": [
    {
      "id": "hero",
      "label": "Hero",
      "variants": [
        { "id": "01", "name": "Centré" },
        { "id": "02", "name": "Split" },
        { "id": "03", "name": "Plein écran" }
      ]
    }
  ]
}
```

Règles sur `manifest.json` :

- `id` = index 0-based de la direction (entier)
- `name` = nom court thématique en français (ex : « Atelier moderne »,
  « Studio data », « Édition graphique »)
- `default.palette` ∈ {sable, or-brule, vert, olive, vermillon}
- `default.typo` ∈ {fraunces, cabinet, gambarino}
- `default.mode` ∈ {light, dark}
- `default.density` ∈ {compact, comfort, aere}
- `palettes` = tableau COMPLET des 5 palettes (toujours les mêmes, dans cet ordre)
- `typos` = tableau COMPLET des 3 typos (toujours les mêmes, dans cet ordre)
- `slots` = liste des slots pertinents pour CE projet (voir ci-dessous)
- Chaque slot a exactement 3 variants : `"01"`, `"02"`, `"03"`

=== SCHEMA INDEX.HTML (STRICT) ===

**Préambule CSS dans `:root`** (OBLIGATOIRE - permet au runtime de swapper les
tokens sans round-trip Claude) :

```html
<!doctype html>
<html lang="fr" data-mode="light" data-density="comfort">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>[Nom de la direction]</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@300;400;500;600;700&display=swap"
    />
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              bg: "var(--bg)",
              ink: "var(--ink)",
              accent: "var(--accent)",
              soft: "var(--soft)",
            },
            fontFamily: {
              display: "var(--font-display)",
              body: "var(--font-body)",
            },
          },
        },
      };
    </script>
    <style>
      :root {
        --bg: #f4ede2;
        --ink: #1a1815;
        --accent: #b4461e;
        --soft: #d8cdb8;
        --font-display: "Fraunces", serif;
        --font-body: "Inter", sans-serif;
        --space-base: 16px;
      }
      html[data-mode="dark"] {
        --bg: #1a1815;
        --ink: #f4ede2;
        --soft: #3a3530;
      }
      html[data-density="compact"] {
        --space-base: 12px;
      }
      html[data-density="comfort"] {
        --space-base: 16px;
      }
      html[data-density="aere"] {
        --space-base: 22px;
      }

      body {
        background: var(--bg);
        color: var(--ink);
        font-family: var(--font-body);
        font-size: var(--space-base);
      }

      /* Les slots vides avant injection du variant */
      [data-slot]:not(template) {
        min-height: 0;
      }
    </style>
  </head>
  <body>
    <!-- SLOTS : vides au rendu initial, le runtime injecte le variant 01 -->
    <section data-slot="hero"></section>
    <section data-slot="menu"></section>
    <!-- ... autres slots ... -->

    <!-- VARIANTS : cachés, injectés au runtime -->
    <template data-slot="hero" data-variant="01" data-name="Centré">
      <!-- contenu HTML du variant 01 - PAS de <script>, PAS de <style> -->
    </template>
    <template data-slot="hero" data-variant="02" data-name="Split">
      <!-- ... -->
    </template>
    <template data-slot="hero" data-variant="03" data-name="Plein écran">
      <!-- ... -->
    </template>
  </body>
</html>
```

**Règles `index.html`** :

- Les valeurs `:root` correspondent à la palette `default` du manifest.
- Tout élément dans `<body>` utilise `background: var(--bg)`, `color: var(--ink)`,
  `font-family: var(--font-display)` ou `var(--font-body)`, etc. Jamais de
  couleur codée en dur sur un élément visible.
- Les classes Tailwind `bg-bg`, `text-ink`, `text-accent`, `bg-soft`, `font-display`,
  `font-body` (mappées dans `tailwind.config`) permettent d'utiliser les CSS vars
  via les classes utilitaires.
- Les `<section data-slot="...">` sont vides - le runtime injecte le variant 01
  au `DOMContentLoaded`.
- Les `<template data-slot="..." data-variant="..." data-name="...">` contiennent
  le HTML du variant. Pas de `<script>` ni de `<style>` à l'intérieur (règle [A]).
- Le script runtime (injecté par Reborn) est le SEUL `<script>` autorisé dans
  l'iframe - il porte l'attribut `data-reborn-runtime="1"`.
- `<html lang="fr" data-mode="light" data-density="comfort">` : les attributs
  `data-mode` et `data-density` sont les selectors CSS pour les overrides.

=== ANNOTATION `data-mockup-id` (OBLIGATOIRE) ===

Chaque bloc significatif du HTML DOIT porter un attribut `data-mockup-id="<kebab-case>"`
lisible humainement. Blocs concernés : sections, navbar, hero, cartes produit,
boutons CTA, listes, formulaires, footers, modales, bannières.

**Exemples de valeurs** : `hero`, `nav-primary`, `cta-signup`, `pricing-card`,
`feature-list`, `testimonials`, `footer-main`, `form-contact`.

**Règle** : kebab-case strict, sans espace, en français ou anglais court.

```html
<nav data-mockup-id="nav-primary">…</nav>
<section data-mockup-id="hero">…</section>
<section data-mockup-id="pricing-cards">…</section>
<section data-mockup-id="cta-signup">…</section>
<footer data-mockup-id="footer-main">…</footer>
```

**Pourquoi** : quand l'utilisateur clique un bloc dans la preview Reborn,
l'interface remonte au plus proche ancêtre `data-mockup-id` pour identifier
le bloc ciblé. Sans cet attribut, le sélecteur de secours (`nth-of-type`)
casse dès que Claude réécrit ou réordonne le HTML.

**Fallback appliqué automatiquement par Reborn (ordre de priorité)** :

1. Plus proche ancêtre avec `data-mockup-id` (cible préférée, stable)
2. Plus proche ancêtre avec `data-slot` (stable tant que le slot existe)
3. Sélecteur CSS court basé sur `nth-of-type` (fragile - casse à la prochaine
   réécriture ; l'UI signale à l'utilisateur que ce sélecteur est fragile)

Si l'utilisateur clique un élément sans ancêtre nommé, Reborn applique le
fallback nth-of-type mais avertit visuellement que la cible peut être ratée
à la prochaine modification. Annote donc TOUS les blocs de premier niveau.

=== PHASE PREALABLE : QUESTIONNAIRE DE DESIGN ===

Si `.project/design.md` existe déjà ET `.project/design-directions/0/manifest.json`
existe → le design est déjà validé. Informer l'utilisateur et s'arrêter :
« Le design est déjà validé. Lance /mockup pour générer les écrans. »

Sinon, AVANT de générer les directions (Phase 0), poser des questions à
l'utilisateur pour comprendre SA VISION et SON CONTEXTE. Utiliser le tool
`request_user_choice` (ou `mcp__reborn__request_user_choice` si disponible) pour
poser des questions à choix multiples.

**Philosophie - REGLE D'OR** :

Les questions servent à comprendre **OÙ L'UTILISATEUR VEUT ALLER** : sa vision
du produit, son audience, son positionnement, son ton, le type de client cible,
les contraintes business. Ces réponses guident les CHOIX visuels que tu vas faire.

Les questions ne servent PAS à faire choisir l'utilisateur entre plusieurs
options visuelles concrètes (polices, palettes, layouts de hero, styles de
cards...). Pour TOUS ces choix visuels, tu **génères plusieurs variants dans
les `<template>` de chaque direction** - l'utilisateur compare en live dans
l'interface Reborn et choisit visuellement.

**Répartition stricte** :

| À poser en QUESTION (vision/contexte)        | À mettre en VARIANTS (choix visuel) |
| -------------------------------------------- | ----------------------------------- |
| Type de client / audience cible              | Variants de hero (3 par slot)       |
| Positionnement (premium, accessible, expert) | Variants de menu/navbar (3)         |
| Ton de la copy (tutoiement, vouvoiement)     | Variants de cards/grid (3)          |
| Concurrents / références admirées            | Variants de footer (3)              |
| Contenu clé à représenter                    | Densité (compact/comfort/aéré)      |
| Contraintes business / réglementaires        | Dark/light mode                     |
| Spécificités projet                          | Choix palette parmi les 5 fixes     |

**Règle absolue** : si tu te demandes « est-ce que je dois faire choisir
l'utilisateur entre A, B et C ? » et que A/B/C sont des options visuelles
concrètes (layout, couleur, structure), la réponse est NON - tu intègres A, B
et C comme variants de slot dans les directions.

Les questions sont générées dynamiquement en fonction du projet.
Toutes les questions sont optionnelles.

**Procédure :**

1. Lis BRIEF.md et .project/app.md pour comprendre le type de projet,
   l'audience, le secteur et le positionnement.

2. À partir de cette analyse, génère 6-10 questions contextuelles réparties
   en 2 ou 3 appels `request_user_choice` (max 4 questions par appel).

   **OPTION "DÉCIDE POUR MOI" (obligatoire sur chaque question)** :

   Chaque question DOIT inclure une option "Décide pour moi" en dernière
   position (avant "Other" qui est ajouté automatiquement). Quand
   l'utilisateur choisit cette option, faire un choix opiniâtre et argumenté
   basé sur l'analyse du brief, du secteur et de l'audience cible.

   **OPTION "EXPLORER PLUSIEURS" (quand pertinent)** :

   Pour les questions où plusieurs directions sont possibles et utiles à
   comparer, ajouter une option "Explorer plusieurs options" AVANT "Décide
   pour moi". Quand l'utilisateur la choisit, les 3 directions Phase 0
   exploreront chacune une variante différente de cet axe.

   **Axes à couvrir** (questions de VISION uniquement) :
   - **Audience / type de client**
   - **Positionnement** : premium / accessible / challenger / institutionnel
   - **Ambiance générale** : avec "Explorer plusieurs options" et "Décide pour moi"
   - **Références admirées** (libre ou multiSelect)
   - **Contenu clé à représenter**
   - **Ton de la copy** : tutoiement direct / vouvoiement / neutre factuel
   - **Contraintes / éléments à éviter**
   - **Spécificités du projet** (1-2 questions propres au projet)

   **NE PAS poser de question sur** (ces choix vont dans les variants) :
   - Polices / typographie → les 3 typos fixes sont disponibles en tweak global
   - Palettes de couleurs → les 5 palettes fixes sont disponibles en tweak global
   - Style/layout du hero → 3 variants de slot hero dans chaque direction
   - Style des cards / modules → 3 variants par slot
   - Densité (compact/confort/aéré) → tweak global systématique
   - Dark/light mode → tweak global systématique

3. **Question libre finale** : après les questions à choix, poser UNE
   dernière question ouverte : « Autres directives ? (inspirations, contraintes,
   éléments à éviter...) »

4. Synthétiser les réponses en un `design-brief` interne (garder en mémoire,
   ne pas écrire dans un fichier). Ce brief guide la Phase 0.

=== PHASE 0 : GÉNÉRATION DES DIRECTIONS (FORMAT V2) ===

**Étape 0 - Détecter les directions existantes (mode initial vs additif)**

Avant toute génération, lister `.project/design-directions/` pour déterminer
le mode :

```bash
ls .project/design-directions/ 2>/dev/null | sort -n
```

- **Mode INITIAL** (aucun dossier numéroté présent) : générer 3 directions
  aux index `0`, `1`, `2`. C'est le cas par défaut au premier passage.
- **Mode ADDITIF** (un ou plusieurs dossiers `0/`, `1/`, ... présent) :
  l'utilisateur a déjà des directions et demande à en ajouter de nouvelles.
  Calculer `startIdx = max(index existants) + 1` et générer N nouvelles
  directions aux index `startIdx`, `startIdx+1`, ..., `startIdx+N-1`.
  - **NE JAMAIS écraser** ni supprimer les dossiers existants `0/`, `1/`,
    `2/`, etc. Elles restent visibles dans l'UI Reborn et l'utilisateur
    peut toujours les choisir via `set_design_direction({directionIndex: 1})`.
  - **Le nombre N** par défaut = 3 nouvelles directions, sauf si
    l'utilisateur précise (« propose-moi 2 nouvelles directions »,
    « ajoute juste 1 direction très brutaliste »).
  - **Les nouvelles directions doivent contraster avec les existantes** :
    avant de définir les partis pris (étape 3), `Read` rapidement les
    `manifest.json` des directions existantes pour identifier leurs noms
    et angles, et éviter de répéter le même registre.

Toutes les étapes ci-dessous s'appliquent IDENTIQUEMENT en mode initial et
en mode additif. Seuls changent les index utilisés et le nombre de directions
à générer.

**OBLIGATION ABSOLUE - SKILL `frontend-design`** :

AVANT d'écrire la moindre ligne de HTML pour les directions, tu DOIS invoquer
le skill `frontend-design` via l'outil Skill. Ce n'est pas optionnel. Sans ce
skill, les directions tombent dans l'AI slop (layouts attendus, typographies
safe, palettes génériques).

Procédure stricte :

1. Invoquer `frontend-design` en passant le design-brief comme contexte
   (en mode additif, inclure aussi le résumé des directions existantes
   pour qu'il propose des angles complémentaires).
   Récupérer ses recommandations sur compositions, partis pris éditoriaux.
2. Générer les directions en appliquant CES recommandations.
3. Si une direction semble générique, re-invoquer `frontend-design`.

Ne JAMAIS sauter cette étape.

**Étape 1 - Analyser les slots pertinents du projet**

Avant de générer le HTML, analyser BRIEF.md + .project/app.md pour déterminer
les slots à représenter. Les slots ne sont pas universels : ils dépendent du
type de projet.

Exemples de slots par type de projet (à adapter selon le brief) :

- **Site éditorial / landing** : hero, menu, features, cards, cta, footer
- **Webapp interne / dashboard** : sidebar, topbar, data-table, stat-cards, breadcrumb
- **E-commerce** : hero, produits-grid, product-card, panier, footer
- **Plateforme SaaS** : hero, pricing, features, testimonials, cta, footer
- **Blog / média** : hero, article-card, categories, newsletter, footer
- **Application mobile-first** : hero, bottom-nav, list-item, filters, fab

Choisir 4 à 6 slots pertinents pour l'écran-pilote du projet. Les mêmes slots
sont présents dans les 3 directions (seuls les variants changent).

**Étape 2 - Identifier l'écran-pilote**

La page la plus représentative du projet :

- App publique → landing / accueil
- App protégée → dashboard
- E-commerce → page d'accueil avec produits
- Portfolio → galerie principale

C'est cette VRAIE page qui est rendue, pas un mood-board.

**Étape 3 - Définir les N directions (briefing centralisé)**

L'agent principal (toi) est le SEUL responsable de la direction artistique.
Tu définis en mémoire les N partis pris contrastés AVANT de déléguer la
rédaction. C'est ce qui garantit que les directions sont vraiment
différentes les unes des autres (et, en mode additif, vraiment différentes
des directions déjà présentes).

Pour chaque nouvelle direction à générer, rédige en mémoire un brief de direction :

- **Nom** (français, court) : ex « Atelier moderne », « Studio data »
- **Parti pris visuel** : layout, ton, ambiance, références
- **Palette `default`** : un id parmi {sable, or-brule, vert, olive, vermillon}
- **Typo `default`** : un id parmi {fraunces, cabinet, gambarino}
- **Mode `default`** : light ou dark
- **Densité `default`** : compact / comfort / aere
- **Angle distinctif des variants** : pour chaque slot, comment les 3 variants
  s'articulent (pas juste « padding différent »).

Exemples de directions vraiment différentes :

- Éditorial luxe (serif, espaces généreux, compositions éditoriales)
- Tech/data-driven (sans géométrique, dense, orienté données)
- Playful neo-brutalist (gras, bordures franches, couleurs vives)

**Étape 4 - Déléguer la rédaction à `direction-writer` EN PARALLÈLE**

Une fois les N briefs définis, déléguer la rédaction de chaque direction à
l'agent `direction-writer` (une entrée `tasks[]` par direction). Cela parallélise le
travail (gain de temps proportionnel à N) et fait apparaître les directions
au fil de l'eau dans l'UI Reborn (le file watcher Rust détecte chaque
dossier dès qu'il est complet).

**Pourquoi un agent dédié** : `direction-writer` porte TOUTES les règles
de génération (schémas manifest/index.html, palettes/typos fixes,
règle [A] templates, ordre d'écriture, checklist) et s'adapte automatiquement
au mode d'install (Reborn ou standalone) via les markers de features dans
son propre fichier. La tâche transmise à `kit_agent_dispatch` n'a donc qu'à transmettre le
**brief de direction** + `idx` + la liste des slots. Toutes les contraintes
structurelles vivent dans `.claude/agents/direction-writer.md` (SSoT).

**Règles de délégation** :

- Appeler le tool Claude Code `kit_agent_dispatch` **une seule fois** avec `tasks[]`
  pour lancer toutes les directions en parallèle (une entrée par direction).
- Chaque entrée utilise `agent: "direction-writer"` (obligatoire - ne PAS utiliser
  `general-purpose` ou `nextjs-developer`, ils n'ont pas les règles
  spécifiques).
- La tâche contient un nom court de la direction (ex « Direction 3 -
  Studio data ») pour faciliter le suivi UI.
- Le champ `task` contient **uniquement** :
  1. Le brief de direction (étape 3) : nom, parti pris visuel, palette
     `default`, typo `default`, mode, densité, angle distinctif des variants
  2. L'index `idx` à utiliser
  3. La liste des 4-6 slots du projet déterminés à l'étape 1 (mêmes
     slots pour toutes les directions de la vague)
  4. Toute spécificité contextuelle (mode additif : éviter de répéter les
     angles des directions existantes ; références utilisateur ; contraintes
     business)

  Pas besoin de copier-coller les schémas, palettes, typos ni la
  checklist : `direction-writer` les a déjà dans son prompt système.

**Live preview - émission au fil de l'eau** :

Le file watcher Rust détecte automatiquement les nouveaux dossiers dans
`.project/design-directions/` : dès qu'un sous-agent termine son écriture,
la direction apparaît dans l'UI Reborn sans attendre les autres. Tu n'as
rien de spécial à faire pour ça.

**Étape 5 - Vérifier l'intégrité, relancer si défaillance, finaliser**

Quand toutes les délégations parallèles ont rendu la main, AVANT d'annoncer
quoi que ce soit à l'utilisateur :

**5a. Contrôle d'intégrité (OBLIGATOIRE)**

Pour CHAQUE direction que tu viens de générer, vérifier que les DEUX
fichiers existent et sont non vides :

```bash
ls -la .project/design-directions/{idx}/index.html .project/design-directions/{idx}/manifest.json
```

Pour chaque direction (idx donné) :

- Si `index.html` ET `manifest.json` existent ET sont > 1 K → OK
- Si un des deux manque, est vide, ou < 1 K → **DIRECTION INCOMPLÈTE**

Les sous-agents peuvent timeout, planter ou oublier un fichier en cours
de route. C'est la source la plus fréquente de directions « fantômes »
qui apparaissent dans le file watcher (le dossier existe) mais pas dans
l'UI (rien à rendre). Une vérification systématique évite que
l'utilisateur découvre le problème lui-même.

**5b. Relancer les directions incomplètes (si besoin)**

Pour chaque direction incomplète détectée à 5a :

1. Lire les fichiers existants (s'il y en a) pour récupérer l'intention
   du sous-agent défaillant (nom de la direction, palette, typo, slots
   choisis depuis le manifest s'il a été écrit).
2. Relancer `kit_agent_dispatch` avec le MÊME brief de direction que celui de
   l'étape 3 + l'instruction explicite « la direction est partielle,
   complète ce qui manque ; respecte le manifest existant si présent ».
3. Re-vérifier à 5a après le retour de la délégation.

Ne pas passer à 5c tant qu'au moins UNE direction est incomplète - sauf
si une relance échoue 2 fois de suite, auquel cas avertir explicitement
l'utilisateur dans le message final (« La direction X n'a pas pu être
générée, voici les autres »).

**5c. Annoncer à l'utilisateur**

Puis affiche un message de présentation **complet et engageant**. Le
message DOIT contenir 3 parties dans l'ordre :

**Partie 1 - Annonce et présentation des directions** :

Lister les directions par leur nom + 1 phrase de pitch chacune (extrait
du brief de direction de l'étape 3 ou du manifest `name`). Adapter le
wording au mode :

- **Mode initial** : « Voici 3 directions de design, chacune incarne ta
  vraie [landing/dashboard/...] avec un parti pris distinct.
  - **Direction 0 - {nom}** : {1 phrase de pitch}
  - **Direction 1 - {nom}** : {pitch}
  - **Direction 2 - {nom}** : {pitch}
    »
- **Mode additif** : « J'ai ajouté {N} nouvelles directions ({startIdx}
  à {startIdx+N-1}), complémentaires de celles déjà proposées :
  - **Direction {startIdx} - {nom}** : {pitch}
  - ... »

**Partie 2 - Ce qu'on peut faire dans chaque direction** :

« Dans chaque direction, tu peux ajuster en live via le panneau de
tweaks :

- Choisir parmi 5 palettes de couleurs
- Basculer en mode sombre/clair
- Tester la densité (compact / confort / aéré)
- Switcher entre les 3 variantes de chaque composant (hero, menu,
  cards, footer...) »

**Partie 3 - Suite possible** :

« Dis-moi ce qui te parle :

- **« la 2 me plaît »** → on la valide et on passe à la suite
- **« la 2 mais en plus sombre »** → ajustement ciblé sur une direction
- **« le hero de la 1 sur la 2 »** → mix entre directions
- **« propose 3 nouvelles directions »** → j'en ajoute 3 autres (les
  actuelles restent disponibles)
- **« propose 3 nouvelles en partant de la 1 »** → 3 variations de la
  direction 1, déclinées différemment
- **« recommence tout depuis zéro »** → j'efface et je repars (avec
  confirmation)

Ou demande-moi n'importe quel ajustement en langage naturel. »

=== ITÉRATION ET AJUSTEMENTS ===

Après la présentation des directions, l'utilisateur peut demander des
ajustements en chat avant de choisir. Voici les cas et la conduite à tenir :

- **« Propose {N} nouvelles directions »** / **« Ajoute d'autres directions »**
  / **« Donne-moi plus de pistes »** → **mode ADDITIF**. Repartir au début
  de la Phase 0 (Étape 0 - détection) pour calculer `startIdx`, puis
  générer N nouvelles directions aux index `startIdx`, `startIdx+1`, ...
  - **NE PAS supprimer** les directions existantes. Elles restent visibles
    dans l'UI et l'utilisateur peut toujours les choisir.
  - Si l'utilisateur ne précise pas N, défaut = 3.
  - Au briefing centralisé (Étape 3), tenir compte des angles déjà couverts
    par les directions existantes pour proposer des angles **complémentaires**
    et non redondants.
  - Déléguer la rédaction des nouvelles directions à des sous-agents en
    parallèle (cf. Étape 4).

- **« Refais TOUT, repars de zéro »** / **« Oublie ces directions et
  recommence »** → uniquement si l'utilisateur le demande explicitement.
  Dans ce cas, `rm -rf .project/design-directions/*` puis relancer la
  Phase 0 en mode initial. **Demander confirmation avant** : « Tu veux
  vraiment effacer les {N} directions actuelles et tout recommencer ? »

- **« Refais la direction 2 en plus sombre »** → modifier `manifest.json`
  (changer `default.mode` = "dark") et `index.html` (adapter le `:root`
  dark override). Cibler uniquement la direction concernée.

- **« Génère 3 nouvelles variantes pour le slot hero de la direction 1 »** →
  créer 3 nouveaux `<template>` dans `index.html` de la direction 1 et
  mettre à jour `manifest.json` avec les nouvelles variantes (IDs "04",
  "05", "06"). Garder les variantes 01/02/03 intactes.

**IMPORTANT [B]** : pendant toutes ces itérations, ne pas toucher à la section
`## Direction choisie` de `.project/design.md`. Cette section est gérée par
le tool `set_design_direction`.

=== CHOIX ET VALIDATION DE LA DIRECTION ===

Quand l'utilisateur confirme son choix parmi les directions proposées
(réponse en chat type « la direction α me plaît » ou via `request_user_choice`),
appelle `set_design_direction` avec :

- `directionIndex` : **index 0-based** du choix utilisateur. Il peut s'agir
  de n'importe quel index existant dans `.project/design-directions/` (0,
  1, 2, 3, ... selon le nombre de vagues additives générées).
- `htmlPath` et `pngPath` : **ne pas les fournir** (format v2 dossier - le
  bridge Reborn écrit une référence au dossier `.project/design-directions/{idx}/`)

Si l'utilisateur désigne la direction par sa position (« la 2ème »,
« la dernière », « la troisième que tu m'as proposée »), reconvertir en
index 0-based en regardant ce qui existe sur disque. En cas de doute,
demander à l'utilisateur de confirmer (« tu veux dire la direction d'index
3 - Studio data ? »).

Exemple si l'utilisateur choisit la 2ème direction de la première vague :

```json
{
  "directionIndex": 1
}
```

=== CHECKPOINT FINAL : MÉMORISATION DU DESIGN ===

Une fois la direction validée, persister dans `.project/design.md`.

**Écrire `.project/design.md`** - le fichier de référence du design.

Ce fichier est la SOURCE DE VÉRITÉ pour /mockup. Il doit contenir :

```markdown
# Design - [Nom du projet]

## Direction choisie

[NE PAS écrire cette section manuellement - elle est gérée par le tool
`set_design_direction`. Elle sera écrite automatiquement après l'appel du tool.]

## Tokens

### Couleurs (palette retenue)

| Token  | Hex  | Usage                |
| ------ | ---- | -------------------- |
| bg     | #... | Fond principal       |
| ink    | #... | Texte principal      |
| accent | #... | CTA, accents, liens  |
| soft   | #... | Surfaces secondaires |

### Typographie

| Rôle    | Font           | Usage                   |
| ------- | -------------- | ----------------------- |
| display | [ex: Fraunces] | Titres, hero, accroches |
| body    | [ex: Inter]    | Texte courant, labels   |

### Spacing & radii

- Border radius : [ex: 0.75rem]
- Espacements : [ex: généreux, aéré - var(--space-base)]
- Ombres : [ex: subtils, ring-offset]

## Principes de design

- [ex: Éditorial - grands titres serif, espaces généreux]
- [ex: Data-forward - les chiffres clés sont visibles immédiatement]
- [ex: Confiance - badges de garantie, vert pour le positif]

## Slots validés

Slots et variantes retenus pendant l'exploration. Guide /mockup pour
appliquer le bon style à chaque composant.

- **hero** : variante [01/02/03] - [description]
- **menu** : variante [01/02/03] - [description]
- [... autres slots]

## Ton de la copy

- [ex: Tutoiement direct, ton challenger]
- [ex: Phrases courtes, affirmatives]

## Préférences utilisateur (questionnaire)

Réponses clés qui ont guidé les choix :

- Ambiance : [réponse]
- Audience : [réponse]
- Ton : [réponse]
- [autres réponses pertinentes]
```

=== PHASE TWEAKS (02·c - chat-conduit Reborn) ===

**INVARIANT CRITIQUE [B]** : une fois `set_design_direction` appelé, Claude
N'ÉCRIT PLUS dans `.project/design.md` section `## Direction choisie`. Cette
section est gérée exclusivement par le tool handler Rust `clear_design_direction`
(appelé si l'utilisateur veut changer de direction). Claude attend juste les
messages du chat utilisateur. Il n'y a qu'un seul writer sur `design.md` à un
moment donné - violer cet invariant peut provoquer une perte de données si
`clear_design_direction` est appelé en parallèle.

Une fois la direction choisie, la conversation continue en mode tweaks.
L'utilisateur demande des ajustements en langage naturel :

- « mets la palette Vermillon » → `Edit` ciblé sur le `:root` de `index.html`
  (changer les valeurs hex) ET `Edit` sur `manifest.json` (`default.palette`)
- « passe en mode sombre » → `Edit` sur `manifest.json` (`default.mode`)
  - vérifier que les overrides `html[data-mode="dark"]` dans `index.html`
    couvrent bien les changements voulus
- « hero Split plutôt que Centré » → pas d'édition nécessaire : le tweak
  de variant est géré côté frontend par Reborn (postMessage → swap de `<template>`)
- « rends le titre plus gros » → `Edit` ciblé sur le `<template>` du slot
  hero, variant actif
- « génère 3 nouvelles variantes pour le hero » → ajouter 3 nouveaux
  `<template data-slot="hero" data-variant="04/05/06">` dans `index.html`
  et mettre à jour `manifest.json` pour ajouter ces variants au slot hero

Pour chaque tweak :

1. Édite le fichier `.project/design-directions/{idxChoisi}/index.html` et/ou
   `manifest.json` via `Edit` (préfère plusieurs `Edit` ciblés)
2. Confirme verbalement le tweak appliqué
3. Rappel règle [A] : ne jamais introduire de `<script>` ni `<style>` dans
   les `<template>` lors des éditions de tweaks

Continue jusqu'à ce que l'utilisateur dise que ça lui convient. Quand l'utilisateur
confirme, AVANT d'émettre les hooks `update_substep_progress` + `mark_step_complete`,
exécute l'EXTRACTION DU DESIGN SYSTEM ci-dessous.

=== EXTRACTION DU DESIGN SYSTEM (obligatoire après les tweaks, avant les hooks UI) ===

Créer les fichiers partagés pour `/mockup`. Ces fichiers doivent exister AVANT
que `/mockup` soit lancé - leur absence bloque le démarrage de `/mockup`.

```bash
mkdir -p .project/mockups/shared
```

**a. Générer `.project/mockups/shared/tailwind-tokens.js`**

Appeler `notify_writing({ file_path: ".project/mockups/shared/tailwind-tokens.js" })` AVANT d'écrire.

Extraire depuis `.project/design.md` (section `## Tokens`) les couleurs, typographies
et border-radius retenus. Produire un fichier JS qui expose la config Tailwind :

```js
// tailwind-tokens.js - généré depuis .project/design.md
// Ce fichier doit être chargé APRÈS le CDN Tailwind dans chaque mockup HTML :
//   <script src="https://cdn.tailwindcss.com"></script>
//   <script src="../shared/tailwind-tokens.js"></script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        bg: "#...",
        ink: "#...",
        accent: "#...",
        soft: "#...",
      },
      fontFamily: {
        display: ['"NomFontDisplay"', "serif"],
        body: ['"NomFontBody"', "sans-serif"],
      },
      borderRadius: {
        base: "0.75rem",
      },
    },
  },
};
```

Les valeurs sont celles de la direction choisie après les tweaks finaux.

**b. Générer `.project/mockups/shared/design-system.css`**

Appeler `notify_writing({ file_path: ".project/mockups/shared/design-system.css" })` AVANT d'écrire.

Produire un CSS avec @import Google Fonts + variables CSS `:root` + styles base :

```css
/* design-system.css - généré depuis .project/design.md */
@import url("https://fonts.googleapis.com/css2?family=NomDisplay&family=NomBody&display=swap");

:root {
  --bg: #...;
  --ink: #...;
  --accent: #...;
  --soft: #...;
  --font-display: "NomDisplay", serif;
  --font-body: "NomBody", sans-serif;
  --space-base: 1rem;
  --radius-base: 0.75rem;
}

html,
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
}
/* animations custom ici si pertinent pour la direction choisie */
```

**c. Copier `base.css` depuis le starterkit**

```bash
cp .claude/tools/mockups/shared/base.css .project/mockups/shared/base.css
```

**d. Copier `components-loader.js` depuis le starterkit**

```bash
cp .claude/tools/mockups/shared/components-loader.js .project/mockups/shared/components-loader.js
```

**e. Copier `tweaks-panel.js` depuis le starterkit**

Le skill `mockup-screens-generator` exige ce fichier dans `.project/mockups/shared/`
pour afficher le panel de tweaks (variantes, palette, densité) dans chaque écran HTML.

```bash
cp .claude/tools/mockups/shared/tweaks-panel.js .project/mockups/shared/tweaks-panel.js
```

Une fois les 5 fichiers écrits, émettre les hooks de clôture dans cet ordre :

1. `update_substep_progress({ stepId: "02_style", subStep: "c", status: "done" })`
2. `notify_user({ level: "success", message: "Style validé · prêt pour /mockup" })`
3. `mark_step_complete({ stepId: "02_style" })`

`mark_step_complete` clôt l'étape 02 côté stepper et active la pill suivante.

=== SKILLS UTILISÉS ===

- `frontend-design` **(OBLIGATOIRE, SYSTÉMATIQUE)** : invoquer via l'outil
  Skill AVANT chaque génération de direction en Phase 0. Sans ce skill, les
  directions tombent dans l'AI slop. Aucune direction ne doit être générée
  sans passage préalable par ce skill.

=== FICHIERS GÉNÉRÉS ===

```
.project/
  design.md                          # Source de vérité du design
  design-directions/
    0/
      index.html                     # Écran-pilote direction 0 (slots + variants)
      manifest.json                  # Palettes fixes, typos fixes, slots
    1/
      index.html
      manifest.json
    2/
      index.html
      manifest.json
    3/                               # Ajoutée en vague additive (optionnel)
      index.html
      manifest.json
    ...                              # N vagues additives possibles
  mockups/
    shared/
      design-system.css             # Généré par /design - @import fonts + variables :root
      tailwind-tokens.js            # Généré par /design - window.tailwind config depuis design.md
      base.css                      # Copié depuis .claude/tools/mockups/shared/base.css (statique)
      components-loader.js          # Copié depuis .claude/tools/mockups/shared/components-loader.js (statique)
      tweaks-panel.js               # Copié depuis .claude/tools/mockups/shared/tweaks-panel.js (statique)
```

Le dossier est **append-only** : les vagues additives créent de nouveaux
index sans toucher aux anciens. Le seul moyen de supprimer une direction
est un `rm -rf` explicite demandé par l'utilisateur (cf. section
« ITÉRATION ET AJUSTEMENTS »).

Note : `tweaks.json` dans chaque dossier est créé au premier tweak par le
frontend Rust - ne pas le créer ni le modifier manuellement.

=== CHECKLIST DE CLÔTURE (OBLIGATOIRE) ===

Avant de déclarer `/design` terminé, exécuter `ls .project/mockups/shared/` et
`ls .project/design-directions/` et vérifier que ces fichiers existent :

- .project/design.md
- .project/design-directions/0/index.html (et 1/, 2/ minimum)
- .project/design-directions/0/manifest.json (et 1/, 2/)
- .project/mockups/shared/design-system.css
- .project/mockups/shared/tailwind-tokens.js
- .project/mockups/shared/base.css
- .project/mockups/shared/components-loader.js
- .project/mockups/shared/tweaks-panel.js

Si un fichier manque, le générer MAINTENANT (rejouer la sous-étape concernée du
CHECKPOINT FINAL) avant tout message de conclusion. Ne réponds « design finalisé »
que si les 8 fichiers existent.

## Sections markdown réservées aux tool handlers

Certaines sections markdown des fichiers `.project/*.md` sont **gérées par
les tool handlers Reborn** (côté frontend Tauri). Ces sections ont une SSoT
côté fichier mais sont écrites/réécrites uniquement par les tools dispatcher
du desktop, pas par toi en tant qu'agent.

**Liste des sections réservées** :

- `## Direction choisie` (dans `.project/design.md`) - écrite par le tool
  `set_design_direction`. Contient l'index 0-based de la direction validée
  par l'utilisateur + les chemins canoniques HTML/PNG. Ne pas la modifier
  manuellement : appelle `set_design_direction({directionIndex})`.

**Règle générale** : si une section porte un titre listé ci-dessus, traite-la
comme un champ piloté par tool. Le contenu hors de ces sections (le reste de
`design.md`, `app.md`, etc.) reste libre - tu peux l'éditer normalement via
`Edit` / `Write`.
