---
name: mockup-screens-generator
description: >
  Generation iterative des ecrans HTML de mockup (Phase 2 de /mockup).
  Invoque ce skill quand /mockup ou l'utilisateur veut generer les ecrans
  de la roadmap mockups apres /mockup-prepare. Le skill genere les ecrans
  un par un, extrait les composants partages, audite schema vs UI apres
  chaque ecran, et trace toutes les decisions de Phase 2 dans
  .project/mockups/_phase2-decisions.md pour que le contexte parent
  puisse reprendre la suite en Phase 3.
  Declencheurs : "genere les ecrans", "Phase 2 mockup", "/mockup-screens",
  ou invocation explicite par /mockup.md.
allowed-tools:
  - "Read"
  - "Write"
  - "Edit"
  - "Bash"
  - "Skill"
---

# Skill mockup-screens-generator

## Tracage des decisions de Phase 2 (obligatoire)

Fenetre forkee : le contexte parent ne voit pas les echanges. Maintenir
`.project/mockups/_phase2-decisions.md` (append-only) : ecran genere, gap accepte/rejete,
iteration, decision structurante. Relu par `/mockup` avant la Phase 3.

**REGLE UI** : `notify_writing({ file_path })` avant chaque Write d'ecran HTML.

Prerequis : `roadmap.md`, `design.md`, `app.md`, `shared/design-system.css`. Preview : http://localhost:8080.
Sortie : `pages/*.html`, `shared/components/*.html`, `index.html`, `roadmap.md`, `app.md`, `decisions.md`.

## Lecture de la roadmap (toujours en premier)

Lire `.project/mockups/roadmap.md` : ecrans coches/non coches, pilote ou suivant,
direction visuelle, decisions structurantes de display, glossaire data -> schema.

## Chargement conditionnel des references

- SI l'ecran-pilote n'est pas encore coche dans `.project/mockups/roadmap.md`
  (`- [ ]` + `(PILOTE)`), lire `references/etapes-pilote.md` MAINTENANT. Obligatoire.
- Au PREMIER ecran genere dans cette session, lire `references/tweaks-exemples.md`
  une fois. Pas besoin de le relire pour les ecrans suivants.
- Au PREMIER audit schema vs UI de la session (Etape 2A point 6 ou premiere occurrence de Etape 2D), lire `references/audit-format.md` une fois pour avoir le format exact des tableaux. Pas besoin de relire ensuite.

## Images : skill `image-generation` OBLIGATOIRE

Pour TOUT visuel d'illustration (hero, vignette, avatar), invoquer le skill
`image-generation`. NE JAMAIS generer de SVG decoratif ou de placeholder inline.

`saveAs` -> `.project/mockups/images/<nom-explicite>.png`. Nommage kebab-case :
`hero-<page>.png`, `feature-<nom>.png`, `ambiance-<idx>.png`.
HTML : `<img src="images/<nom>.png" alt="<description courte FR>">`.
Prompt aligne avec `design.md` (tokens, palette, ton, style photo).
Coherence : generer UN SEUL visuel partage, le referencer depuis les deux ecrans.
Erreur quota (HTTP 429) : proposer placeholders neutres, attendre la recharge.

## Stack CSS (imposee)

Les mockups HTML DOIVENT utiliser Tailwind CSS via CDN. Pattern obligatoire :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>...</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="../shared/tailwind-tokens.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=..."
    />
    <link rel="stylesheet" href="../shared/design-system.css" />
    <link rel="stylesheet" href="../shared/base.css" />
    <script src="../shared/components-loader.js" defer></script>
    <script>
      window.__TWEAKS__ = {
        variants: {
          // Une entree par module cle, 3 options minimum chacune.
        },
      };
    </script>
    <script src="../shared/tweaks-panel.js" defer></script>
  </head>
  <body class="bg-background text-text font-body min-h-screen">
    <!-- Contenu 100% Tailwind. Chaque module = 3 wrappers data-variant-group/data-variant -->
  </body>
