Phase 2 du brainstorming : cartographier les parcours utilisateur, inventorier les fonctionnalites, prioriser MVP / Phase 2 / Nice-to-have.

Cette commande est invoquee automatiquement par `/start` apres `/start-understand`,
mais peut aussi etre lancee manuellement pour re-cartographier les fonctionnalites
d'un projet existant.

Prerequis : `.project/app.md` doit exister avec les sections `## Probleme`,
`## Utilisateurs`, `## Contexte marche` (creees par `/start-understand`).

**REGLE MEMOIRE** : apres chaque checkpoint valide par l'utilisateur, lire
`.project/app.md` puis y ajouter IMMEDIATEMENT les informations validees.

**REGLE UI** : avant CHAQUE Edit/Write long de `.project/app.md`, appelle
d'abord `notify_writing({ file_path: ".project/app.md" })` pour afficher
l'animation plume cote UI pendant que tu rediges. Ignorer si tu n'as pas
ce tool dans ton arsenal. Cf. CLAUDE.md section « Hook `notify_writing` ».

Sortie : `.project/app.md` enrichi des sections `## Parcours utilisateur` +
`## Fonctionnalites` (MVP / Phase 2 / Nice-to-have).

→ **Hook UI Reborn** (a la 1ere ligne de cette commande, ignorer si tu n'as
pas ce tool) :
appelle
`update_substep_progress({ stepId: "01_describe", subStep: "b", status: "running", summary: "Cartographier les parcours" })`
pour faire pulser la pill « 02 Qui fait quoi ? » cote UI.

---

C'est la phase la plus importante. Elle doit etre methodique et exhaustive.
On raisonne en « qui fait quoi » → les ecrans emergent naturellement.

## Etape 2A : Parcours utilisateur

Pour CHAQUE type d'utilisateur identifie en Phase 1 :

1. « Quand [utilisateur] arrive sur l'app, que fait-il en premier ? »
2. A chaque etape, demander : « Et ensuite ? »
3. Pour chaque etape :
   - Qu'est-ce qu'il voit ? (quel ecran, quelles informations)
   - Qu'est-ce qu'il peut faire ? (quelles actions)
   - Que se passe-t-il quand il agit ? (quel resultat)
4. Continuer jusqu'a la fin du parcours

Les pages/ecrans emergent naturellement de ces parcours.

→ **CHECKPOINT Etape 2A** :
Presenter les parcours complets. « Les parcours de tes utilisateurs : [resume].
C'est complet ou il manque des cas ? »

Si oui → AJOUTER a `.project/app.md` la section :

```markdown
## Parcours utilisateur

(avec chaque type d'utilisateur et ses etapes)
```

## Etape 2B : Inventaire des fonctionnalites

Pour chaque page/ecran identifie dans les parcours :

- Quelles fonctionnalites cette page necessite ?
- Quelles interactions ? (formulaires, boutons, filtres, recherche...)
- Quelles donnees sont affichees ? D'ou viennent-elles ?
- Quelles regles s'appliquent ? (qui peut voir/modifier quoi)

Puis passer la **CHECKLIST des preoccupations transverses** (les choses qu'on
oublie toujours) :

- [ ] Authentification : inscription, connexion, mot de passe oublie, profil ?
- [ ] Roles et permissions : qui peut faire quoi ? (admin, utilisateur, moderateur)
- [ ] Recherche : globale, filtree, triee ?
- [ ] Notifications : email, in-app ?
- [ ] Paiements : quel modele ? (abonnement, ponctuel, gratuit, freemium)
- [ ] Upload : quels types de fichiers ? (images, documents)
- [ ] Administration : que gere l'admin ? Tableau de bord ? Statistiques ?
- [ ] Temps reel : messages, notifications live, mises a jour automatiques ?
- [ ] Mobile : memes fonctions ou version simplifiee ?
- [ ] Multilingue ?
- [ ] Analytics / statistiques pour l'admin ?

Pour chaque point pertinent, creuser avec l'utilisateur.
Ne pas imposer, demander : « Tu as besoin de [X] ? »

## Etape 2C : Priorisation

Classer CHAQUE fonctionnalite en 3 niveaux :

- **MVP** : indispensable pour la v1 (sans ca l'app ne sert a rien)
- **Phase 2** : important mais peut attendre le lancement
- **Nice-to-have** : si on a le temps, pas critique

Presenter sous forme de liste structuree :
« Voici toutes les fonctionnalites classees par priorite : [liste].
On a tout ? Les priorites te conviennent ? »

→ **CHECKPOINT Etapes 2B+C** :
Si valide → AJOUTER a `.project/app.md` la section :

```markdown
## Fonctionnalites

### MVP

- [ ] F1 - [Nom] : [description 1-2 lignes] (utilisateur concerne)

### Phase 2

- [ ] F12 - [Nom] : [description]

### Nice-to-have

- [ ] F18 - [Nom] : [description]
```

---

→ **CHECKPOINT FIN DE PHASE 2** :

**1. Sauvegarder TOUT le resultat de la Phase 2 dans `.project/app.md`** :

- Relire `.project/app.md` pour verifier qu'il contient bien :
  - `## Parcours utilisateur` avec un parcours complet par type
    d'utilisateur (issu de l'Etape 2A)
  - `## Fonctionnalites` avec les sous-sections `### MVP`,
    `### Phase 2`, `### Nice-to-have`, chacune listant les features
    au format `- [ ] FN - [Nom] : [description] (utilisateur concerne)`
  - Les preoccupations transverses pertinentes (auth, paiements, upload,
    admin, etc.) traitees et integrees aux fonctionnalites
- Si une section manque ou est incomplete → l'ajouter MAINTENANT avant
  de demander la transition

**2. Demander la validation de la transition** a l'utilisateur :

« Phase 2 (Cartographier) terminee - tout est sauvegarde dans
`.project/app.md` : parcours utilisateur et fonctionnalites priorisees
(MVP / Phase 2 / Nice-to-have).

On passe a la Phase 3 : structurer les donnees (entites, regles metier) et
choisir la stack technique ? »

Attendre la validation explicite de l'utilisateur. Si l'utilisateur veut
modifier des elements de la Phase 2, retraiter avant de continuer (et
re-sauvegarder dans `app.md`).

→ **Gate deterministe** :
avant de fermer la phase ou d'invoquer `/start-structure`, appelle
obligatoirement `start_validate({ phase: "map" })`. Ce gate vérifie la
présence des sections de Phase 1 (`## Probleme`, `## Utilisateurs`,
`## Contexte marche`) et de Phase 2 (`## Parcours utilisateur`,
`## Fonctionnalites`) dans `.project/app.md`. Les sous-sections `### MVP`,
`### Phase 2`, `### Nice-to-have` ne sont pas vérifiées par le gate :
c'est à toi de les relire avant la transition.

Si `ok=false` :

- NE PAS appeler `/start-structure` ;
- afficher les fichiers/sections manquants ;
- completer `.project/app.md` ;
- relancer `start_validate({ phase: "map" })`.

→ **Hook UI Reborn** (ignorer si tu n'as pas ce tool) :
uniquement quand `start_validate({ phase: "map" }).ok=true`, que `app.md` est
sauvegarde et que la transition est validee par l'utilisateur, appelle
`update_substep_progress({ stepId: "01_describe", subStep: "b", status: "done", summary: "Phase 2 terminee" })`
pour fermer la pill « 02 » (qui passe a ✓), puis invoque
`/start-structure` qui activera la pill « 03 Donnees & regles ».
