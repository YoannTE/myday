Execute un ou plusieurs rounds de la roadmap avec implementation, tests et correction automatique.

Arguments :

- Pas d'argument : round actif (partiellement complete ou premier incomplet)
- Numero(s) : /code 5 ou /code 5 6 7 ou /code 5,6,7 (gere bis/ter : /code 12bis)
- "all" : tous les rounds incomplets restants

**REGLE UI** : avant chaque Write d'un nouveau fichier de code ou Edit
important d'un `.project/*.md`, appelle d'abord
`notify_writing({ file_path: "<chemin>" })` pour afficher l'animation
plume cote UI pendant la redaction. Inutile pour des Edit courts. Cf.
CLAUDE.md section « Hook `notify_writing` ». Ignorer si tu n'as pas ce
tool.

**REGLE CMUX PROGRESSION** : si le tool `cmux_progress` est disponible,
appelle-le a chaque frontiere de phase `/code`. Le tool est no-op sauf si le
projet a ete active avec `install.sh --cmux=true` (marker
`.cmux/reborn-cmux.enabled`). Ne jamais appeler directement `cmux` pour cette
progression.

Progression a appliquer :

- Debut PHASE 1 (analyse/parsing/contexte) : `3%`, label `/code · analyse`
- Plan global valide, avant boucle rounds : `10%`, label `/code · plan validé`
- Pour N rounds, reserver `85%` aux rounds (`10% → 95%`) et `5%` au bilan final.
  Pour le round d'index `i` (1-based), calculer :
  - `base = 10 + (i - 1) * 85 / N`
  - `span = 85 / N`
  - ETAPE A `/round-plan` : `base + 0.10 * span`, label `R{id} · plan`
  - ETAPE B `/round-implement` : `base + 0.35 * span`, label `R{id} · implémentation`
  - ETAPE C `/test-round` : `base + 0.70 * span`, label `R{id} · tests QA`
  - ETAPE D `/round-sop` + `/round-debrief` : `base + 0.90 * span`, label `R{id} · debrief`
  - ETAPE E nettoyage/résumé : `base + span`, label `R{id} · clôturé`
- Bilan final : `100%`, label `/code · terminé`, status `terminé`

Arrondir les pourcentages a l'entier le plus proche. Pour chaque appel, renseigner
`status` avec le meme texte court que `label`.

---

## PHASE 1 - ANALYSE ET PLANIFICATION

Avant de commencer :

```
cmux_progress({ percent: 3, label: "/code · analyse", status: "/code analyse" })
```

Ignorer si le tool n'existe pas.

### Etape 1 : Parsing des arguments ($ARGUMENTS)

- Pas d'argument → detecter depuis `index.json` :
  - Si 1 round `available` : le proposer directement
  - Si plusieurs rounds `available` (deps satisfaites) : afficher la liste et demander lequel lancer
  - Si 0 round `available` mais des `in-progress` : proposer de reprendre le round en cours
  - Si 0 round `available` et 0 `in-progress` : afficher "Aucun round disponible. Verifie les dependances dans index.json."
- Un numero (`/code 5`) → Round 005 uniquement (normaliser : `5` -> `005`, `12bis` -> `012bis`)
- Plusieurs numeros (`/code 5 6 7` ou `/code 5,6,7`) → Rounds 005, 006, 007 sequentiellement
- `all` (`/code all`) → Tous les rounds `available` dans l'ordre de `index.json`
- Valide que les rounds existent dans `index.json` et ont le statut `available` ou `in-progress`

### Etape 2 : Collecte du contexte

- Si `.project/rounds/index.json` existe : lire `index.json` pour identifier les rounds disponibles
- Sinon, si `.project/roadmap.md` existe : afficher "Ancien format detecte (roadmap.md sans index.json). Lance `/roadmap` pour migrer vers la nouvelle structure rounds/." et arreter.
- Sinon : afficher "Aucune roadmap trouvee. Lance `/roadmap` d'abord." et arreter.
- Lire `.project/app.md`, `.project/design.md`, `.project/patterns.md`
- Pour chaque round cible : lire `.project/rounds/{id}/spec.md` pour extraire les features incompletes, la section `## Tests fin de round`, les dependances
- Si `.project/rounds/{id}/spec.md` est absent mais qu'un ancien artefact existe (`.project/rounds/round-{id}.md`, `.project/rounds/R{id}.md` ou `.project/.round-{id}-*.md`), lancer `/round-migrate {id}` puis relire les chemins canoniques.
- Les chemins legacy ci-dessus sont en LECTURE SEULE, uniquement pour la migration : ne JAMAIS y créer ou y réécrire un artefact (spec, plan, log, test-report). Tout nouvel artefact va dans `.project/rounds/{id}/`.

### Etape 2.bis : Consulter les SOPs pertinents (si existants)

But : reutiliser les patterns anti-bug deja capitalises dans ce projet pour eviter de reproduire les pieges passes.