</html>
```

JAMAIS de `<style>` inline ni de CSS vanilla. TOUT via classes Tailwind.
**TOUJOURS ecrire le contenu francais avec tous les accents corrects.**

### Annotation `data-mockup-id` (OBLIGATOIRE)

Chaque bloc significatif DOIT porter `data-mockup-id="<kebab-case>"`. Blocs a
annoter : sections, navbar, hero, cartes, CTA, listes, formulaires, footers,
sidebars, modales. Exemples : `nav-primary`, `hero`, `checkout-form`.

Fallback Reborn : (1) ancetre `data-mockup-id`, (2) ancetre `data-slot`,
(3) selecteur `nth-of-type` (fragile, Reborn avertit).

## Index de navigation (auto)

Apres CHAQUE ajout/modification, regenerer `index.html` : titre+pitch, section Explorations
(si presente), section Pages (carte+lien), section Composants partages (si extraits), meta date/compteurs.

## Tweaks panel par ecran (OBLIGATOIRE, ZERO EXCEPTION)

**Un ecran sans panneau de tweaks est un ecran non livrable.**

Palette/mode/typo deja figes par /design. Le panel propose uniquement des **variantes
de mise en page** par module. Pour CHAQUE module (hero, cards, tableau, formulaire,
sidebar, header, stats, empty-state, CTA...) : **3 versions differentes minimum** :
V0 consensuelle, V1 alternative, V2 radicale (asymetrique, editorial, ultra-compact...).
Voir `references/tweaks-exemples.md` pour les exemples par type d'ecran.

Quand un module apparait plusieurs fois (6 cards dans une grille), CHAQUE occurrence
DOIT avoir ses 3 wrappers - pas seulement la premiere :

```html
<section data-variant-group="hero" data-variant="0"><!-- V0 --></section>
<section data-variant-group="hero" data-variant="1" style="display:none">
  <!-- V1 -->
</section>
<section data-variant-group="hero" data-variant="2" style="display:none">
  <!-- V2 -->
</section>
```

**Checklist AVANT de presenter :** `tweaks-panel.js` + `window.__TWEAKS__` presents,
`tweaks-panel.js` dans `shared/` (sinon copier depuis le starterkit), 3 entrees minimum
dans `variants` x 3 options, 3 wrappers par occurrence, variants 1+2 en `display:none`.
Si UN SEUL point manque, l'ecran n'est pas pret.

## Skill frontend-design (OBLIGATOIRE, A CHAQUE ECRAN)

Invoquer avant de generer CHAQUE ecran, sans exception. Passer : design-system, nom de
l'ecran, composants attendus, decisions structurantes, glossaire data -> schema. Demander
3 propositions de mise en page par module cle (alimentent les variantes du tweaks panel).

## Mise a jour de la roadmap (apres CHAQUE ecran valide)

`- [ ] {nom}` -> `- [x] {nom}` + mettre a jour `## Etat` (N/Total ecrans, prochain).

---

## Etape 2C : Ecrans suivants

Pour CHAQUE ecran non coche dans l'ordre de la roadmap :

1. **2E (coherence)** : scanner `pages/*.html` pour recuperer valeurs partagees
   (run_id, noms d'agents, montants, timestamps). Les passer a frontend-design.
2. Invoquer `frontend-design` (design + glossaire + decisions + valeurs partagees).
3. Generer `pages/{nom}.html` : `data-include` pour composants extraits, tweaks
   panel complet, mobile-first.
4. Regenerer `index.html`.
5. Donner URLs + demander validation visuelle.
6. Boucle ajustements jusqu'a validation.
7. **2D (audit)** : une fois HTML stabilise (cf. section Etape 2D).
8. Cocher dans `roadmap.md` apres validation visuelle ET audit.

## Etape 2D : Audit schema vs UI

A executer UNIQUEMENT apres validation visuelle (HTML stabilise). Produire dans
le chat deux tableaux : aligne avec le schema (source par donnee) et gaps UX
(proposition schema par gap). Si M = 0 : audit ferme. Si M > 0 : demander pour
chaque gap (a) ajouter au schema, (b) retirer du mockup, (c) tu decides ?
Mettre a jour `app.md` + `decisions.md` immediatement. Re-auditer si HTML modifie.
Mettre a jour le glossaire dans `roadmap.md`.

## Etape 2E : Coherence inter-mockups

Scanner `pages/*.html` avant chaque nouvel ecran. Reutiliser EXACTEMENT les
valeurs partagees. Si une valeur change pour une raison UX, propager sur TOUS
les mockups concernes en meme temps.

---

## Checkpoint fin de Phase 2

Verifier avant de demander la transition :

- `roadmap.md` : zero `- [ ]` restant
- Chaque `pages/{nom}.html` existe, composants dans `shared/components/`
- `index.html` liste tout, tous les gaps UX tranches
- Grep `tweaks-panel.js` + `__TWEAKS__` sur tous les `pages/` : si un ecran manque
  le panel ou les variantes (3 x 3 min), le regenerer MAINTENANT avant de continuer

Puis demander : « Phase 2 terminee - [N] ecrans, [M] composants partages, roadmap
cochee, audit valide, galerie a jour sur http://localhost:8080/. On passe a la Phase 3
(screenshots PNG + `app.md` mis a jour avec les references mockups) ? »

Attendre la validation explicite.
