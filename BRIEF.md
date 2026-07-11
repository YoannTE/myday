# BRIEF — MyDay

## Vision

MyDay est un cockpit personnel unifié : un tableau de bord vivant, consulté en continu toute la journée, qui réunit en un seul endroit le planning, la to-do list, les notes, les mails importants et un assistant IA — accessible sur ordinateur et sur mobile (PWA installable).

**Phrase-problème** : MyDay existe pour réunir en un seul endroit, en permanence, tout ce qui est éparpillé dans des applications différentes (agenda, mails, notes, tâches, messages, activités) et donner à tout moment une vue synthétique de ce qu'il y a à faire et de ce qui arrive, grâce à des agents IA, pour les personnes débordées par la multiplication des applis.

**Promesse produit** : « le cockpit qui te dit quoi faire maintenant » — la couche IA de priorisation est le cœur du produit, pas l'agrégation brute des flux.

## Utilisateurs

- **Utilisateur principal (Yoann)** : non technique, déjà sur Gmail + Google Agenda, veut gérer sa journée depuis un seul écran (desktop + mobile).
- **Utilisateurs inscrits (Manon, proches)** : même besoin ; chacun son compte, ses propres connexions, données strictement cloisonnées.
- **Administrateur (Yoann)** : gère les invitations et les comptes via une interface simple ; ne voit jamais le contenu des autres comptes.
- **Accès** : inscription sur invitation uniquement au démarrage.

## Positionnement marché

Deux familles de concurrents, aucune ne couvre tout le périmètre :

- Planificateurs IA (Sunsama ~20 $/mois, Saner.AI, Motion/Reclaim, Akiflow/Morgen) : pas de messageries.
- Messageries unifiées (Beeper) : ni planning, ni tâches, ni IA.

**Différenciateurs** :

1. Tout-en-un réel : planning + to-do + notes + mails dans un seul dashboard
2. Agents IA qui travaillent pour l'utilisateur (brief, priorisation, synthèse)
3. Vue vivante permanente (cockpit, pas rituel du matin)
4. Sur-mesure et privé : sur invitation, données maîtrisées
5. Assistant conversationnel intégré (le différenciateur le plus défendable)

## Périmètre MVP (validé après analyse de faisabilité)

**Inclus** :

- F1 - Comptes sur invitation (inscription, connexion, mot de passe oublié, profil)
- F2 - Connexion Google : Google Agenda + Gmail via OAuth officiel
- F3 - Dashboard cockpit : brief IA, planning du jour, to-do priorisée, mails importants, notes récentes
- F4 - Planning jour/semaine, synchronisation bidirectionnelle Google Agenda
- F5 - To-do list native (priorités, échéances)
- F6 - Notes natives (remplacent Apple Notes)
- F7 - Mails intelligents : résumé IA, score d'importance, réponse avec brouillon IA + validation obligatoire
- F8 - Brief IA quotidien à heure choisie + priorisation continue
- F9 - Assistant conversationnel : crée tâches, événements, notes, brouillons de mails
- F10 - Notifications push (mail important, rappel événement, brief prêt)
- F11 - Recherche globale (notes, tâches, mails, événements)
- F12 - PWA mobile responsive, mêmes fonctions qu'en desktop
- F13 - Espace admin (invitations, comptes)

**Phase 2** : pièces jointes (F14), partage famille/couple (F15), iCloud (F16), dashboard personnalisable (F17), historique des briefs (F18).

**Nice-to-have** : WhatsApp/SMS si solution stable un jour (F19), monétisation (F20), commande vocale (F21), liste d'attente/parrainage (F22).

**Exclusions assumées du MVP** : WhatsApp (pas d'API officielle, risque de bannissement), SMS (impossible depuis une app web), Apple Notes (pas d'accès propre), iCloud (connexions fragiles), Padel Club (pas d'API — les parties se notent dans le planning). Gratuit, français uniquement.

## Données (entités)

Utilisateur, Invitation, Connexion Google, Tâche, Note, Événement, Mail (copie de travail — la source reste dans Gmail), Brief, Conversation assistant, Notification. Détail complet dans `.project/app.md`.

## Règles métier clés

- Cloisonnement strict : chaque utilisateur ne voit que ses propres données ; l'admin ne voit que les métadonnées de compte.
- Inscription impossible sans invitation valide.
- Validation humaine obligatoire avant tout envoi de mail par l'assistant.
- MyDay ne supprime jamais rien dans Gmail.
- Synchronisation périodique + rafraîchissement manuel ; pas de promesse de temps réel.
- Suppression de compte : purge des données + révocation de l'accès Google.

## Stack technique

**FastAPI + Next.js + Postgres (dual-stack)** — nécessaire pour les traitements IA, les tâches de fond (synchronisation Google, brief planifié) et l'orchestration des API Google.

**Agent Platform activée** — agents prévus :

- Brief quotidien (génération planifiée + à la demande)
- Priorisation des mails (score d'importance + résumé IA)
- Assistant conversationnel (actions + HITL avant envoi de mail)
- Synchronisation Google (workflow durable de fond)

## Ajustements issus de la revue d'experts (score 68/100, intégrés)

- **Séquencement MVP en 3 paliers livrables** : Palier 1 cockpit (F1-F6 + journal d'usage), Palier 2 IA (F7-F8), Palier 3 différenciateur (F9-F11) ; F12/F13 répartis. Test de sortie Palier 1 : un proche non technique utilise MyDay une semaine en autonomie.
- **Critère de succès avant ouverture publique** : les deux premiers utilisateurs ouvrent le dashboard ≥ 5 jours/7 pendant 4 semaines consécutives.
- **Synchronisation** : Google source de vérité en cas de conflit (v1), anti-doublons, sync incrémentale, idempotence.
- **Sécurité** : jetons OAuth chiffrés (enveloppe AES-256-GCM, clé hors BDD), cloisonnement enforced au niveau Postgres.
- **IA maîtrisée** : pré-filtre heuristique avant LLM, cache, plafonds ; définition opérationnelle de « mail important » avec boucle de feedback utilisateur.
- **Notifications iOS** : installation PWA en étape d'onboarding + fallback email.
- **Effet immédiat** : premier brief IA généré dès la fin de l'onboarding.
- **Parcours d'échec spécifiés** : refus OAuth, jeton révoqué, sync en panne, boîte vide, invitation expirée, brief sans données.
- **Chemin critique documenté** : vérification Google OAuth (scopes restreints Gmail) à lancer dès toute décision d'ouverture publique.

Voir `.project/decisions.md` pour le détail des décisions et `.project/app.md` pour la mémoire complète.
