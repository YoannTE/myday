Ajoute une nouvelle fonctionnalité au projet. Description : $ARGUMENTS

=== PHASE 0 : TRIAGE OBLIGATOIRE ===

Avant de lancer le processus complet `/feature`, classe la demande `$ARGUMENTS` dans une seule catégorie :

0. `meta_or_support` - demande concernant Claude Code, l'agent, une commande slash, un warning CLI, le triage, le prompt, ou un déclenchement erroné. Ce n'est pas une feature produit.
1. `question_or_analysis` - question, audit, lecture ou recherche sans modification demandée.
2. `small_fix` - correction locale évidente : typo, libellé, couleur, marge, import, log, ajustement dans un fichier unique.
3. `bug_fix` - comportement existant cassé dans l'application à réparer, sans nouvelle capacité produit.
4. `true_feature` - nouvelle capacité utilisateur ou changement visible du comportement métier de l'application.
5. `large_or_risky_feature` - feature large ou risquée : auth, permissions, paiement, migration BDD, infra, API publique, agents IA, refactor structurel, plusieurs modules.

Règle prioritaire anti-faux-positifs :

- Si la demande parle de Claude Code, du coding agent, du terminal, du CLI, d'une commande slash (`/feature`, `/code`, etc.), d'un warning au lancement, d'un log collé, d'un lien de documentation ou du triage lui-même → `meta_or_support`.
- Si l'utilisateur dit qu'une commande s'est déclenchée à tort → `meta_or_support`.
- Une demande n'est une feature que si elle vise le produit applicatif construit dans ce dépôt. Les demandes concernant Claude Code, les commandes slash, les prompts, les warnings de lancement ou le comportement de l'agent restent `meta_or_support`, même si elles citent les mots « migration », « extensions », « ajouter », « corriger » ou « feature ».

Règle de décision rapide :

- Si après la modification l'utilisateur final de l'application pourra faire quelque chose qu'il ne pouvait pas faire avant → `true_feature` ou `large_or_risky_feature`.
- Si ce qui existe déjà dans l'application doit seulement fonctionner correctement → `bug_fix`.
- Si la demande ne nécessite aucune modification → `question_or_analysis`.

Flags utilisateur :

- Si `$ARGUMENTS` commence par `--force-feature`, `--feature` ou `[feature]`, ignorer ce triage et appliquer le processus complet.
- Si `$ARGUMENTS` commence par `--no-feature`, `--bypass-feature-gate` ou `[bypass-feature]`, ne pas appliquer le processus complet sauf si la demande est manifestement destructive.

Exemples de triage :

- « J'ai ce warning quand je lance Claude Code » → `meta_or_support`
- « Pourquoi /feature s'est déclenché ? » → `meta_or_support`
- « Ça a déclenché /feature à tort » → `meta_or_support`
- « Améliore le triage de /feature » → `meta_or_support`
- « Ajoute une page paramètres utilisateur » → `true_feature`
- « Le bouton sauvegarder ne fonctionne plus » → `bug_fix`
- « Corrige cette typo dans le titre » → `small_fix`
- « Explique-moi l'architecture actuelle » → `question_or_analysis`

Si la catégorie est `meta_or_support`, `question_or_analysis`, `small_fix` ou `bug_fix` :

1. Ne crée pas de plan `.project/.feature-*-plan.md`.
2. Ne crée pas de round.
3. Ne lance pas l'équipe de review feature.
4. Réponds ou corrige directement en mode léger, en restant strictement dans le périmètre demandé.
5. Commence ta réponse par : `Triage : process /feature complet non nécessaire - catégorie <catégorie>.`

Si la catégorie est `true_feature` ou `large_or_risky_feature` :

1. Applique toutes les phases ci-dessous.
2. Commence par : `Triage : process /feature requis - catégorie <catégorie>.`
3. Si la demande est trop large pour un seul round, propose un découpage en 2 à 4 features indépendantes avant de créer le plan.

**RÈGLE UI** : avant chaque Write d'un nouveau fichier de code ou Edit
important d'un `.project/*.md` (app.md, rounds/NNN/spec.md, patterns.md),
appelle d'abord `notify_writing({ file_path: "<chemin>" })` pour afficher
l'animation plume cote UI pendant la redaction. Inutile pour des Edit
courts. Cf. CLAUDE.md section « Hook `notify_writing` ». Ignorer si tu
n'as pas ce tool.

