Analyse si les bugs corriges pendant un round justifient la creation d'un SOP (Standard Operating Procedure) capitalisant un pattern anti-bug reutilisable dans `.project/sops/`.

Argument : numero du round (ex: /round-sop 5, /round-sop 12bis).

Prerequis : `.project/rounds/{id}/test-report.md` doit exister (cree par `/test-round`).

Cette commande est invoquee automatiquement par `/code` apres `/test-round`,
mais peut aussi etre lancee manuellement.

Sortie : eventuellement un nouveau SOP cree dans `.project/sops/{slug}.md` +
mise a jour de `.project/sops/README.md`.

---

## PHASE 1 - Lecture du rapport de test

Lire `.project/rounds/{id}/test-report.md` pour extraire :

- Nombre d'iterations passe 1 et passe 2
- Liste des bugs corriges (fichier:ligne, symptome, fix applique)

Si le fichier n'existe pas → reponse : « Pas de rapport de test, capitalisation
SOP impossible. » et sortir.

---

## PHASE 2 - Verification des declencheurs

Au moins UN declencheur doit etre vrai pour lancer l'analyse :

- La boucle de correction a pris ≥2 iterations (somme passe 1 + passe 2)
- ≥3 bugs non-triviaux ont ete corriges sur un meme domaine (upload, auth, form,
  migration, webhook, paiement, etc.)
- Un bug a necessite de lire de la doc externe ou de contourner un comportement
  inattendu d'un framework

**Si aucun declencheur** → reponse : « Pas de capitalisation necessaire
(declencheurs non remplis). » et sortir, sans creer de SOP.

---

## PHASE 3 - Analyse par sop-writer

Si au moins un declencheur est rempli :

```
Utilise l’outil `kit_agent_dispatch` avec agent="sop-writer", task="
Round {id} - {Nom} vient de se terminer apres {N} iterations de correction.

Stack active : {frontend-only | dual-stack}

Features du round :
---
{liste des features de la roadmap}
---

Bugs corriges (extraits de .project/rounds/{id}/test-report.md) :
---
{liste des bugs avec fichier:ligne, symptome, et fix applique}
---

SOPs existants dans .project/sops/ (pour eviter les doublons) :
---
{liste des ids deja presents, ou 'aucun'}
---

Analyse si ces bugs justifient un SOP selon tes criteres (non-evident,
reutilisable, piege de framework/version).

Si OUI → cree .project/sops/{slug}.md dans le format standard
  ET mets a jour .project/sops/README.md (insertion en haut de la bonne categorie).

Si NON → reponds 'Pas de capitalisation necessaire' et sors.

Reponds en francais, en 3 lignes max (id cree, categorie, ou decision de ne pas
capitaliser).
")
```

Ce processus est automatique - pas de validation utilisateur. La decision
finale est prise par l'agent sop-writer selon ses propres criteres.
