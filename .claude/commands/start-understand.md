Phase 1 du brainstorming : comprendre le probleme, les utilisateurs et le marche.

Argument : description initiale de l'app (passee par `/start`).

Cette commande est invoquee automatiquement par `/start`, mais peut aussi etre
lancee manuellement pour re-analyser le positionnement d'une app existante.

L'utilisateur est debutant, son idee est peut-etre vague. Aide-le a la preciser.
Eduque : utilise les termes techniques mais explique-les simplement.
« On va utiliser une base de donnees - c'est la ou on stocke les informations
de tes utilisateurs ». Prends le temps necessaire a chaque phase.

## Mode questions UI obligatoire

Pendant cette phase, si tu dois poser des questions de cadrage, demander une
confirmation ou faire choisir une priorité, tu DOIS appeler `request_user_choice`
avec `questions: [...]` pour ouvrir le panneau Reborn.

Ne fais pas ceci : écrire « Quelques questions : » puis une liste Markdown.
Pour les questions ouvertes, propose des options plausibles, mets
`allowFreeText: true`, et ajoute « Décide pour moi » quand c'est raisonnable.
Regroupe les questions liées dans un seul appel tool.

**REGLE MEMOIRE (critique, NON-NEGOCIABLE)** : apres chaque checkpoint valide
par l'utilisateur ci-dessous, AVANT de poser la prochaine question, tu DOIS
faire dans le MEME tour de reponse, dans cet ordre exact :

1. Lire `.project/app.md` (ou le creer s'il n'existe pas encore)
2. Edit/Write `.project/app.md` pour y ecrire la section concernee

**Interdit** : passer a l'etape suivante sans avoir ecrit dans `app.md`.
**Interdit** : ecrire toutes les sections d'un coup a la fin. Le panneau de
droite affiche `app.md` en direct, l'utilisateur DOIT voir les sections
apparaitre une par une au fur et a mesure des validations.

Sortie : `.project/app.md` avec sections `## Probleme`, `## Utilisateurs`,
`## Contexte marche`, enrichies par les retours des 2 agents (growth +
product-owner).

---

## Etape 0 : Initialisation (avant la 1ere question)

Avant de poser la moindre question a l'utilisateur :

1. Si `.project/app.md` n'existe pas, le creer avec les sections vides :

   ```markdown
   # App - (nom a confirmer)

   ## Probleme

   _A definir avec l'utilisateur..._

   ## Utilisateurs

   _A definir avec l'utilisateur..._

   ## Contexte marche

   _A definir avec l'utilisateur..._
   ```

---

## Etape 1A : Le probleme

1. Reformule ce que tu comprends de l'idee, demande confirmation
2. Creuse le « pourquoi » :
   - Quel probleme cette app resout ?
   - Comment c'est gere aujourd'hui sans l'app ?
   - Qu'est-ce qui est frustrant dans la situation actuelle ?
3. Formule une phrase-probleme claire :
   « Cette app existe pour [resoudre tel probleme] pour [tel type de personnes] »
4. Confirme un nom court pour le projet (3 a 100 caracteres). Le nom peut
   etre provisoire, on pourra le changer plus tard.

→ **CHECKPOINT 1A** :
« Phrase-probleme : [phrase]. Nom du projet : [nom]. C'est bon pour toi ? »

Attendre la validation explicite de l'utilisateur.

Une fois valide, dans le MEME tour de reponse :

