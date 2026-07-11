# App - MyDay

## Problème

**Phrase-problème** : MyDay existe pour réunir en un seul endroit, en permanence, tout ce qui est éparpillé dans des applications différentes (agenda, mails, notes, tâches, messages, activités) et donner à tout moment une vue synthétique de ce qu'il y a à faire et de ce qui arrive, grâce à des agents IA, pour les personnes débordées par la multiplication des applis.

**Comment c'est géré aujourd'hui** : chaque type d'information vit dans sa propre application :

- Notes (liste de courses, infos importantes données par quelqu'un) → Apple Notes
- Emails → Mail
- Planning → Calendrier
- Parties de padel → Padel Club
- Questions IA → Claude
- Messages perso et pro → deux applications WhatsApp distinctes
- SMS → Messages

**Ce qui est frustrant** :

- Aucune vue d'ensemble : il faut ouvrir une dizaine d'applis pour savoir ce qu'on a à faire
- Les informations importantes se perdent entre les applis
- Pas de synthèse : personne ne dit « voilà tes priorités du moment »

**Point clé validé** : ce n'est PAS seulement un brief du matin. C'est un tableau de bord vivant, consulté en continu toute la journée, qui centralise en temps réel le planning, la to-do list et la réception des messages entrants (SMS, WhatsApp, emails...). Le brief quotidien généré par IA vient en complément de cette vue permanente.

## Utilisateurs

### Utilisateur principal (Yoann)

- **Objectif** : gérer toute sa journée depuis un seul écran — planning, to-do, notes, messages entrants, brief IA — sur ordinateur et sur mobile.
- **Niveau technique** : non technique.
- **Outils actuels** : déjà sur Gmail et Google Agenda (confirmé) — compatible avec le socle MVP.

### Utilisateurs inscrits (Manon, proches, famille, amis, collègues)

- **Objectif** : même besoin de centralisation. Chaque personne a son propre compte avec ses propres connexions (ses mails, son agenda, ses messages). Les données ne sont pas partagées entre comptes.
- **Niveau technique** : non technique.

### Administrateur (Yoann)

- **Objectif** : gérer l'application — invitations, supervision du bon fonctionnement.
- **Niveau technique** : non technique (l'interface d'admin doit rester simple).

### Mode d'accès

- **Inscription sur invitation uniquement** au démarrage : seuls l'admin et les personnes invitées peuvent créer un compte. Choix motivé par la sensibilité des données connectées (mails, messages personnels).
- Ouverture à un public élargi envisageable plus tard si le produit fait ses preuves.

## Contexte marché

### Concurrents et inspirations

Deux familles d'apps existent, mais aucune ne couvre tout le périmètre de MyDay :

**Planificateurs de journée avec IA** (planning + tâches + un peu de mails) :

- **Sunsama** (~20 $/mois) : rituel quotidien qui unifie calendriers, emails et tâches dans une timeline — inspiration validée
- **Saner.AI** : calendrier + tâches + notes + emails, plan de journée généré par IA — inspiration validée
- **Motion / Reclaim.ai** : l'IA replanifie automatiquement la journée quand quelque chose bouge — inspiration validée
- **Akiflow / Morgen** : capture des tâches depuis toutes les sources, time-blocking sur calendrier

**Messageries unifiées** :

- **Beeper** : WhatsApp, Instagram, Messenger, Telegram, Signal, SMS dans une seule boîte de réception

**Constat clé** : personne ne fait les deux à la fois. Les planificateurs ignorent WhatsApp/SMS ; Beeper ne gère ni agenda, ni tâches, ni IA. MyDay se positionne à l'intersection.

### Différenciateurs validés

1. **Tout-en-un réel** : planning + to-do + notes + mails + messages (WhatsApp, SMS) dans un seul dashboard
2. **Agents IA qui travaillent pour l'utilisateur** : brief quotidien, lecture et priorisation des mails importants, synthèse en continu
3. **Vue vivante permanente** : pas un rituel du matin, un cockpit ouvert toute la journée
4. **Sur-mesure et privé** : construit pour les usages réels de l'utilisateur (jusqu'au padel), sur invitation, données maîtrisées
5. **Assistant conversationnel intégré** : l'utilisateur parle à son agent dans l'app pour ajouter une tâche à la to-do, caler un événement dans le planning, ou rédiger/envoyer un message à sa place

