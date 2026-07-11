# /round-debrief {id}

Commande non-interactive : deduit tout depuis les sources `/code` (fichiers du projet).
Aucune question n'est posee a l'utilisateur. Toute incoherence est resolue silencieusement.

## Argument et normalisation de l'ID

`{id}` est normalise en 3 chiffres + suffixe alphanum optionnel :

- `1` -> `001`
- `12` -> `012`
- `12bis` -> `012bis`
- `001` -> `001` (deja normalise)

Toutes les references ci-dessous utilisent `{id}` sous sa forme normalisee.

---

## ETAPE 0 - prerequis

1. Calculer `{id}` normalise depuis l'argument.
2. Verifier que `.project/rounds/{id}/spec.md` existe. Si absent mais qu'un ancien artefact existe (`.project/rounds/round-{id}.md`, `.project/rounds/R{id}.md` ou `.project/.round-{id}-*.md`), lancer `/round-migrate {id}` puis relire. Si toujours absent : ARRET avec message
   ".project/rounds/{id}/spec.md introuvable. Verifie l'ID passe en argument."
3. Lire le champ `status` dans le frontmatter YAML de `.project/rounds/{id}/spec.md`.
4. Lire l'entree correspondante dans `.project/rounds/index.json` (champ `status`).
5. Si divergence entre les deux : ecraser silencieusement le statut dans `index.json`
   avec celui du frontmatter (le frontmatter fait foi). Cette synchronisation sera
   mentionnee dans le rapport final ETAPE D.

---

## ETAPE A - investigation autonome

### A1 - Lire le plan du round

Lire `.project/rounds/{id}/plan.md`.
Si absent : noter "plan absent".

### A2 - Lire le test-report

Lire `.project/rounds/{id}/test-report.md`.
Si absent : noter "test-report absent".

### A3 - Guard-fou global

Si plan ET test-report sont TOUS DEUX absents : ARRET avec message
"Ni le plan ni le test-report du round {id} ne sont detectables. Impossible de produire un debrief."

### A4 - Lire les fichiers de code modifies

Identifier les fichiers modifies/crees dans ce round (depuis le plan ou les commits
recents sur la branche). Les lire pour comprendre ce qui a ete livre.

### A5 - Inferer le statut final

Appliquer les regles dans l'ordre, s'arreter a la premiere qui s'applique :

1. Si `status` dans le frontmatter est `blocked` : statut final = `blocked`.
2. Si `.project/rounds/{id}/test-report.md` existe ET contient une ligne ou
   `VERDICT` et `PASS` apparaissent sur la meme ligne (case insensitive) :
   statut final = `done`.
   Variantes acceptees : `VERDICT: PASS`, `**Verdict** : PASS`, `## Verdict : PASS`.
   Si la ligne contient `VERDICT` + `FAIL`, ou si aucune ligne `VERDICT` n'est
   trouvee : NE PAS marquer `done`, appliquer la regle suivante.
3. Si `status` dans le frontmatter est `done` : statut final = `done`.
4. Sinon : statut final = `in-progress`.

### A6 - Synthese

A partir du plan, du test-report et des fichiers lus en A4, synthetiser :

- Ce qui a ete livre
- Les decisions techniques prises
- Les bugs et blocages rencontres
- Les enseignements
- Les endpoints exposes ou modifies (ecrire `aucun` si non applicable)

Si une source individuelle est absente, ecrire `_[non detecte - source absente]_`
dans le champ correspondant.

---

## ETAPE B - construction du compte-rendu

Construire le bloc texte suivant (pas de niveau `###`, uniquement `**...**` en gras) :

```
**Date** : YYYY-MM-DD
**Statut final** : done | in-progress | blocked

**Livre**
{synthese de ce qui a ete livre}

**Decisions techniques**
{decisions prises durant le round}

**Bugs et blocages**
{bugs rencontres, eventuellement resolus}

**Enseignements**
{ce qu'on retient pour les prochains rounds}

**Endpoints exposes / modifies**
{liste ou "aucun"}
```

---

## ETAPE C - ecritures

### C1 - Mettre a jour .project/rounds/{id}/spec.md

1. Mettre a jour le champ `status` dans le frontmatter YAML avec le statut infere en A5.
2. Localiser la ligne `<!-- COMPTE_RENDU -->` dans la section `## Compte-rendu`.
3. Remplacer cette ligne (et uniquement cette ligne) par le compte-rendu construit en ETAPE B.
   Le contenu qui suit le marqueur, s'il existe deja, est conserve en-dessous.

### Verification JSON (avant C2)

Executer :

```bash
node -e 'JSON.parse(require("fs").readFileSync(".project/rounds/index.json","utf8")); process.stdout.write("OK\n")'
```

Si le code de sortie est non-zero ou si stdout ne contient pas `OK` : ARRET avec message
"index.json est mal forme (erreur de parsing JSON). Corrige-le manuellement avant de relancer /round-debrief {id}."
Ne pas executer C2 ni C3.

### C2 - Mettre a jour index.json

1. Mettre a jour le champ `status` de l'entree `{id}` avec le statut infere en A5.
2. Mettre a jour le champ `updated_at` (date du jour, format YYYY-MM-DD).
3. Si le statut devient `done` : pour chaque round dans `index.json` dont `depends_on`
   contient `{id}` ET dont TOUTES les autres dependances listees dans `depends_on` ont
   le statut `done`, passer leur statut de `pending` a `available`.

### C3 - Mettre a jour README.md (deux operations distinctes)

Operation 1 : dans la section `## Rounds`, localiser la ligne du tableau correspondant
au round `{id}` et mettre a jour le badge de statut et la date.

Operation 2 : dans la section `## Comptes-rendus`, ajouter une entree avec :

- Le titre du round (depuis le frontmatter de `.project/rounds/{id}/spec.md`)
- La date du jour (YYYY-MM-DD)
- La premiere phrase du champ "Livre" construit en ETAPE B

---

## ETAPE D - confirmation

Afficher un rapport final contenant :

- La liste des fichiers ecrits (.project/rounds/{id}/spec.md, index.json, README.md)
- Le statut final applique
- Les sources consultees (plan, test-report, fichiers code)
- Si une synchronisation de statut a ete effectuee en ETAPE 0 : mentionner
  "Incoherence detectee et resolue : index.json synchronise sur le frontmatter
  (frontmatter={valeur}, index.json precedent={valeur})."

---

<!-- Le contenu insere au marqueur COMPTE_RENDU remplace uniquement la ligne du marqueur.
     Tout contenu existant apres le marqueur est preserve tel quel. -->