1. **Edit `.project/app.md`** : remplacer le placeholder de la section
   `## Probleme` par la phrase-probleme + le contexte (« comment c'est gere
   aujourd'hui », « ce qui est frustrant »). Mettre aussi a jour le titre
   `# App - [nom]` avec le nom confirme.

---

## Etape 1B : Les utilisateurs

1. Identifie les differents types d'utilisateurs :
   - Qui utilise l'app ? (visiteur, utilisateur inscrit, admin, moderateur...)
   - Pour chaque type : quel est son objectif principal ?
   - Quel est son niveau technique ?
2. Presente la liste des profils utilisateurs, demande confirmation :
   « Les utilisateurs de ton app seraient : [liste]. J'en oublie ? »

→ **CHECKPOINT 1B** : attendre la validation explicite de l'utilisateur.

Une fois valide, dans le MEME tour de reponse :

1. **Edit `.project/app.md`** : remplacer le placeholder de la section
   `## Utilisateurs` par la liste validee (un sous-titre par type
   d'utilisateur, avec son objectif principal et son niveau technique).

---

## Etape 1C : Le marche

1. Recherche sur internet : concurrents, apps similaires, tendances du secteur
2. Montre 3 a 5 exemples pertinents
3. Pour chaque exemple, demande : « Ca te plait ? Qu'est-ce qui manque ? »
4. Identifie ce qui differencie l'app de l'utilisateur :
   « Ce qui te distingue : [differenciateurs] »

→ **CHECKPOINT 1C** : attendre la validation explicite de l'utilisateur sur
les differenciateurs.

Une fois valide, dans le MEME tour de reponse :

1. **Edit `.project/app.md`** : remplacer le placeholder de la section
   `## Contexte marche` par la liste des concurrents + ce qui distingue le
   projet.

---

## Etape 1D : Analyse agents (automatique)

Une fois `app.md` rempli avec Probleme + Utilisateurs + Contexte marche, lancer
en parallele 2 agents :

1. **Agent growth-reviewer** :

   ```
   Voici la description d'un nouveau projet. Analyse le positionnement et le marche.

   DOCUMENT :
   ---
   {contenu actuel de .project/app.md}
   ---

   Produis un rapport court et actionable :
   - Opportunites de marche identifiees (max 5)
   - Risques business (max 3)
   - Differenciateurs a renforcer ou ajouter
   - Suggestions de fonctionnalites a fort potentiel viral ou de retention
   - Modeles de monetisation possibles pour ce type de produit

   Sois concret et specifique au domaine du projet. Reponds en francais.
   ```

2. **Agent product-owner-reviewer** :

   ```
   Voici la description d'un nouveau projet. Challenge le positionnement produit.

   DOCUMENT :
   ---
   {contenu actuel de .project/app.md}
   ---

   Produis un rapport court et actionable :
   - Le probleme est-il bien defini ? Manque-t-il un angle ?
   - Types d'utilisateurs oublies ou sous-estimes
   - Quel est le premier utilisateur a cibler en priorite (et pourquoi)
   - Parcours critiques a ne pas oublier lors de la Phase 2
   - Questions a poser absolument a l'utilisateur avant de continuer

   Sois concret et specifique au domaine du projet. Reponds en francais.
   ```

Presenter a l'utilisateur un resume des retours des agents :
« Avant de continuer, j'ai fait analyser ton idee par deux experts :

Cote marche et croissance :

- [resume des points cles du growth-reviewer]

Cote produit :

- [resume des points cles du product-owner-reviewer]

[Si les agents ont identifie des questions importantes]
Quelques questions supplementaires :

- [questions issues des rapports]

On integre ces retours et on continue ? »

→ **CHECKPOINT 1D** : attendre la validation de l'utilisateur sur les retours
a integrer (il peut accepter tout, une partie, ou refuser certains points).

Une fois valide, dans le MEME tour de reponse :

1. **Edit `.project/app.md`** : integrer les retours valides dans les sections
   concernees (ou en sous-sections dediees `### Retours growth` /
   `### Retours produit`).

---

→ **CHECKPOINT FIN DE PHASE 1** :

A ce stade `.project/app.md` doit contenir :

- `# App - [nom valide]`
- `## Probleme` (phrase-probleme + contexte de l'Etape 1A)
- `## Utilisateurs` (liste validee de l'Etape 1B)
- `## Contexte marche` (concurrents + differenciateurs de l'Etape 1C)
- Retours growth + product-owner (Etape 1D) intégrés DANS ces sections
  (ou en sous-sections `### Retours growth` / `### Retours produit`),
  jamais en nouvelles sections `##` séparées

Seules les 3 sections structurelles `## Probleme`, `## Utilisateurs` et
`## Contexte marche` sont vérifiées par le gate déterministe ci-dessous.
Le titre et les retours d'agents restent de ta responsabilité : vérifie-les
toi-même en relisant `app.md`.

Si une section manque ou est incomplete → l'ajouter MAINTENANT avant de
demander la transition.

Demander la validation de la transition a l'utilisateur :

« Phase 1 (Comprendre) terminee - tout est sauvegarde dans `.project/app.md` :
probleme, utilisateurs, marche, et retours des experts integres.

On passe a la Phase 2 : cartographier les parcours utilisateur et inventorier
les fonctionnalites ? »

Attendre la validation explicite de l'utilisateur. Si l'utilisateur veut
modifier des elements de la Phase 1, retraiter avant de continuer (et
re-sauvegarder dans `app.md`).

→ **Gate deterministe** :
avant de fermer la phase ou d'invoquer `/start-map`, appelle obligatoirement
`start_validate({ phase: "understand" })`. Ce gate vérifie la présence des
sections `## Probleme`, `## Utilisateurs` et `## Contexte marche` dans
`.project/app.md`.

Si `ok=false` :

- NE PAS appeler `/start-map` ;
- afficher les fichiers/sections manquants ;
- corriger `.project/app.md` si possible ;
- relancer `start_validate({ phase: "understand" })`.