1. Si `.project/sops/README.md` existe :
   - Le lire (index court, ~tableau de lignes)
   - Pour chaque round a executer, extraire les mots-cles depuis la roadmap (ex: "upload", "auth", "form", "migration", "webhook", "paiement")
   - Matcher ces mots-cles avec les `Tags` de l'index
   - Pour chaque match (0 a 3 par round max) → lire le SOP correspondant dans `.project/sops/{id}.md`
   - **Ecrire** le contenu fusionne des SOPs matches dans `.project/rounds/{id}/sops.md`
     (un fichier par round). Ce fichier sera lu par `/round-implement` au moment
     de lancer les agents d'implementation.
2. Si `.project/sops/` n'existe pas ou aucun match → ne rien creer (pas de fichier
   `.project/rounds/{id}/sops.md`, `/round-implement` continuera sans SOPs).

Ne jamais charger plus de 3 SOPs par round : au-dela, le contexte devient bruite.

### Etape 2.ter : Detection des fondations posees (R45)

But : decider si le Round 1 (ou le Round 000 « Fondations ») doit faire le
bootstrap `init-*` classique ou s'appuyer sur une image de fondations deja
posee.

```bash
FOUND_STATUS=$(jq -r '.status // empty' .project/.foundations.json 2>/dev/null || echo "")
FOUND_VERSION_ID=$(jq -r '.app_image_version_id // empty' .project/.foundations.json 2>/dev/null || echo "")
```

Trois cas :

1. **Round 000 « Fondations » present dans la roadmap ET pas encore complet**
   (`FOUND_STATUS` vide ou `partial`) : executer le skill `foundations-pull`
   (pull image par digest, extraction, install, services, smoke check). Le skill
   gere lui-meme son fallback `init-*` en cas d'echec. Apres reussite,
   `.foundations.json` passe `status: "complete"`.

