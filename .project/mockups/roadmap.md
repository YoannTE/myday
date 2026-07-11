# Roadmap des mockups

## Écrans à générer

- [x] dashboard - Le cockpit (page d'accueil connectée) (PILOTE)
- [x] login - Connexion + inscription sur invitation
- [x] onboarding - Connexion Google + préférences + installation PWA + premier brief
- [x] planning - Vue jour/semaine complète du calendrier
- [x] notes - Liste des notes + édition rapide
- [x] mails - Boîte des mails triés + détail avec résumé IA + réponse assistée
- [x] assistant - Chat plein écran avec validation de brouillon (HITL)
- [x] reglages - Profil, connexion Google, préférences, notifications + onglet admin (invitations, comptes)

## Direction visuelle (rappel de design.md)

- Ambiance : SaaS moderne calme et confiant — cartes blanches nettes sur fond gris-bleu clair, zéro surcharge, zéro froideur corporate
- Tokens clés : bg `#F5F7FB`, ink `#111A37`, accent `#2350E6`, soft `#EAF0FF` ; dégradé CTA `#3A6BFF→#2350E6` ; **AUCUN vert (success = accent)** ; Plus Jakarta Sans (display+body, titres extrabold tracking -0.02em) + JetBrains Mono (heures, scores, libellés uppercase .04em) ; radius 14/12/999px ; ombres douces teintées marine
- Composants validés : topbar « Barre produit » (logo M + **date du jour** + **barre assistant au centre** + bouton ☾ + avatar ; mobile = assistant en 2e ligne pleine largeur), brief « Carte hero » (compact sur mobile), notes « **Liste épinglée** » (défaut), planning « Timeline produit » (pastille pulsante « maintenant »), tâches « Checklist nette », mails « Inbox scorée », assistant « Intégré en haut + suggestions »
- Alignement : notes/planning/tâches/mails sur la même colonne max-w-4xl ; brief seul en max-w-6xl
- Mobile : `html { font-size: 13.5px }` sous 640px, sections py-6, brief fortement compacté
- Ton de la copy : tutoiement direct, toujours « journée » (jamais « matinée »), français accentué, libellés techniques en mono uppercase

## Décisions structurantes (rappel de decisions.md + agent-designs)

- **Validation obligatoire avant envoi de mail** : le chat assistant affiche une carte de brouillon avec 3 actions Approuver / Modifier / Refuser (HITL `wait_for_review`) ; brouillon expiré = message explicite « rien n'a été envoyé »
- **Boucle de feedback du tri** : chaque mail important affiche les boutons « Important / Pas important » (alimente `sender_preferences`)
- **Pas de temps réel promis** : afficher la fraîcheur (« À jour il y a X min ») ; sync périodique ~5 min + bouton de rafraîchissement manuel
- **Installation PWA = étape d'onboarding** (prérequis notifications push iOS)
- **Premier brief généré en fin d'onboarding** (effet immédiat, pas d'attente du lendemain)
- **Brief dégradé possible** (IA en panne → listes brutes, même structure) — prévoir l'état visuel discret
- **L'admin ne voit jamais le contenu** des comptes (uniquement email, statut, dernière connexion)
- **Événements** : conflit → Google gagne ; badge « non synchronisé » si la remontée vers Google a échoué
- Gratuit, français uniquement, inscription sur invitation uniquement

## Glossaire data → schéma (par écran)

### dashboard

