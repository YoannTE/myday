Phase 3 du brainstorming : structurer les donnees (entites + regles metier) et choisir la stack technique (Next.js + Postgres ou FastAPI + Next.js + Postgres).

Cette commande est invoquee automatiquement par `/start` apres `/start-map`,
mais peut aussi etre lancee manuellement pour re-modeliser les entites ou
re-evaluer la stack d'un projet existant.

Prerequis : `.project/app.md` doit contenir les sections de Phase 1
(`## Probleme`, `## Utilisateurs`, `## Contexte marche`) et de Phase 2
(`## Parcours utilisateur`, `## Fonctionnalites`).

**REGLE MEMOIRE** : apres chaque checkpoint valide par l'utilisateur, lire
`.project/app.md` puis y ajouter IMMEDIATEMENT les informations validees.

**REGLE UI** : avant CHAQUE Edit/Write long de `.project/app.md` ou
`.project/decisions.md`, appelle d'abord
`notify_writing({ file_path: "<chemin>" })` pour afficher l'animation
plume cote UI pendant la redaction. Ignorer si tu n'as pas ce tool. Cf.
CLAUDE.md section « Hook `notify_writing` ».

Sortie :

- `.project/app.md` enrichi des sections `## Entites` + `## Regles metier`
- `.project/decisions.md` cree avec la decision « Stack : ... »

→ **Hook UI Reborn** (a la 1ere ligne de cette commande, ignorer si tu n'as
pas ce tool) :
appelle
`update_substep_progress({ stepId: "01_describe", subStep: "c", status: "running", summary: "Structurer donnees et regles" })`
pour faire pulser la pill « 03 Donnees & regles » cote UI.

---

A partir des fonctionnalites inventoriees, identifier les « choses » que l'app
gere (les entites = les donnees principales). On pense en termes de tables et
relations.

## Etape 3A : Modelisation des entites

1. « Quels sont les elements centraux de ton app ? »
   Exemples : Utilisateur, Projet, Tache, Reservation, Produit...

2. Pour chaque entite :
   - Quelles informations sont stockees ? (les champs)
   - Quelles relations avec les autres entites ?
     « Un [X] appartient a un [Y] », « Un [X] contient plusieurs [Y] »

3. **Regles metier** - les contraintes du domaine :
   - « Un utilisateur peut-il supprimer son compte ? »
   - « Que se passe-t-il si le paiement echoue ? »
   - « Combien de [X] un utilisateur peut-il avoir ? »
   - « Qui peut voir/modifier [X] ? »

