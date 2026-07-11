# Exemples tweaks panel

Exemples a consulter une fois pour comprendre la regle des 3 versions et les
patterns par type d'ecran. Pas besoin de relire a chaque ecran - les regles
imperatives sont dans SKILL.md.

---

## Exemples de 3 versions par module

**Liste de cards (page de listing) :**

- V0 : grille classique (3 colonnes desktop, image-haut + infos-bas)
- V1 : liste verticale dense (1 ligne par item, image-gauche + infos-droite)
- V2 : grille editoriale (cards de tailles variables, mix featured + normaux)

**Header de page de detail :**

- V0 : breadcrumb + titre + sous-titre alignes a gauche
- V1 : split - titre a gauche, actions principales a droite
- V2 : full-bleed - image de couverture en background + titre en overlay

**Tableau de donnees :**

- V0 : tableau classique (lignes denses)
- V1 : tableau aere (1 ligne = 1 card, plus de respiration)
- V2 : kanban / colonnes par statut (autre paradigme de lecture)

**Formulaire :**

- V0 : 1 colonne classique, labels au-dessus
- V1 : 2 colonnes, labels a gauche (style settings)
- V2 : multi-step (wizard) avec etapes numerotees

---

## Quels modules mettre en variantes selon le type d'ecran

Selectionner les 3 a 5 modules les plus structurants (ceux qui changent
radicalement le ressenti). Les composants partages deja extraits (navbar,
footer, sidebar identique partout) ne sont PAS a mettre en variantes.

- **Landing** : hero, section features/benefices, section social proof, CTA final
- **Dashboard** : header (KPIs), grille principale, sidebar/nav, empty-state
- **Page de listing** : header de page, filtres, layout des items, pagination
- **Page de detail** : header, section principale, sidebar/aside, related
- **Formulaire** : layout du form, ordre des champs, style des CTAs

---

## Configuration `__TWEAKS__` - exemple complet

```html
<script>
  window.__TWEAKS__ = {
    variants: {
      hero: {
        label: "Style de hero",
        options: [
          "Split classique",
          "Centre full-bleed",
          "Editorial asymetrique",
        ],
      },
      cards: {
        label: "Layout des cards",
        options: [
          "Grille 3 colonnes",
          "Liste verticale dense",
          "Grille editoriale",
        ],
      },
      filters: {
        label: "Style des filtres",
        options: [
          "Sidebar gauche",
          "Barre horizontale top",
          "Drawer mobile-first",
        ],
      },
    },
  };
</script>
```

---

## Rappel critique

Regle des occurrences multiples : quand un module apparait N fois dans un ecran
(ex : 6 cards dans une grille, 3 lignes dans un tableau), CHAQUE occurrence DOIT
avoir ses 3 wrappers `data-variant-group` + `data-variant`. Sinon le tweak ne
fonctionne que sur la premiere occurrence.