- « Vendredi 10 juillet » → date système (fuseau utilisateur)
- Accroche + 3 priorités + alertes du brief → `brief.contenu` (JSONB : headline, priorities[], alerts[], schedule_summary...)
- « BRIEF · 07:00 » → `brief.createdAt` + `user.préférences.brief_hour`
- État dégradé du brief → `brief.degraded` (bool)
- Notes épinglées (titre, extrait, « Épinglée », « Hier ») → `note.titre`, `note.contenu` (tronqué), `note.épinglée`, `note.updatedAt`
- Badge « via l'assistant » sur une note → `note.origine` (gap tranché : champ AJOUTÉ au schéma le 2026-07-10)
- Timeline du jour (heures, titres, lieu) → `événement.début/fin/titre/lieu` (where date = aujourd'hui)
- Pastille « maintenant » → calcul (now() entre début et fin)
- « Aucun ordre du jour » → calcul (`événement.description` vide) repris dans `brief.alerts`
- Tâches (titre, statut, priorité, échéance, barrées) → `tâche.titre/statut/priorité/échéance`
- Mails importants (expéditeur, sujet, résumé IA, score) → `mail.expéditeur/sujet/résuméIA/scoreImportance/statut`
- « À jour il y a 3 min » → calcul (now() − `connexionGoogle.dernièreSync`)
- Compteur notifications (si cloche) → count(`notification` where lue=false)

### login

- Email / mot de passe / mot de passe oublié → Better-auth (`user`, flux natifs)
- Lien d'invitation (état valide/expiré/déjà utilisé) → `invitation.jeton/statut/expiration`
- « Invité par Yoann » → `invitation.invitéPar` → `user.nom`

### onboarding

- Étape connexion Google (statut, permissions demandées) → `connexionGoogle.scopes/état`
- Heure du brief → `user.préférences.brief_hour`
- Réglages notifications → `user.préférences` (JSONB)
- Étape installation PWA → statique (détection navigateur côté code)
- « Ton premier brief est prêt » → `brief` (type onboarding, généré en fin de parcours)
- Barre de progression des étapes → état local UI

### planning

- Vue jour/semaine (événements posés sur grille horaire) → `événement.début/fin/titre/lieu/source`
- Badge source (« Google » / « MyDay ») → `événement.source`
- Badge « non synchronisé » → `événement.syncStatus` (gap tranché : champ AJOUTÉ au schéma le 2026-07-10)
- Bouton « + Événement » → création → `événement` + écriture Google
- Rafraîchissement manuel + fraîcheur → `connexionGoogle.dernièreSync`

### notes

- Liste (titre, extrait, épinglée, archivée, date) → `note.titre/contenu/épinglée/archivée/updatedAt`
- Champ « + Note rapide... » → création `note`
- Édition plein texte → `note.contenu`
- Recherche dans les notes → `note.titre/contenu` (ILIKE)

### mails

- Liste triée par score (expéditeur, sujet, résumé IA, score, lu/répondu, date) → `mail.*`
- Boutons feedback « Important / Pas important » → `préférenceExpéditeur` (gap tranché : entité AJOUTÉE au schéma le 2026-07-10)
- Détail d'un mail (corps, fil) → `mail.gmailId` → lecture Gmail (extrait stocké : `mail.extrait`)
- « Répondre avec l'assistant » → crée une conversation + brouillon
- Brouillon de mail → entité `brouillonMail` (gap tranché : entité AJOUTÉE au schéma le 2026-07-10)
- Raison du score → `mail.raisonScore` (gap tranché : champ AJOUTÉ au schéma le 2026-07-10)

### assistant

- Fil de conversation (messages, horodatage) → `conversationAssistant.messages` (JSONB)
- Actions effectuées (« Tâche créée », « Événement ajouté ») → `conversationAssistant.actions`
- Carte de validation de brouillon (destinataire, objet, corps + Approuver/Modifier/Refuser) → entité `brouillonMail` (gap déjà noté)
- Suggestions d'exemples → statique
- État « en attente de ta validation » / « expiré, rien n'a été envoyé » → `brouillonMail.statut`

### reglages

- Profil (nom, email, photo) → `user.nom/email/photo`
- Connexion Google (état, dernière sync, délier, reconnecter) → `connexionGoogle.état/dernièreSync`
- Préférences brief (heure, ton) et notifications (push on/off, plafond) → `user.préférences`
- Suppression de compte → flux (purge + révocation)
- Onglet admin — invitations (email, statut, expiration, renvoyer/révoquer) → `invitation.*`
- Onglet admin — comptes (email, statut, dernière connexion, désactiver) → `user.email/statut` + `session` (dernière connexion)

## Sources

- .project/design.md (direction + tokens + composants)
- .project/app.md (parcours + fonctionnalités + entités)
- .project/decisions.md (décisions structurantes de display)
- .project/agent-designs/*.md (états UI des workflows : HITL, feedback, fraîcheur)

## État

8/8 écrans générés et validés — Phase 2 terminée, tous les gaps tranchés. Phase 3 (export PNG) à faire.
