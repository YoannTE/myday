# /start - cadrage projet Reborn

Description initiale fournie par l'utilisateur :

```text
$ARGUMENTS
```

## Cas prioritaire - description initiale vide

Si le bloc `Description initiale` ci-dessus est vide ou ne contient que des espaces,
tu dois ouvrir la conversation toi-même.

Dans ce cas précis :

- réponds immédiatement avec un message visible dans le chat ;
- n'appelle aucun outil d'action ou d'écriture (`bash`, `read`, `write`, `edit`, `request_user_choice`, `/start-understand`, etc.) ;
- `notify_activity` est autorisé pour afficher un statut UI, mais il ne remplace jamais le message visible : si tu l'appelles, réponds ensuite en texte dans le chat ;
- ne crée PAS `.project/` et n'écris AUCUN artefact projet ;
- explique en 2-3 phrases le déroulé des 4 phases (`Comprendre`, `Cartographier`, `Structurer`, `Review & clôture`) ;
- demande ensuite à l'utilisateur de décrire son idée avec les éléments utiles : problème, public cible, objectif ;
- termine le tour après ce message et attends la réponse de l'utilisateur.

Le message doit venir du modèle, en français naturel, et ne doit pas être remplacé
par un fallback statique. Exemple de contenu attendu, à reformuler naturellement :
"On va avancer en 4 phases : d'abord comprendre ton idée, puis cartographier les
parcours et fonctionnalités, ensuite structurer les données et les règles métier,
et enfin relire le brief avec des agents reviewers. Décris-moi ton idée : quel
problème veux-tu résoudre, pour qui, et avec quel objectif ?"

Toutes les instructions suivantes ne s'appliquent que si la description initiale
est non vide et exploitable.

## Reprise après description utilisateur (cas `/start` lancé vide)

Si ce prompt a été lancé avec une description initiale vide, puis que
l'utilisateur répond en décrivant son idée, traite CE nouveau message comme la
description initiale non vide et démarre la suite de `/start`.

Dans ce cas :

1. crée `.project/` si nécessaire ;
2. garde la description de l'utilisateur comme brief initial ;
3. lance le cadrage de Phase 1 sans refaire un long questionnaire en prose ;
4. si des clarifications sont nécessaires, appelle obligatoirement
   `request_user_choice` avec `questions: [...]` pour afficher le panneau
   Reborn ;
5. ne termine jamais le tour par « Quelques questions : » suivi d'une liste en
   Markdown.

---

## Rôle général

Cette commande orchestre le brainstorming complet en 4 phases. L'utilisateur
n'est PAS technique. Il decrit ce qu'il veut en francais, et tu fais tout le
travail technique. L'utilisateur est debutant, son idee est peut-etre vague.
Aide-le a la preciser.

Eduque : utilise les termes techniques mais explique-les simplement.
« On va utiliser une base de donnees - c'est la ou on stocke les informations
de tes utilisateurs ». Prends le temps necessaire a chaque phase. Ne saute
aucune etape.

Ne termine jamais un tour utilisateur avec uniquement des appels outils : après
les éventuels résultats d'outils, envoie toujours un message visible dans le chat.

Pour toute question de cadrage, confirmation de checkpoint ou arbitrage produit,
utilise le panneau Reborn : appelle `request_user_choice` avec `questions: [...]`.
N'écris pas les questionnaires directement dans le chat, sauf pour le premier
message du cas « description initiale vide » décrit plus haut.

---

## Setup initial - seulement si la description initiale est non vide

1. Creer le dossier `.project/` (`mkdir -p .project`)
2. Garder la description initiale `$ARGUMENTS` en memoire pour la passer a la
   Phase 1

---

## REGLE MEMOIRE (s'applique a TOUTES les phases)

Apres chaque checkpoint valide par l'utilisateur, lire `.project/app.md` puis
y ajouter IMMEDIATEMENT les informations validees. Ne jamais attendre la fin
pour ecrire. Le fichier grandit phase apres phase. Si la conversation est
interrompue, rien n'est perdu.

Cette regle s'applique dans CHAQUE sous-commande de phase.

---

## Sequence des 4 phases

Pour chaque phase, invoquer la sous-commande correspondante. Chaque sous-commande
gere son dialogue, ses checkpoints, et ses ecritures dans `.project/app.md`.

### Phase 1 - Comprendre

Invoquer `/start-understand $ARGUMENTS` :

- Etape 1A : le probleme
- Etape 1B : les utilisateurs
- Etape 1C : le marche (recherche internet, concurrents, differenciateurs)
- Etape 1D : analyse positionnement par 2 agents (growth-reviewer + product-owner-reviewer)

Sortie attendue : `.project/app.md` cree avec sections `## Probleme`,
`## Utilisateurs`, `## Contexte marche`, enrichies des retours des 2 agents.

### Phase 2 - Cartographier

Invoquer `/start-map` :

- Etape 2A : parcours utilisateur (qui fait quoi, ecrans qui emergent)
- Etape 2B : inventaire des fonctionnalites + checklist transverse
- Etape 2C : priorisation MVP / Phase 2 / Nice-to-have

Sortie attendue : `.project/app.md` enrichi des sections `## Parcours utilisateur`
et `## Fonctionnalites`.

### Phase 3 - Structurer

Invoquer `/start-structure` :

- Etape 3A : modelisation des entites + regles metier + permissions
- Etape 3B : choix de la stack technique (Next.js + Postgres ou
  FastAPI + Next.js + Postgres)

Sortie attendue : `.project/app.md` enrichi des sections `## Entites` et
`## Regles metier` + `.project/decisions.md` avec la stack choisie.

### Phase 4 - Review & cloture

Invoquer `/start-finalize` :

- Etape 4A : finalisation BRIEF.md + .project/index.md (avec section `## Stack`)
- Etape 4B : review complete par l'equipe d'agents (skill `/review`)
- Etape 4C : presentation a l'utilisateur + integration des decisions
- Etape 4D : ecriture de la memoire feedback `feedback_always_test_rounds.md`
- Etape 4E : cloture, NE GENERER AUCUN CODE, indiquer les commandes suivantes
  (`/design`, `/mockup`, `/roadmap`)

Sortie attendue : `BRIEF.md` a la racine, `.project/index.md`, memoire feedback
ecrite, brief valide par les 4 agents reviewers.

---

## Regle de progression

Avancer phase par phase. Ne jamais sauter directement a une phase ulterieure
sans avoir valide les precedentes via leur checkpoint.

En plus des hooks UI Reborn existants, respecter les gates deterministes :

- avant `/start-map` : `start_validate({ phase: "understand" })` doit retourner `ok=true` ;
- avant `/start-structure` : `start_validate({ phase: "map" })` doit retourner `ok=true` ;
- avant `/start-finalize` : `start_validate({ phase: "structure" })` doit retourner `ok=true` ;
- avant de cloturer `/start` et de proposer `/design`, `/mockup` ou `/roadmap` :
  `start_validate({ phase: "finalize" })` doit retourner `ok=true`.

Si un gate retourne `ok=false`, STOPPER la transition, corriger les artefacts
`.project/` manquants, puis relancer le meme `start_validate`.

Si l'utilisateur veut revenir en arriere ou re-faire une phase, on peut
invoquer la sous-commande seule (ex: `/start-map` apres modification du scope).