=== PHASE 1 : COMPRENDRE LA DEMANDE ===

1. Lis `.project/app.md`, `.project/rounds/index.json`, `.project/rounds/README.md` et `.project/patterns.md` pour le contexte
2. Si $ARGUMENTS est vide, demander a l'utilisateur :
   "Decris ce que tu voudrais ajouter ou ameliorer."
3. Discuter et preciser la demande :
   - Comprendre le besoin fonctionnel
   - Identifier les tables, pages ou modules concernes
   - Verifier que ca n'entre pas en conflit avec l'existant
   - Definir les permissions (qui peut acceder a quoi)
4. Identifier les features necessaires pour repondre a la demande
5. **Generer un slug court** pour la feature (ex: "multi-tenant", "notifications-email", "paiement-stripe") - servira a nommer les fichiers de plan et l'equipe de review

=== PHASE 2 : ECRITURE DU PLAN INITIAL ===

6. Determiner le numero du prochain round : lire `.project/rounds/index.json`,
   trouver l'entree avec l'`id` numerique le plus eleve (ignorer les ids
   alphanumeriques comme `000a`, `004bis`, etc.), puis incrementer de 1 et
   padder sur 3 chiffres (ex : max id numerique = `033` → prochain = `034`).

7. Construire le plan complet de la feature et l'ecrire dans `.project/.feature-{slug}-plan.md` :

```markdown
# Feature plan - {slug}

## Demande initiale

{description brute de l'utilisateur}

## Besoin fonctionnel

{reformulation claire apres discussion}

## Round propose : Round {N+1} - {Nom descriptif}

### Features (taches atomiques)

- [ ] F1 : {description detaillee}
- [ ] F2 : {description detaillee}
- [ ] F3 : {description detaillee}

### Impact sur l'existant

- Tables modifiees : {liste ou "aucune"}
- Nouvelles entites : {liste ou "aucune"}
- Pages modifiees : {liste ou "aucune"}
- Nouvelles pages : {liste ou "aucune"}
- Endpoints modifies : {liste ou "aucun"}
- Nouveaux endpoints : {liste ou "aucun"}

### Approche technique

{resume de l'approche : migrations, RLS, Server Actions vs API, composants UI, patterns a reutiliser}

### Dependances

- Features dont ce round depend : {liste ou "aucune"}
- Packages a installer : {liste ou "aucun"}

### Parcours utilisateur

{scenario principal bout en bout, etats intermediaires, cas d'erreur visibles}

### Permissions

{qui peut acceder a quoi - public, user authentifie, admin, proprietaire de la ressource}

### Tests fin de round

{spec de test extraite pour le qa-tester : pages a tester, endpoints a verifier, parcours critique}
```

Ce fichier sert de reference pour les reviewers et pour `/code`.

=== PHASE 3 : REVIEW PAR L'EQUIPE (automatique) ===

8. Determiner si la feature est user-facing (nouvelle page, nouveau parcours, partage, inscription, paiement, upload visible) → si oui, ajouter `growth-reviewer` a l'equipe.

9. Utilise `kit_task_note` avec team="review-feature-{slug}", task="Coordination ouverte - Review feature {slug}", status="pending".

10. Lancer en parallele les reviewers dans l'equipe (3 ou 4 selon user-facing). Chaque reviewer recoit le plan complet + le contexte projet + le nom de ses coequipiers pour pouvoir dialoguer via kit_agent_dispatch.

```
Ajoute dans `tasks[]` de `kit_agent_dispatch` : { agent: "architect-reviewer", task: "
Tu fais partie de l'equipe 'review-feature-{slug}'. Ton nom est 'architect'.
Les autres membres sont : 'lead-dev', 'product-owner'{, 'growth' si applicable}.

Contexte projet :
---
{contenu de .project/app.md - sections Entites et Regles metier}
---

Plan de la feature :
---
{contenu de .project/.feature-{slug}-plan.md}
---

Review ce plan sous l'angle architecture :
- Impact sur le modele de donnees existant (nouvelles tables, modifications, relations)
- Risques de conflit ou d'incoherence avec l'existant
- Dependances techniques a prendre en compte
- Approche d'implementation recommandee (migration, triggers, RLS)
- SSoT respecte ? Enforcement au bon endroit ?

Inclure dans ton rapport une section « Points à partager avec lead-dev, product-owner et growth ».
Lis leurs findings et reagis.
Produis ton rapport final.

Retourne UNIQUEMENT les corrections a apporter au plan (pas de validation positive).
Si tout est bon, reponds 'RAS'.
Reponds en francais, sois concis.
")
```