### Retours growth (intégrés)

- **L'assistant conversationnel est le différenciateur le plus défendable** face à la concurrence : il doit être au cœur du produit, pas en bonus.
- **Océan bleu famille/couple** : tous les concurrents sont mono-utilisateur. Un partage sélectif (planning croisé, tâches déléguées entre Yoann et Manon) rendrait MyDay unique. → Validé comme piste V2 par l'utilisateur.
- **L'accès sur invitation** peut devenir un levier de désirabilité (modèle Superhuman/Arc) plutôt qu'une simple contrainte de sécurité.
- **Monétisation (piste future, non validée)** : 3 tiers — Découverte (gratuit), Essentiel (~19-24 $/mois, ancrage Sunsama), Cercle (~35-40 $/mois multi-comptes famille). Essai 14 jours complet préférable à un freemium rogné.
- **Risque identifié** : les intégrations WhatsApp non officielles sont structurellement fragiles (précédent Beeper coupé par Meta) — impact réputationnel disproportionné sur un produit de confiance.

### Retours produit (intégrés)

**Reformulation de la promesse** : le vrai différenciateur est la couche IA de priorisation (« le cockpit qui te dit quoi faire maintenant »), pas l'agrégation brute — agréger tous les flux côte à côte sans tri aggraverait la surcharge.

**Faisabilité des sources de données (vérifiée)** :

| Source | Faisabilité |
| --- | --- |
| Google Agenda + Gmail | ✅ API officielles OAuth, lecture + écriture |
| Calendrier/Mail iCloud | ⚠️ Fragile (CalDAV/IMAP non officiels, instables) |
| Apple Notes | ❌ Quasi infaisable proprement |
| SMS | ❌ Impossible depuis une app web |
| WhatsApp perso | ❌ Pas d'API officielle, risque de bannissement |
| Apps de niche (Padel Club) | ❌ Pas d'API — les parties se notent dans le planning MyDay |

**Périmètre MVP validé par l'utilisateur** :