2. **Fondations deja posees** (`FOUND_STATUS == "complete"`) : le Round 1
   **skippe le scaffolding `init-*`** (create-next-app, Better-auth, Drizzle,
   MinIO deja presents dans le scaffold extrait). Le Round 1 part directement
   des features specifiques au projet. **Ne re-scaffolder sous AUCUN pretexte**
   (cela ecraserait le scaffold de l'image).

3. **Aucune image / pas de Round 000** (`FOUND_STATUS` vide ET pas de Round 000
   dans `index.json`) : comportement historique, le Round 1 fait le bootstrap
   `init-*` classique.

**Projets existants - image perimee** : si `.foundations.json` existe en
`status: "complete"` mais que la version posee (`FOUND_VERSION_ID`) correspond
desormais a une version `deprecated` ou a une image desactivee (verifiable via
`GET /api/app-images`), **ne PAS re-puller automatiquement** : les fondations
restent celles deja posees. Signaler simplement « fondations perimees » dans le
compte-rendu du round en cours (`/round-debrief`), sans bloquer le round.

### Etape 3 : Classification de chaque round

- **Backend** : tests mentionnent `docker-compose build api`, `pytest`, `curl /health`
- **Frontend** : tests mentionnent `docker-compose build frontend`, `Chrome`, `localhost:3000`
- **Mixed** : les deux
- Fallback : backend par defaut

### Etape 4 : Validation globale

Presenter le resume des rounds a executer :

```
Plan d'execution - N round(s)

=== Round [id] - [Nom] ([N] taches) ===
=== Round [id2] - [Nom2] ([N] taches) ===

Ordre : Round id → Round id2 → ...
On lance?
```

Attendre la validation de l'utilisateur.

Apres validation utilisateur, avant la PHASE 2 :

```
cmux_progress({ percent: 10, label: "/code · plan validé", status: "/code plan validé" })
```

Ignorer si le tool n'existe pas.

---

## PHASE 2 - EXECUTION SEQUENTIELLE

Pour chaque round dans l'ordre du plan :

### ETAPE A - Plan du round (deleguee a /round-plan)

Mettre a jour `cmux_progress` avec le pourcentage calcule pour ETAPE A.

Invoquer `/round-plan {id}` : construit `.project/rounds/{id}/plan.md` et le
fait reviewer par architect-reviewer + lead-dev-reviewer (en parallele dans
une team dediee, supprimee a la fin).

Sortie attendue : fichier `.project/rounds/{id}/plan.md` valide.

### ETAPE B - Implementation (deleguee a /round-implement)

Mettre a jour `cmux_progress` avec le pourcentage calcule pour ETAPE B.

Mettre a jour le statut du round dans `index.json` a `in-progress` via Edit cible.
Mettre aussi a jour le champ `status:` dans le frontmatter de `.project/rounds/{id}/spec.md`.

#### ETAPE B INIT - Creation du log de round

Avant d'invoquer `/round-implement`, creer le fichier de log du round.
Le numero `{NNN}` est l'id du round avec padding 3 chiffres (`001`, `002`, ...) -
meme convention que les dossiers `.project/rounds/{NNN}/` et les ids dans `index.json`.

```
notify_writing({ file_path: ".project/rounds/{NNN}/log.md" })
bash({ command: "mkdir -p .project/rounds/{NNN}" })
write({
  file_path: ".project/rounds/{NNN}/log.md",
  content: "# Log - Round {NNN}\n\n## Endpoints touches\n\n(alimente par /round-implement PHASE 4 etape 3)\n\n## Fichiers touches\n\n(alimente par les agents dev via le skill output-format, append-only)\n"
})
```

Verifier la creation : ``bash` avec `ls -la .project/rounds/{NNN}/log.md``.
Si la commande echoue → arreter et alerter l'utilisateur.

Ensuite invoquer `/round-implement {id}` : lance les agents d'implementation en
parallele avec scoring de complexite (sonnet vs opus), extraction des mockups,
instructions UI obligatoires.

Lit en entree : `.project/rounds/{id}/spec.md` + `.project/rounds/{id}/sops.md`
(si cree en Etape 2.bis).

Sortie attendue : code implemente, features cochees `- [x]` dans
`.project/rounds/{id}/spec.md`, team `round-{id}` toujours active (sera
supprimee en ETAPE E).

### ETAPE C - Phase de test (deleguee a /test-round)

Mettre a jour `cmux_progress` avec le pourcentage calcule pour ETAPE C.

Invoquer `/test-round {id}` : 2 passes (happy path + adversariale FORCEE) avec
qa-tester, validation rapport, boucle de correction (max 5 iterations par
passe), affichage du parcours utilisateur a valider.

Sortie attendue : `.project/rounds/{id}/test-report.md` avec iterations, bugs
corriges, couverture adversariale, parcours utilisateur a valider.

Si `/test-round` echoue (max iterations atteint sans 0 bugs) → demander a
l'utilisateur s'il faut continuer le round suivant ou s'arreter.

### ETAPE D - Analyse de capitalisation SOP (deleguee a /round-sop) + debrief

Mettre a jour `cmux_progress` avec le pourcentage calcule pour ETAPE D.

1. Invoquer `/round-sop {id}` : lit `.project/rounds/{id}/test-report.md`, verifie
   les declencheurs (>=2 iterations, >=3 bugs sur meme domaine, ou doc externe lue),
   et si justifie lance sop-writer pour creer un nouveau SOP dans `.project/sops/`.
   Si aucun declencheur → la commande sort sans rien creer.

2. Invoquer `/round-debrief {id}` : pose les 6 questions a l'utilisateur, ecrit le
   compte-rendu dans `.project/rounds/{id}/spec.md`, met a jour `index.json` et `README.md`.

### ETAPE E - Nettoyage et resume

Mettre a jour `cmux_progress` avec le pourcentage calcule pour ETAPE E.

1. Utilise `kit_task_note` avec team="round-{id}", task="Coordination clôturée", status="done".

2. **Verification du log de round** : verifier que `.project/rounds/{NNN}/log.md`
   est bien alimente via ``bash` avec `ls -la .project/rounds/{NNN}/log.md``. Le log doit
   contenir a ce stade :
   - `## Endpoints touches` : liste des endpoints ajoutes/modifies par
     `/round-implement` (ou mention « aucun » si pas d'endpoints dans ce round)
   - `## Fichiers touches` : liste des fichiers crees/modifies par les agents
     dev via le skill `output-format`
     Si l'une des sections est encore au stade « (alimente par... ) » sans contenu
     reel, signaler a l'utilisateur que le log est incomplet - cela n'arrete pas
     le round mais bloquera `/test-round` au prochain lancement.

3. Afficher le resume du round (en lisant les iterations depuis
   `.project/rounds/{id}/test-report.md`) :

   ```
   Round [id] termine !
   - [Feature 1] : fait (description)
   - [Feature 2] : fait (description)
   Tests passe 1 (happy path) : N iterations
   Tests passe 2 (adversariale) : M iterations
   ```

4. **Note** : l'affichage du parcours utilisateur a valider a deja ete fait
   par `/test-round` a la fin de l'ETAPE C - ne pas le refaire ici. Si tu
   veux le reafficher (ex: l'utilisateur a fait defiler), pointer vers le
   rapport : « Parcours a valider : voir `.project/rounds/{id}/test-report.md` ».

---

## PHASE 3 - BILAN FINAL

Avant d'afficher le bilan final :

```
cmux_progress({ percent: 100, label: "/code · terminé", status: "terminé" })
```

Ignorer si le tool n'existe pas.

12. Resume global de tous les rounds executes :
    "Bilan - N rounds executes
    - Round [id1] : OK (N features, M iterations de test)
    - Round [id2] : OK (N features, M iterations de test)"

    Si des SOPs ont ete crees/mis a jour pendant l'execution :
    "SOPs capitalises : [liste des ids crees] - consultables dans .project/sops/"

13. Si tous les rounds de la roadmap sont termines :
    "Tous les rounds sont termines ! Le projet est fonctionnel.
    Prochaines etapes :
    - /polish - Peaufiner avant la mise en production
    - /feature - Ajouter de nouvelles fonctionnalites"
      Sinon :
      "Rounds suivants disponibles : [liste des rounds restants]
      Lance /code [id] pour continuer."
