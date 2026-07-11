Construit le plan d'execution detaille d'un round et le fait reviewer par 2 agents (architect-reviewer + lead-dev-reviewer) avant l'implementation.

Argument : numero du round (ex: /round-plan 5, /round-plan 12bis).

Cette commande est invoquee automatiquement par `/code` au debut de chaque
round, mais peut aussi etre lancee manuellement.

Sortie : `.project/rounds/{id}/plan.md` (consomme par `/round-implement`).

**REGLE UI** : avant chaque Write/Edit long de
`.project/rounds/{id}/plan.md`, appelle d'abord
`notify_writing({ file_path: ".project/rounds/{id}/plan.md" })` pour
afficher l'animation plume cote UI pendant la redaction. Cf. CLAUDE.md
section « Hook `notify_writing` ». Ignorer si tu n'as pas ce tool.

---

## PHASE 1 - Construction du plan

1. **Extraire les infos du round** depuis `.project/rounds/{id}/spec.md` :
   - Si ce fichier est absent mais que l'ancien `.project/rounds/round-{id}.md` existe, lancer `/round-migrate {id}` puis relire `.project/rounds/{id}/spec.md`.
   - Nom du round (frontmatter `title`)
   - Features incompletes (`- [ ]`) dans la section `## Perimetre`
   - Section `## Tests fin de round`
   - Dependances (frontmatter `depends_on`)

2. **Lire le contexte projet** (sections pertinentes seulement) :
   - `.project/app.md` (entites, pages, flows lies aux features du round)
   - `.project/design.md` (tokens, typo, patterns visuels)
   - `.project/patterns.md` (patterns UI deja etablis)

3. **Construire le plan** et l'ecrire dans `.project/rounds/{id}/plan.md` (creer le dossier `.project/rounds/{id}/` s'il manque) :
   - Quels agents lancer, combien, quelles taches assigner a chacun
   - Quels fichiers existants chaque agent doit lire avant de coder
   - Comment repartir les taches pour maximiser le parallelisme
   - Quels tests de fin de round appliquer
   - Approche technique pour chaque tache (sans ecrire de code)

Ce fichier sert de reference pour les reviewers (PHASE 2) et pour les agents
d'implementation (lances par `/round-implement`).

---

## PHASE 2 - Review par 2 agents en parallele

1. Utilise `kit_task_note` avec team="review-round-{id}", task="Coordination ouverte - Review du plan Round {id}", status="pending".

2. Lancer en parallele 2 reviewers dans l'equipe :

   ```
   Ajoute dans `tasks[]` de `kit_agent_dispatch` : { agent: "architect-reviewer", task: "
   Tu fais partie de l'equipe 'review-round-{id}'. Ton nom est 'architect'.
   L'autre membre est 'lead-dev'.

   Contexte projet :
   ---
   {contenu de .project/app.md - sections pertinentes}
   ---

   Plan du round :
   ---
   {contenu de .project/rounds/{id}/plan.md}
   ---

   Review ce plan d'execution :
   - Ordre des taches correct ?
   - Dependances manquantes ?
   - Risques architecturaux ?
   - Approche technique adaptee ?

   Partage tes findings avec lead-dev dans la section « Coordination avec lead-dev » de ton rapport.
   Lis ses findings et reagis.
   Produis ton rapport final.

   Retourne UNIQUEMENT les corrections a apporter (pas de validation positive).
   Si tout est bon, reponds 'RAS'.
   Reponds en francais, sois concis."
   )
   ```

   ```
   Ajoute dans `tasks[]` de `kit_agent_dispatch` : { agent: "lead-dev-reviewer", task: "
   Tu fais partie de l'equipe 'review-round-{id}'. Ton nom est 'lead-dev'.
   L'autre membre est 'architect'.

   Contexte projet :
   ---
   {contenu de .project/app.md - sections pertinentes}
   ---

   Plan du round :
   ---
   {contenu de .project/rounds/{id}/plan.md}
   ---

   Review ce plan d'execution :
   - Faisabilite technique ?
   - Race conditions ou edge cases a anticiper ?
   - Repartition agents/taches optimale ?
   - Tests suffisants ?

   Partage tes findings avec architect dans la section « Coordination avec architect » de ton rapport.
   Lis ses findings et reagis.
   Produis ton rapport final.

   Retourne UNIQUEMENT les corrections a apporter (pas de validation positive).
   Si tout est bon, reponds 'RAS'.
   Reponds en francais, sois concis."
   )
   ```

3. **Collecter les rapports** :
   - Si corrections proposees → mettre a jour `.project/rounds/{id}/plan.md` avec les corrections
   - Si les deux repondent « RAS » → plan valide

4. Utilise `kit_task_note` avec team="review-round-{id}", task="Coordination clôturée", status="done".

Ce processus est automatique - pas de validation utilisateur.