```
Ajoute dans `tasks[]` de `kit_agent_dispatch` : { agent: "lead-dev-reviewer", task: "
Tu fais partie de l'equipe 'review-feature-{slug}'. Ton nom est 'lead-dev'.
Les autres membres sont : 'architect', 'product-owner'{, 'growth' si applicable}.

Contexte projet :
---
{contenu de .project/app.md - sections Entites et Regles metier}
---

Plan de la feature :
---
{contenu de .project/.feature-{slug}-plan.md}
---

Review ce plan sous l'angle implementation :
- Faisabilite technique et complexite estimee
- Race conditions ou problemes de concurrence possibles
- Edge cases techniques (timeouts, echecs API, donnees invalides)
- Strategie de test recommandee (inclure ce que le qa-tester devra verifier : pages, boutons, formulaires, parcours)
- Infra : limites serverless, webhooks, jobs de fond, etat partage

Inclure dans ton rapport une section « Points à partager avec les autres reviewers ».
Lis leurs findings et reagis.
Produis ton rapport final.

Retourne UNIQUEMENT les corrections a apporter au plan (pas de validation positive).
Si tout est bon, reponds 'RAS'.
Reponds en francais, sois concis.
")
```

```
Ajoute dans `tasks[]` de `kit_agent_dispatch` : { agent: "product-owner-reviewer", task: "
Tu fais partie de l'equipe 'review-feature-{slug}'. Ton nom est 'product-owner'.
Les autres membres sont : 'architect', 'lead-dev'{, 'growth' si applicable}.

Contexte projet :
---
{contenu de .project/app.md - sections Parcours utilisateur et Fonctionnalites}
---

Plan de la feature :
---
{contenu de .project/.feature-{slug}-plan.md}
---

Review ce plan sous l'angle produit :
- Parcours utilisateur impactes ou a creer (etats intermediaires, cas d'erreur)
- Edge cases metier et etats non definis a clarifier
- Fonctionnalites complementaires necessaires (qu'on pourrait oublier)
- Impact sur l'experience utilisateur existante
- Permissions et acces coherents avec le reste de l'app

Inclure dans ton rapport une section « Points à partager avec les autres reviewers ».
Lis leurs findings et reagis.
Produis ton rapport final.

Retourne UNIQUEMENT les corrections a apporter au plan (pas de validation positive).
Si tout est bon, reponds 'RAS'.
Reponds en francais, sois concis.
")
```

```
[SI feature user-facing]
Ajoute dans `tasks[]` de `kit_agent_dispatch` : { agent: "growth-reviewer", task: "
Tu fais partie de l'equipe 'review-feature-{slug}'. Ton nom est 'growth'.
Les autres membres sont : 'architect', 'lead-dev', 'product-owner'.

Contexte projet :
---
{contenu de .project/app.md - sections Parcours utilisateur et monetisation si presente}
---

Plan de la feature :
---
{contenu de .project/.feature-{slug}-plan.md}
---

Review ce plan sous l'angle croissance :
- Opportunites de conversion manquees (upgrade prompt, CTA, onboarding)
- Potentiel viral / partage non exploite
- Frictions d'acquisition ou de retention
- Pricing/monetisation coherente avec la feature

Inclure dans ton rapport une section « Points à partager avec les autres reviewers ».
Lis leurs findings et reagis.
Produis ton rapport final.

Retourne UNIQUEMENT les corrections a apporter au plan (pas de validation positive).
Si tout est bon, reponds 'RAS'.
Reponds en francais, sois concis.
")
```

11. Collecter les rapports des reviewers.
    - Si corrections proposees → mettre a jour `.project/.feature-{slug}-plan.md` avec les corrections integrees
    - Si tous repondent "RAS" → le plan est bon

12. Utilise `kit_task_note` avec team="review-feature-{slug}", task="Coordination clôturée", status="done".

Ce processus est automatique - pas de validation utilisateur entre les reviewers.

