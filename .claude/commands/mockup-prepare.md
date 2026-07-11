Phase 1 du mockup : preparer la generation des ecrans HTML - identifier les
ecrans, designer l'ecran-pilote, construire le glossaire data → schema, et
sauvegarder la roadmap.

**REGLE UI** : avant chaque Write/Edit long de
`.project/mockups/roadmap.md` ou d'un mockup HTML, appelle d'abord
`notify_writing({ file_path: "<chemin>" })` pour afficher l'animation
plume cote UI pendant la redaction. Cf. CLAUDE.md section
« Hook `notify_writing` ». Ignorer si tu n'as pas ce tool.

Cette commande est invoquee automatiquement par `/mockup` apres la verification
des prerequis (design.md + design-system.css) et le lancement du serveur de
preview, mais peut aussi etre lancee manuellement.

Prerequis :

- `.project/design.md` doit exister (cree par `/design`)
- `.project/mockups/shared/design-system.css` doit exister (cree par `/design`)
- `.project/app.md` doit exister (cree par `/start`) - sections `## Entites`
  et `## Fonctionnalites` requises
- `.project/decisions.md` doit exister (cree par `/start`) si des decisions
  structurantes de display ont ete prises

Sortie : `.project/mockups/roadmap.md` contenant :

- la liste des ecrans (checklist a cocher)
- l'ecran-pilote designe
- un rappel de la direction visuelle (design.md)
- les decisions structurantes de display (decisions.md)
- le glossaire data → schema par ecran (cf. Etape 1E)

---

## REPRISE : si la roadmap existe deja

**AVANT TOUTE AUTRE ACTION**, verifier si `.project/mockups/roadmap.md`
existe deja.

**Si oui** → SAUTER ENTIEREMENT cette Phase 1.

Procedure de reprise :

1. Lire `.project/mockups/roadmap.md`
2. Identifier le premier ecran NON coche (`- [ ]`)
3. Afficher a l'utilisateur :

   « Roadmap des mockups deja existante - reprise au prochain ecran non genere.
   - Ecrans deja generes : [liste des coches]
   - Prochain ecran a generer : [nom]
   - Restants apres : [N - 1] ecrans

   Je passe directement a la Phase 2 (generation) sur l'ecran [nom]. »

4. Terminer immediatement cette commande. Le controle revient a `/mockup`
   qui enchaine sur `/mockup-screens` (lequel lit la roadmap, recupere le
   glossaire, et reprend a l'ecran non coche).

**Si NON** → executer les etapes 1A a 1E ci-dessous puis sauvegarder la
roadmap au CHECKPOINT FIN DE PHASE 1.

Si l'utilisateur veut TOUT repartir de zero, il doit supprimer manuellement
`.project/mockups/roadmap.md` (et eventuellement le dossier
`.project/mockups/pages/`) avant de relancer `/mockup`.

---

## Etape 1A : Lecture du design valide

Relire `.project/design.md` pour recuperer :

- Direction choisie (ambiance, principes)
- Tokens (couleurs, typographie, spacing, radii)
- Composants valides et variantes retenues (style de cards, type de hero...)
- Ton de la copy
- Preferences utilisateur

Cette section est determinante : sans elle, les ecrans retombent dans des
patterns generiques meme si le design-system est distinctif.

## Etape 1B : Lecture du brief produit

Relire `.project/app.md` pour comprendre :

- Les types d'utilisateurs (Phase 1 du brief)
- Les parcours utilisateur (Phase 2 du brief)
- Les fonctionnalites priorisees MVP / Phase 2 (Phase 2 du brief)
- La section `## Entites` (table par table) - sera utilisee a l'Etape 1E

## Etape 1C : Identification des ecrans et de l'ecran-pilote

1. Identifier 5 a 8 ecrans principaux a generer depuis `app.md`. Typiques :
   - Landing / accueil (si app publique)
   - Dashboard principal (si app protegee)
   - Page de liste (tableau ou grille)
   - Page de detail / formulaire
   - Profil / settings
   - Auth (login)

   Ne pas depasser 8 ecrans pour la premiere passe : cibler le coeur du parcours
   utilisateur principal. Les ecrans secondaires peuvent etre ajoutes apres
   validation de la direction visuelle.

2. Identifier l'ecran-pilote : celui qui donne le ton pour tous les autres.
   - Si app publique → home / landing
   - Si app protegee → dashboard

   Il sera genere en premier, valide visuellement par l'utilisateur, puis
   servira de reference pour les composants extraits (navbar, footer...).

3. Relire la section "Composants valides" de `design.md` pour appliquer les
   variantes retenues a chaque ecran prevu.

## Etape 1D : Lecture des decisions structurantes

Lire `.project/decisions.md` pour recuperer les decisions structurantes de
display (ex: convention `metadata.display` a 5 primitives, convention
`events.payload.summary`, formats d'affichage standardises, etc.).

Ces decisions priment sur les choix esthetiques - un mockup qui les ignore
est un mockup faux. Elles seront rappelees dans la roadmap pour que
`/mockup-screens` les ait sous les yeux a chaque ecran.

## Etape 1E : Construction du glossaire data → schema

Pour CHAQUE ecran identifie a l'Etape 1C, construire un glossaire qui
mappe chaque donnee prevue a l'affichage (chiffre, label, badge, depeche,
status, timestamp...) a sa source dans le schema BDD (section `## Entites`
de `app.md`).

Format du glossaire (exemple) :

```
Ecran : overview-op
- "3 agents actifs"        → count(workflow_definitions where is_active=true)
- "284 executions 7j"      → count(workflow_runs where created_at >= now()-7d)
- "12,47 € cette semaine"  → sum(llm_calls.cost_eur where created_at >= now()-7d)
- "expire dans 23 h 48"    → pending_inputs.expires_at - now()
- "Marco a approuve"       → pending_inputs.resolved_by → user.name
```

Sources possibles a indiquer :

- `table.colonne` (lecture directe)
- jointure (`pending_inputs.resolved_by → user.name`)
- agregation (`count(...)`, `sum(...)`, `avg(...)`)
- champ JSONB (`metadata.display.title`)
- calcul (`expires_at - now()`)

Si tu hesites sur la source d'une donnee → c'est le signal qu'elle n'existe
pas dans le schema. La noter d'office comme **gap UX** (sera traitee a la
Phase 2 etape 2d), avant meme de generer le HTML.

