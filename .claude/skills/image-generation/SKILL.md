---
name: image-generation
description: >
  Génère un visuel photo-réaliste via le tool MCP `generate_image`
  (OpenAI gpt-image-2). À déclencher dès qu'un visuel est requis dans
  une direction de design, un mockup HTML, ou tout autre artefact qui
  contient une image (hero, photo d'ambiance, illustration de feature,
  vignette). NE PAS générer de SVG décoratif ni de placeholder inline.
---

# Skill `image-generation` - Génération d'images via gpt-image-2

## Quand l'utiliser

Dès que tu rédiges un HTML qui doit afficher une image :

- direction de design (`.project/design-directions/<idx>/index.html`)
- mockup d'écran (`.project/mockups/pages/<page>.html`)
- toute page produit, hero de landing, etc.

**Interdit** : SVG décoratif fait main, placeholder gris, `<div class="bg-...">` à
la place d'une image, image stock copiée depuis une URL.

## Le tool

`mcp__reborn__generate_image` - backend OpenAI gpt-image-2 piloté par Reborn.
Quota mensuel par agence, cache PNG par hash de prompt (un même prompt ne
recompte pas le quota).

```
mcp__reborn__generate_image({
  prompt: "<1-3 phrases : sujet, style, ambiance, lumière, palette>",
  size: "1536x1024",     // paysage (hero) | "1024x1024" carré | "1024x1536" portrait
  quality: "standard",   // 'hd' réservé aux héros finaux
  saveAs: "<chemin relatif depuis la racine du projet>.png"
})
```

## Conventions par contexte

### Direction de design (Phase /design)

- `saveAs` : `.project/design-directions/{idx}/images/{nom}.png`
- HTML : `<img src="images/{nom}.png" alt="...">` (relatif à `index.html`)
- Le prompt DOIT refléter la palette de la direction (« teintes chaudes
  terracotta, sable, lumière naturelle » pour Sable & Terracotta,
  « palette verte profonde sur marbre clair » pour Vert Reborn, etc.)

### Mockup d'écran (Phase /mockup-screens)

- `saveAs` : `.project/mockups/images/{nom}.png`
- Nommage : `hero-<page>.png`, `feature-<nom>.png`, `ambiance-<idx>.png`
  (kebab-case, toujours `.png`)
- HTML : `<img src="images/{nom}.png" alt="...">`
- Le prompt DOIT s'aligner avec la direction validée - lire d'abord
  `.project/design.md` (section `## Tokens` et `## Principes de design`)

## Construire un bon prompt

Inclure systématiquement :

- **Sujet** : ce qu'on voit (cuisine moderne, casquette peinte main, etc.)
- **Style** : photographie éditoriale / illustration / artwork / macro
- **Ambiance & lumière** : douce, contrastée, naturelle, néons, etc.
- **Palette** : reprendre les tons dominants de la direction
- **Cadrage** : plongée, grand angle, macro, plan rapproché

À éviter dans le prompt :

- Noms de marques (Nike, Supreme, Apple…) - risque de refus policy
- Visages ou personnes identifiables (acteurs, sportifs, artistes)
- Verbes ambigus (« designer », « copier ») - préférer « imaginer », « créer »

Exemples de bons prompts :

- « Photographie éditoriale grand angle d'une cuisine moderne aux teintes
  chaudes terracotta et sable, lumière naturelle douce, profondeur de champ »
- « Macro abstraite de coups de pinceau acrylique vermillon et ocre brûlé
  sur papier crème, atmosphère contemplative, grain photo fin »

## Erreurs courantes

| Cas                                | Quoi faire                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `429` quota atteint                | Livrer sans le visuel, placeholder neutre, signaler dans le rapport final       |
| `503` OPENAI_API_KEY absente       | Idem, signaler la configuration manquante côté agence                           |
| Refus de policy (filtre Anthropic) | Reformuler le prompt en retirant marques / personnes / verbes ambigus, retenter |

## Pendant la génération

Le tool prend 15-30 s côté OpenAI. Le sidecar Reborn pousse automatiquement
des phrases narratives en rapport avec ton prompt pour faire patienter
l'utilisateur - **tu n'as rien à orchestrer**, c'est invisible côté agent.
Tu enchaînes simplement avec la suite de ton travail (référencer l'image
dans le HTML, continuer la direction, etc.).