=== PHASE 4 : PRESENTATION ET VALIDATION UTILISATEUR ===

13. Presenter a l'utilisateur une synthese claire (en francais, sans jargon) :

```
J'ai prepare le plan de ta feature et l'ai fait challenger par l'equipe d'experts.

Resume du round propose :

## Round {N+1} - {Nom descriptif}

Features :
- {F1}
- {F2}
- {F3}

Ce qui change sur l'existant :
- {resume impact BDD + pages + endpoints}

Retours integres des reviewers :
- Architecture : {1-2 points cles ou "RAS"}
- Implementation : {1-2 points cles ou "RAS"}
- Produit : {1-2 points cles ou "RAS"}
[si growth] - Croissance : {1-2 points cles ou "RAS"}

[Si des questions subsistent pour l'utilisateur]
Points a clarifier avec toi :
- {question 1}
- {question 2}

Plan complet dispo dans .project/.feature-{slug}-plan.md

On valide ?
```

14. Si l'utilisateur pose des questions ou demande des ajustements → modifier le plan dans `.project/.feature-{slug}-plan.md` et re-presenter.

15. Une fois valide, passer a la phase 5.

=== PHASE 5 : MISE A JOUR DES DOCUMENTS ===

16. **Creer le dossier et la spec de round** `.project/rounds/{NNN}/spec.md` (ou NNN est
    le numero determine a l'etape 6) :

    ```
    bash({ command: "mkdir -p .project/rounds/{NNN}" })
    notify_writing({ file_path: ".project/rounds/{NNN}/spec.md" })
    ```

    Contenu du fichier (frontmatter + 5 sections) :

    ```markdown
    ---
    id: "{NNN}"
    title: "{Nom descriptif du round}"
    status: pending
    depends_on: [{liste des ids dont ce round depend, entre guillemets, ou vide []}]
    ---

    ## Objectifs

    {resume des objectifs de la feature en 2-4 lignes}

    ## Perimetre

    {copier la liste des features - [ ] F1, F2, ... du plan}

    ## Mockups lies

    (a completer apres /mockup si des maquettes sont creees)

    ## Tests fin de round

    {copier la spec de test du plan}

    ## Compte-rendu

    <!-- COMPTE_RENDU -->

    **Date** :
    **Statut final** :

    **Livre**

    **Decisions techniques**

    **Bugs et blocages**

    **Enseignements**

    **Endpoints exposes / modifies**
    ```

17. **Mettre a jour `index.json`** : ajouter l'entree du nouveau round a la fin
    du tableau `rounds` dans `.project/rounds/index.json`.

    Si `.project/rounds/index.json` n'existe pas encore (premier round sur projet
    vierge) : verifier que le dossier `.project/rounds/` existe
    (``bash` avec `mkdir -p .project/rounds``), puis le creer avec le squelette vide
    avant d'ajouter l'entree :

    ```json
    { "version": 1, "rounds": [] }
    ```

    Entree a ajouter dans le tableau `rounds` :

    ```json
    {
      "id": "{NNN}",
      "title": "{Nom descriptif}",
      "status": "pending",
      "depends_on": [{liste des ids, entre guillemets}]
    }
    ```

18. **Mettre a jour `README.md`** : ajouter une ligne dans la table de
    `.project/rounds/README.md` en respectant le format existant
    (ex : `| {NNN} | {Nom} | pending | {depends_on} |`).

    Si `.project/rounds/README.md` n'existe pas encore (premier round sur projet
    vierge), le creer avec un en-tete minimal :

    ```markdown
    # Rounds

    | id  | titre | statut | depends_on |
    | --- | ----- | ------ | ---------- |
    ```

    Puis ajouter la premiere ligne du round.

19. Mettre a jour `.project/app.md` (nouvelles entites, regles metier, fonctionnalites, parcours)
20. Mettre a jour `.project/decisions.md` si des decisions ont ete prises pendant la discussion ou la review
21. Garder `.project/.feature-{slug}-plan.md` (sera reutilise par `/code` comme reference)

22. Afficher :

```
Le round {NNN} est pret avec {N} features :

- {F1} : {description courte}
- {F2} : {description courte}

Plan detaille : .project/.feature-{slug}-plan.md

Lance /code {NNN} pour l'implementer.
```