- Google Agenda + Gmail (l'utilisateur est déjà sur Google — confirmé)
- To-do et notes natives MyDay (remplacent Apple Notes au lieu de s'y connecter)
- Brief IA quotidien + priorisation continue
- Assistant conversationnel intégré
- **Reportés en exploration V2** : WhatsApp, SMS, iCloud — avec contrainte technique documentée, jamais en promesse de lancement
- Ne jamais promettre du « temps réel » : les sources seront rafraîchies par synchronisation périodique

## Parcours utilisateur

### Parcours 1 — Première arrivée (utilisateur invité)

1. Réception d'un email d'invitation avec lien → création du compte (email + mot de passe)
2. Écran de bienvenue → connexion du compte Google (Agenda + Gmail) via OAuth officiel
3. Réglage des préférences : heure du brief quotidien, contenu du dashboard
4. Arrivée sur le cockpit, déjà rempli avec planning et mails synchronisés

### Parcours 2 — Usage quotidien (cœur de l'app)

1. Ouverture de MyDay (desktop ou PWA mobile) → **dashboard** : brief IA du moment, planning du jour, to-do priorisée, mails importants, notes récentes
2. Lecture du brief IA : priorités du moment, mail en attente de réponse, prochain événement
3. Cocher des tâches faites, en ajouter une à la volée
4. Clic sur un mail important → résumé IA + possibilité d'y répondre depuis MyDay
5. Ajout/édition d'une note (ex. liste de courses)
6. Ajout d'un événement au planning (ex. padel vendredi 18h) → écrit aussi dans Google Agenda

### Parcours 3 — Assistant conversationnel

1. Bouton assistant accessible partout dans l'app
2. « Ajoute le pain à ma liste de courses » → tâche/note mise à jour, confirmation visible
3. « Cale une partie de padel vendredi à 18h » → événement créé (planning + Google Agenda)
4. « Réponds à ce mail pour dire que je suis d'accord » → brouillon proposé, validation obligatoire de l'utilisateur avant envoi

### Parcours 4 — Administration (Yoann)

1. Espace admin → saisie de l'email d'un proche → envoi de l'invitation
2. Liste des comptes actifs, possibilité de désactiver un compte

### Écrans qui émergent

Connexion/inscription sur invitation, onboarding Google, dashboard, planning, to-do, notes, mails, chat assistant, réglages, espace admin.

## Fonctionnalités

Préoccupations transverses tranchées : notifications push (oui, MVP), recherche globale (oui, MVP), pièces jointes (Phase 2), gratuit au démarrage (pas de paiement), français uniquement, PWA mobile avec mêmes fonctions, synchronisation périodique (pas de temps réel promis).

### MVP

- [ ] F1 - Comptes sur invitation : inscription via lien d'invitation, connexion email/mot de passe, mot de passe oublié, profil (tous les utilisateurs)
  - Mockup : `.project/mockups/pages/login.html` + `.project/mockups/png/login.png`
- [ ] F2 - Connexion Google : lier Google Agenda + Gmail via OAuth officiel, gestion de la connexion dans les réglages (utilisateur)
  - Mockup : `.project/mockups/pages/onboarding.html` + `.project/mockups/png/onboarding.png` (connexion) et `.project/mockups/pages/reglages.html` + `.project/mockups/png/reglages.png` (gestion)
- [ ] F3 - Dashboard cockpit : vue synthétique permanente — brief IA, planning du jour, to-do priorisée, mails importants, notes récentes (utilisateur)
  - Mockup : `.project/mockups/pages/dashboard.html` + `.project/mockups/png/dashboard.png`
- [ ] F4 - Planning : vue jour/semaine, création/édition d'événements, synchronisation bidirectionnelle avec Google Agenda (utilisateur)
  - Mockup : `.project/mockups/pages/planning.html` + `.project/mockups/png/planning.png`
- [ ] F5 - To-do list : tâches natives avec priorités et échéances, cocher/ajouter/modifier en un geste (utilisateur)
  - Mockup : `.project/mockups/pages/dashboard.html` (section Tes tâches) + `.project/mockups/png/dashboard.png`
- [ ] F6 - Notes : notes rapides natives (listes de courses, infos importantes), création/édition/archivage (utilisateur)
  - Mockup : `.project/mockups/pages/notes.html` + `.project/mockups/png/notes.png`
- [ ] F7 - Mails intelligents : remontée des mails importants avec résumé IA, lecture et réponse depuis MyDay (brouillon IA + validation obligatoire avant envoi) (utilisateur)
  - Mockup : `.project/mockups/pages/mails.html` + `.project/mockups/png/mails.png`
- [ ] F8 - Brief IA : brief quotidien à heure choisie + priorisation continue « quoi faire maintenant » (utilisateur)
  - Mockup : `.project/mockups/pages/dashboard.html` (carte hero) + `.project/mockups/png/dashboard.png`
- [ ] F9 - Assistant conversationnel : chat accessible partout qui crée tâches, événements, notes et brouillons de mails sur demande (utilisateur)
  - Mockup : `.project/mockups/pages/assistant.html` + `.project/mockups/png/assistant.png` (+ barre intégrée dans la navbar de tous les écrans)
- [ ] F10 - Notifications push : mail important, rappel d'événement, brief prêt — même app fermée (utilisateur)
  - Mockup : `.project/mockups/pages/reglages.html` (réglages) + `.project/mockups/pages/onboarding.html` (étape PWA)
- [ ] F11 - Recherche globale : barre de recherche sur notes, tâches, mails, événements (utilisateur)
- [ ] F12 - PWA mobile : installable sur téléphone, responsive, mêmes fonctions qu'en desktop (tous)
  - Mockup : `.project/mockups/pages/onboarding.html` (étape installation) — tous les écrans sont responsive
- [ ] F13 - Espace admin : envoi d'invitations, liste des comptes, désactivation (admin)
  - Mockup : `.project/mockups/pages/reglages.html` (section Administration) + `.project/mockups/png/reglages.png`

### Phase 2

- [ ] F14 - Pièces jointes : photos et documents (PDF) sur notes et tâches (utilisateur)
- [ ] F15 - Partage famille/couple : planning croisé, tâches déléguées entre comptes liés (utilisateur)
- [ ] F16 - Connexion Apple iCloud : calendrier/mail Apple via CalDAV/IMAP — fragile, à explorer prudemment (utilisateur)
- [ ] F17 - Dashboard personnalisable : réorganiser les blocs selon ses préférences (utilisateur)
- [ ] F18 - Historique des briefs : relire les briefs des jours passés (utilisateur)

### Nice-to-have

- [ ] F19 - WhatsApp/SMS : exploration uniquement si une solution stable et officielle existe (utilisateur)
- [ ] F20 - Monétisation : tiers d'abonnement Découverte/Essentiel/Cercle si ouverture au public (admin)
- [ ] F21 - Commande vocale : parler à l'assistant au lieu d'écrire (utilisateur)
- [ ] F22 - Liste d'attente/parrainage : mécanique de désirabilité pour l'ouverture au public (admin)

## Entités

### Utilisateur

- Champs : email, mot de passe (géré par Better-auth), nom, photo, rôle (utilisateur/admin), préférences (heure du brief, réglages notifications, blocs du dashboard)
- Relations : possède ses tâches, notes, événements, mails, briefs, conversations, notifications, connexion Google
- Permissions : lit/modifie uniquement son propre profil ; l'admin voit les métadonnées de compte (email, statut, dernière connexion) mais JAMAIS le contenu

### Invitation

- Champs : email invité, jeton unique, date d'expiration, statut (envoyée/acceptée), invité par
- Relations : créée par l'admin ; consommée à l'inscription
- Permissions : créée/listée/révoquée par l'admin uniquement

### Connexion Google

- Champs : jetons OAuth chiffrés (accès + rafraîchissement), scopes accordés, état de la synchronisation, dernière sync
- Relations : une par utilisateur
- Permissions : l'utilisateur gère sa propre connexion (lier/délier) ; personne d'autre n'y accède

### Tâche

- Champs : titre, description, priorité, échéance, statut (à faire/faite), origine (manuelle/assistant/mail), dates de création/complétion
- Relations : appartient à un utilisateur ; peut référencer le mail d'origine
- Permissions : CRUD par son propriétaire uniquement

### Note

- Champs : titre, contenu, épinglée, archivée, origine (manuelle/assistant — ajouté pendant l'audit mockups pour le badge « via l'assistant »)
- Relations : appartient à un utilisateur
- Permissions : CRUD par son propriétaire uniquement

### Événement

- Champs : titre, début, fin, lieu, description, identifiant Google (si synchronisé), source (Google/MyDay), syncStatus (synced/sync_pending/sync_error — ajouté pendant l'audit mockups pour le badge « Non synchronisé »)
- Relations : appartient à un utilisateur ; synchronisation bidirectionnelle avec Google Agenda
- Permissions : CRUD par son propriétaire uniquement

### Mail

- Champs : identifiant Gmail, expéditeur, sujet, extrait, résumé IA, score d'importance, raisonScore (raison courte du score — ajouté pendant l'audit mockups), statut (lu/répondu), date de réception
- Relations : appartient à un utilisateur ; copie de travail — le mail source reste dans Gmail
- Permissions : lecture/réponse par son propriétaire uniquement ; jamais de suppression côté Gmail

### Brief

- Champs : contenu généré, date/heure, type (quotidien/à la demande)
- Relations : appartient à un utilisateur
- Permissions : lecture par son propriétaire uniquement

### Conversation assistant

- Champs : messages (rôle, contenu, horodatage), actions effectuées (tâche créée, événement ajouté, brouillon proposé)
- Relations : appartient à un utilisateur
- Permissions : lecture/écriture par son propriétaire uniquement

### Préférence expéditeur (ajoutée pendant l'audit mockups)

- Champs : email de l'expéditeur, statut (important/muet)
- Relations : appartient à un utilisateur ; alimentée par les boutons « Important / Pas important » ; consommée par le pré-filtre du tri des mails
- Permissions : CRUD par son propriétaire uniquement

### Brouillon de mail (ajouté pendant l'audit mockups)

- Champs : destinataire, objet, corps, statut (pending_review/approved/sent/rejected/expired), identifiant Gmail du message envoyé, mail d'origine (si réponse)
- Relations : appartient à un utilisateur ; créé par l'assistant conversationnel ; machine à états verrouillée (jamais deux envois)
- Permissions : lecture/décision par son propriétaire uniquement (validation obligatoire avant envoi)

### Notification

- Champs : type (mail important/rappel événement/brief prêt), contenu, lue, date d'envoi
- Relations : appartient à un utilisateur
- Permissions : lecture par son propriétaire uniquement

## Règles métier

- **Cloisonnement strict** : chaque utilisateur ne voit que ses propres données. L'admin ne voit que les métadonnées de compte (email, statut, dernière connexion), jamais le contenu (mails, notes, tâches).
- **Inscription sur invitation uniquement** : jeton valide, non expiré, non déjà utilisé.
- **Validation obligatoire avant envoi** : l'assistant peut préparer un mail mais ne l'envoie jamais sans confirmation explicite de l'utilisateur.
- **MyDay ne supprime jamais rien dans Gmail** : lecture et réponse uniquement.
- **Synchronisation périodique** (toutes les quelques minutes) + rafraîchissement manuel ; pas de promesse de temps réel.
- **Suppression de compte possible** : purge des données locales + révocation de l'accès Google.
- **Événements bidirectionnels** : créés dans MyDay → écrits dans Google Agenda ; modifiés dans Google → mis à jour dans MyDay à la sync suivante.

### Ajustements issus de la revue finale (4 experts, intégrés)

**Règles techniques ajoutées :**

- **Conflits de synchronisation** : « Google source de vérité » en v1 — en cas de modification simultanée, la version Google gagne. Anti-doublons obligatoire : unicité `(userId, googleId)` sur les événements, synchronisation incrémentale (syncToken/historyId), opérations idempotentes.
- **Sécurité des jetons Google** : chiffrement enveloppe AES-256-GCM, clé de chiffrement hors base de données. Cloisonnement vérifié au niveau Postgres (RLS ou helper de scoping obligatoire), pas seulement dans le code.
- **Maîtrise du coût IA** : pré-filtre heuristique gratuit avant tout appel LLM (expéditeur connu, destinataire direct, mots-clés d'action), fenêtre limitée aux mails récents à la première synchronisation, cache par `gmailId`, modèle économique pour le tri, plafond de fréquence par utilisateur.
- **Définition de « mail important »** (F7/F8) : signaux déterministes (expéditeur connu, To vs Cc, demande d'action détectée, fil déjà répondu) + score LLM + seuil configurable + boucle de feedback (boutons « important / pas important » qui affinent le tri par expéditeur).
- **Notifications iPhone** : le push web iOS ne fonctionne que si la PWA est installée sur l'écran d'accueil (iOS ≥ 16.4) → l'installation devient une étape de l'onboarding, avec fallback email pour les alertes critiques.
- **Journal d'usage dès le MVP** : table légère d'événements (`dashboard_opened`, `brief_generated`, `brief_opened`, `task_completed`, `assistant_message_sent`, `mail_replied`) + comptage des appels LLM par agent et par utilisateur (baseline de coût).
- **Premier brief immédiat** : un brief IA « à la demande » est généré automatiquement à la toute fin de l'onboarding (juste après la connexion Google), sans attendre l'heure planifiée du lendemain.

**Parcours d'échec à spécifier dans les mockups et rounds** : refus OAuth ou permissions partielles, jeton révoqué/expiré (reconnexion guidée), synchronisation en panne (indicateur de fraîcheur des données), boîte mail vide au premier login, invitation expirée, brief sans données.

**Contrainte Google OAuth (chemin critique documenté)** : les scopes Gmail sont « restreints » — en mode Testing : plafond ~100 utilisateurs, écran d'avertissement, refresh token expirant en 7 jours. Suffisant pour Yoann + Manon en développement, mais la vérification Google (CASA, 2-6 semaines) doit être lancée dès qu'une ouverture publique est décidée.

**Séquencement MVP en 3 paliers (validé)** :

- **Palier 1 — Le cockpit utile** : F1 (comptes), F2 (connexion Google), F3 (dashboard, en lecture), F4 (planning), F5 (to-do), F6 (notes) + journal d'usage
- **Palier 2 — L'IA entre en scène** : F7 (mails intelligents, lecture/tri d'abord, réponse ensuite), F8 (brief IA)
- **Palier 3 — Le différenciateur** : F9 (assistant conversationnel — actions internes d'abord, brouillons de mails ensuite), F10 (notifications push), F11 (recherche globale)
- F12 (PWA) et F13 (admin) se répartissent sur les paliers 1 et 3
- **Test de sortie du Palier 1** : « Manon s'inscrit, connecte son Google et utilise MyDay une semaine sans intervention de Yoann »

**Critère de succès avant ouverture publique (validé)** : Yoann ET Manon ouvrent le dashboard au moins 5 jours sur 7 pendant 4 semaines consécutives (mesuré par le journal d'usage).
