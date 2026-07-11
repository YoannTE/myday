# Etapes pilote (2A + 2B)

Lis ce fichier si l'ecran-pilote n'est pas encore coche dans
`.project/mockups/roadmap.md` (entree marquee `- [ ]` avec `(PILOTE)`).

---

## Format initial de `_phase2-decisions.md`

Au tout premier ecran de la session, CREER le fichier `.project/mockups/_phase2-decisions.md` avec cette structure (append-only ensuite) :

```markdown
# Phase 2 - Decisions

## Ecrans generes

- [x] login.html - valide visuellement + audit OK
- [x] dashboard.html - gap accepte : ajout `last_login_at` sur user

## Schema evolutions (`app.md` mis a jour pendant Phase 2)

- 2026-05-18 : ajout `user.last_login_at` timestamp (vu sur dashboard)

## Iterations notables

- dashboard : header simplifie a la demande utilisateur (retire le subtitle)
```

A chaque ecran genere, AJOUTER une ligne dans la section appropriee (jamais reecrire le fichier).

---

## Etape 2A : Ecran-pilote monolithique

A executer UNIQUEMENT si l'ecran-pilote n'est pas encore coche dans la roadmap.
Si l'ecran-pilote est deja `- [x]`, reprendre le SKILL.md a l'Etape 2C directement.

1. Invoquer le skill `frontend-design` pour l'ecran-pilote (passer design +
   glossaire de cet ecran + decisions structurantes).
2. Generer l'ecran-pilote dans `.project/mockups/pages/{nom-pilote}.html` :
   - HTML COMPLET avec tous les blocs inline (navbar, contenu, footer ensemble)
   - Tailwind utility-first + `shared/design-system.css` via `<link>`
   - Appliquer les composants et variantes decrits dans `design.md`
   - **Tweaks panel obligatoire** : inclure `tweaks-panel.js`, declarer
     `__TWEAKS__.variants` avec 3-5 modules cles, 3 options chacun, et wrapper
     chaque module avec ses 3 versions (`data-variant-group`/`data-variant`
     0, 1, 2 - variants 1 et 2 en `display:none`).
     **Checklist AVANT de presenter** (verifier chaque point) :
     - `tweaks-panel.js` present dans le `<head>` de l'ecran
     - `window.__TWEAKS__` declare avec ses `variants`
     - `tweaks-panel.js` present dans `shared/` (sinon copier depuis le starterkit)
     - 3 entrees minimum dans `variants`, chacune avec 3 options
     - 3 wrappers `data-variant-group`/`data-variant` par occurrence de module
     - Variants 1 et 2 en `display:none`
       Si UN SEUL point manque, l'ecran n'est pas pret.
   - Si `tweaks-panel.js` n'existe pas encore dans `shared/`, le copier depuis
     le starterkit avant de generer l'ecran.
   - Mobile-first, responsive.
3. Regenerer `.project/mockups/index.html`.
4. Donner les DEUX URLs et demander la validation visuelle :

   « L'ecran [nom] est pret.
   - Voir directement : http://localhost:8080/pages/{nom}.html
   - Ou via la galerie (tous les ecrans) : http://localhost:8080/ »

5. **Boucle d'ajustement visuel** : tant que l'utilisateur n'a pas valide,
   appliquer les ajustements demandes (couleurs, typo, layout, contenu,
   hierarchie) directement dans le HTML, regenerer l'index, re-presenter.
   On prend le temps qu'il faut sur le pilote.
6. **Une fois la validation visuelle obtenue**, lancer l'**Etape 2D (Audit
   schema vs UI)** sur le HTML final. Trancher les gaps avec l'utilisateur.
   Re-auditer si le HTML a ete modifie suite aux choix utilisateur.
7. Apres validation visuelle ET traitement des gaps schema, COCHER l'ecran-pilote
   dans `.project/mockups/roadmap.md`. Puis enchainer sur l'Etape 2B.

---

## Etape 2B : Extraction des composants recurrents

A executer UNIQUEMENT juste apres la generation de l'ecran-pilote.
Si l'ecran-pilote etait deja coche au demarrage, considerer que l'extraction
a deja ete faite et reprendre le SKILL.md a l'Etape 2C directement.

**REGLE DE DECISION** (ne PAS demander a l'utilisateur, decider seul) :

Un composant est extractible UNIQUEMENT si son HTML est **strictement identique**
sur toutes les pages ou il apparait. `data-include` charge du HTML statique,
PAS un template avec variables.

**A EXTRAIRE systematiquement** (structurels, identiques sur toutes les pages) :

- navbar / header de navigation
- footer
- sidebar (si dashboard)
- FAB (floating action button)
- menu mobile / burger

**A NE JAMAIS EXTRAIRE** (contenu variable par instance) :

- Cards de donnees (resto-card, recipe-card, product-card, user-card...)
- Rows de liste, items de timeline
- Toute unite qui affiche le contenu d'UNE entite specifique

Le choix est binaire et mecanique. Si tu hesites : « Est-ce que ce bloc est
identique a 100% sur toutes les pages ou il apparait ? » Si non -> pas d'extraction.

**Procedure :**

1. Analyser l'ecran-pilote, appliquer la regle de decision ci-dessus.
2. Pour CHAQUE composant a extraire :
   - Extraire le HTML vers `.project/mockups/shared/components/{nom}.html`
   - Remplacer dans l'ecran-pilote par
     `<div data-include="../shared/components/{nom}.html"></div>`
   - Verifier que `<script src="../shared/components-loader.js" defer></script>`
     est bien dans le `<head>` (le template de page le contient deja).
3. Informer l'utilisateur (pas de question) :

   « J'ai extrait ces composants partages : [liste]. Les cartes de contenu
   restent inlines car elles portent des donnees specifiques. Je passe aux
   ecrans suivants. »

4. Regenerer `.project/mockups/index.html` en ajoutant la section
   "Composants partages".

Puis reprendre le SKILL.md a l'Etape 2C.