Ce glossaire est CRITIQUE : il sera passe au skill `frontend-design` a chaque
ecran (Phase 2) et servira de base a l'Audit schema vs UI (Phase 2 etape 2d).

---

→ **CHECKPOINT FIN DE PHASE 1** :

**1. Sauvegarder la roadmap dans `.project/mockups/roadmap.md`** :

Creer le fichier (le dossier `.project/mockups/` existe deja, cree par
`/design`). Format obligatoire :

```markdown
# Roadmap des mockups

## Ecrans a generer

- [ ] [nom-pilote] - [URL ou role] (PILOTE)
- [ ] [nom-2] - [URL ou role]
- [ ] [nom-3] - [URL ou role]
      ...

## Direction visuelle (rappel de design.md)

- Ambiance : [...]
- Tokens cles : [couleurs principales, typographie, spacing]
- Composants valides : [variantes retenues : type de card, hero, etc.]
- Ton de la copy : [...]

## Decisions structurantes (rappel de decisions.md)

- [Convention 1 : ex. `metadata.display` a 5 primitives (title, subtitle, highlights, context, cta)]
- [Convention 2 : ex. `events.payload.summary` obligatoire]
- ...

## Glossaire data → schema (par ecran)

### [nom-pilote]

- "donnee affichee 1" → source schema
- "donnee affichee 2" → source schema
- **gap UX** : "donnee affichee 3" → pas de source identifiee

### [nom-2]

- ...

## Sources

- .project/design.md (direction + tokens + composants)
- .project/app.md (parcours + fonctionnalites + entites)
- .project/decisions.md (decisions structurantes de display)

## Etat

Aucun ecran genere - Phase 2 a faire.
```

Regles importantes :

- L'ecran-pilote DOIT apparaitre EN PREMIER, marque `(PILOTE)`
- Tous les ecrans commencent decoches `- [ ]`
- Les noms doivent matcher exactement les futurs fichiers
  `.project/mockups/pages/{nom}.html`
- Le glossaire DOIT contenir une sous-section par ecran
- Les gaps UX deja identifies sont notes en clair avec `**gap UX**`

**2. Demander la validation de la transition** a l'utilisateur :

« Roadmap des mockups prete - sauvegardee dans `.project/mockups/roadmap.md` :
[N] ecrans identifies, ecran-pilote : [nom], glossaire data → schema construit
([X] elements mappes, [Y] gaps UX preliminaires).

On passe a la Phase 2 : generer l'ecran-pilote (skill `frontend-design` +
glossaire), auditer le schema vs UI apres chaque ecran, extraire les
composants partages, puis generer les ecrans suivants un par un avec
validation a chaque etape ? »

Attendre la validation explicite de l'utilisateur. Si l'utilisateur veut
retirer/ajouter un ecran, changer le pilote, ou enrichir le glossaire,
modifier la roadmap dans `.project/mockups/roadmap.md` avant de continuer.