4. **Permissions** (checks d'autorisation dans le code ou RLS Postgres) :
   - Pour chaque entite, definir qui peut : lire, creer, modifier, supprimer
   - « L'admin peut tout voir, l'utilisateur ne voit que ses propres donnees »

→ **CHECKPOINT Etape 3A** :
Presenter la carte des entites et les regles.
« Les donnees de ton app : [resume]. Les regles : [liste]. C'est juste ? »

Si valide → AJOUTER a `.project/app.md` les sections :

```markdown
## Entites

### [Nom de l'entite]

- Champs : [liste]
- Relations : [description]
- Permissions : [qui peut lire/ecrire/modifier/supprimer]

## Regles metier

- [Liste des regles]
```

## Etape 3B : Choix de la stack technique

A partir de l'inventaire complet (fonctionnalites, entites, regles metier),
determiner si un backend FastAPI est necessaire ou si Next.js + Postgres suffit.

**FastAPI necessaire si AU MOINS UN de ces criteres est rempli :**

- Logique metier complexe (algorithmes, traitements multi-etapes, workflows)
- Taches de fond / workers async (Celery, queues, cron jobs)
- Traitement IA/ML (appels LLM, analyse de donnees, generation)
- Integrations API tierces complexes necessitant orchestration serveur
- Besoin de librairies Python specifiques (pandas, numpy, etc.)
- Traitement de fichiers lourd (PDF, images, etc.)

**Next.js + Postgres suffit si :**

- CRUD standard, auth classique, pages et formulaires
- Dashboards avec requetes Drizzle directes
- Webhooks simples via Next.js Route Handlers
- Uploads via MinIO/S3

Presenter la recommandation a l'utilisateur :
« Pour ton app, je recommande [Next.js + Postgres / FastAPI + Next.js + Postgres]
parce que [raison]. Ca te va ? »

L'utilisateur peut choisir differemment de la recommandation.

Enregistrer le choix dans `.project/decisions.md` (créer le fichier s'il n'existe
pas), DÈS LA FIN DE CETTE ÉTAPE 3B, sans attendre la Phase 4 :

```
Stack : [choix] - Raison : [explication]
```

Cette ligne `Stack :` est la source de vérité de la stack pour toute la suite
du projet : la Phase 4 (`/start-finalize`) la recopiera dans la section
`## Stack` de `.project/index.md`, et le gate `start_validate` vérifie sa
présence dès cette phase.

## Etape 3C : Détection automatique des agents IA (optionnel)

Si la stack choisie en 3B est **dual-stack**, scanner `.project/app.md` pour
les indices d'agents IA :

### Mots-clés à matcher

- « agent IA », « workflow IA », « automatisation IA »
- « LLM », « GPT », « Claude », « modèle de langage »
- Cas métier classiques : « prospection auto », « qualification de leads »,
  « génération de contenu auto », « support automatisé », « scoring auto »,
  « classification auto », « chatbot », « assistant IA »

### Si détecté ET dual-stack

Proposer l'activation à l'utilisateur avec les **4 bénéfices clés** :

1. **Durabilité** : reprise automatique des workflows après crash (DBOS)
2. **Observabilité** : dashboard central Reborn Agents (suivi des runs, prompts, tools)
3. **HITL** : pauses humaines natives (`wait_for_input/review/signal`)
4. **Configurabilité** : tweaks runtime sans redéploiement (`@configurable`)

Si l'utilisateur dit OUI :

- Ajouter dans `.project/decisions.md` une section `## Agent Platform` avec :
  - Liste des agents prévus (extraits du brief)
  - Note « À greffer au Round 1 via `/add-agents-platform` après provisionning du tenant »
- Indiquer que `/provision-tenant <slug> "<nom>"` est requis AVANT
  `/add-agents-platform`

Si l'utilisateur dit NON :

- Pas de section ajoutée. Mentionner « Tu peux greffer agent-platform plus tard
  via `/add-agents-platform` ».

<!-- agent-design-suggestion:start -->

### Suggestion proactive `/agent-design` (uniquement si Agent Platform activé)

Si la section `## Agent Platform` vient d'être ajoutée dans `decisions.md`,
afficher ce message à l'utilisateur avant de passer au checkpoint fin de Phase 3 :

> « Maintenant tu peux lancer `/agent-design` pour concevoir le workflow SDK-native
> d'agents IA avant `/roadmap`. Cette commande produit un document détaillé
> (steps, state, config, HITL, observabilité, recovery) qui guidera
> l'implémentation. C'est optionnel mais recommandé - sans ça,
> l'agent codera le workflow au feeling depuis la description de feature. »

Cette suggestion est **non-bloquante** : l'utilisateur peut continuer
directement vers la Phase 4 sans lancer `/agent-design`.

<!-- agent-design-suggestion:end -->

### Si détecté ET frontend-only

Alerter explicitement : « Les agents IA durables nécessitent une stack dual-stack
(FastAPI requis). 3 options :

1. Pivoter vers dual-stack maintenant (recommandé si la logique IA est centrale)
2. Garder frontend-only et utiliser des appels LLM directs sans DBOS/HITL (limité)
3. Ajourner les agents IA en V2 du projet »

---

→ **CHECKPOINT FIN DE PHASE 3** :

**1. Sauvegarder TOUT le resultat de la Phase 3** :

Dans `.project/app.md` :

- `## Entites` avec une sous-section par entite contenant : champs,
  relations, permissions
- `## Regles metier` listant les contraintes du domaine

Dans `.project/decisions.md` (creer si absent) :

- Ligne `Stack : [Next.js + Postgres | FastAPI + Next.js + Postgres] -
Raison : [explication]` (écrite à l'Étape 3B, à vérifier ici)

Si une section manque ou est incomplete → l'ajouter MAINTENANT avant
de demander la transition.

**2. Demander la validation de la transition** a l'utilisateur :

« Phase 3 (Structurer) terminee - entites et regles metier sauvegardees
dans `.project/app.md`, stack technique enregistree dans
`.project/decisions.md`.

On passe a la Phase 4 : finaliser le brief, le faire reviewer par l'equipe
d'experts et cloturer le brainstorming ? »

Attendre la validation explicite de l'utilisateur. Si l'utilisateur veut
modifier des elements de la Phase 3, retraiter avant de continuer (et
re-sauvegarder dans `app.md` / `decisions.md`).

→ **Gate deterministe** :
avant de fermer la phase ou d'invoquer `/start-finalize`, appelle
obligatoirement `start_validate({ phase: "structure" })`. Ce gate vérifie :

- les 7 sections de `.project/app.md` (Phases 1, 2 et 3 : `## Probleme`,
  `## Utilisateurs`, `## Contexte marche`, `## Parcours utilisateur`,
  `## Fonctionnalites`, `## Entites`, `## Regles metier`) ;
- l'existence de `.project/decisions.md` AVEC sa ligne `Stack : ...`.

Si `ok=false` :

- NE PAS appeler `/start-finalize` ;
- afficher les fichiers/sections manquants ;
- completer `.project/app.md` ou `.project/decisions.md` ;
- relancer `start_validate({ phase: "structure" })`.

→ **Hook UI Reborn** (ignorer si tu n'as pas ce tool) :
uniquement quand `start_validate({ phase: "structure" }).ok=true`, que
`app.md` et `decisions.md` sont sauvegardes et que la transition est validee,
appelle
`update_substep_progress({ stepId: "01_describe", subStep: "c", status: "done", summary: "Phase 3 terminee" })`
pour fermer la pill « 03 » (qui passe a ✓), puis invoque
`/start-finalize` qui activera la pill « 04 Verif ».
