# Décisions

## Stack

Stack : FastAPI + Next.js + Postgres - Raison : MyDay repose sur des traitements IA (brief quotidien, priorisation des mails, assistant conversationnel), des tâches de fond permanentes (synchronisation Google Agenda/Gmail toutes les quelques minutes, génération du brief à heure fixe même app fermée) et une orchestration d'API tierces (Google) — critères qui nécessitent le backend Python. Next.js sert le frontend PWA (desktop + mobile).

## Agent Platform

Activée (validée par l'utilisateur le 2026-07-09).

Agents prévus (extraits du brief) :

- **Brief quotidien** : génère le brief à l'heure choisie par l'utilisateur (planning du jour, tâches prioritaires, mails en attente) + briefs à la demande.
- **Priorisation des mails** : lit les mails entrants Gmail, calcule un score d'importance, produit un résumé IA par mail important.
- **Assistant conversationnel** : chat intégré qui crée des tâches, des événements (MyDay + Google Agenda), des notes, et prépare des brouillons de mails — avec validation humaine obligatoire (HITL) avant tout envoi.
- **Synchronisation Google** : workflow de fond qui rafraîchit périodiquement Google Agenda et Gmail (pas un agent LLM, mais un workflow durable).

À greffer au Round 1 via `/add-agents-platform` après provisionnement du tenant (`/provision-tenant <slug> "<nom>"` requis AVANT `/add-agents-platform`).

**Décision 2026-07-10 (Round 003) — SANS plateforme Core** : aucun Core Reborn
Agents n'est accessible dans cet environnement (pas d'URL, pas de master key, SDK
sur registre privé). Les 4 workflows sont implémentés en **services FastAPI
classiques** avec les MÊMES garanties fonctionnelles que les designs (sync
incrémentale, curseurs transactionnels, verrous, idempotence, machines à états,
HITL porté par notre propre table brouillonMail + UI chat). Les designs
`.project/agent-designs/*.md` restent la SPÉCIFICATION FONCTIONNELLE de référence
(steps, prompts, failure modes, tests). La greffe agent-platform (durabilité DBOS,
vue Op) reste une évolution future activable via /add-agents-platform si un Core
devient disponible — l'architecture en « steps » purs facilite cette migration.

**Designs de workflows** : le design en cours est dans `.project/agent-design.md` ; les designs validés sont archivés dans `.project/agent-designs/<workflow>.md` (mail_triage validé le 2026-07-09, design + détail des steps).

## Produit

- Inscription sur invitation uniquement au démarrage (sensibilité des données connectées).
- Périmètre MVP centré Google (Agenda + Gmail) + to-do/notes natives : WhatsApp, SMS et iCloud reportés (pas d'API officielle fiable — décision issue de l'analyse de faisabilité, validée par l'utilisateur).
- Validation humaine obligatoire avant tout envoi de mail par l'assistant.
- Gratuit au démarrage, français uniquement, PWA responsive desktop + mobile.
- Notifications push dès le MVP ; recherche globale dès le MVP ; pièces jointes en Phase 2.
- L'admin ne voit jamais le contenu des comptes (mails, notes, tâches), uniquement les métadonnées.

## Revue finale du brief (2026-07-09, 4 experts — score 68/100)

- **Séquencement MVP en 3 paliers** (validé par l'utilisateur) : Palier 1 cockpit (F1-F6 + journal d'usage), Palier 2 IA (F7-F8), Palier 3 différenciateur (F9-F11). F12/F13 répartis. Test de sortie Palier 1 : Manon autonome une semaine.
- **Critère de succès avant ouverture publique** (validé) : Yoann ET Manon ouvrent le dashboard ≥ 5 jours/7 pendant 4 semaines consécutives.
- **Conflits de sync** : Google source de vérité en v1 ; unicité `(userId, googleId)` ; sync incrémentale (syncToken/historyId) ; idempotence.
- **Jetons OAuth** : chiffrement enveloppe AES-256-GCM, clé hors BDD ; cloisonnement enforced côté Postgres (RLS/helper de scoping).
- **Coût IA** : pré-filtre heuristique avant LLM, cache par gmailId, fenêtre récente au premier sync, modèle économique pour le tri, plafond de fréquence.
- **« Mail important »** : signaux déterministes + score LLM + seuil configurable + feedback utilisateur (boutons important/pas important).
- **Push iOS** : uniquement PWA installée (iOS ≥ 16.4) → installation en étape d'onboarding + fallback email.
- **Journal d'usage dès le MVP** : événements produit + comptage des appels LLM par agent/utilisateur.
- **Premier brief généré en fin d'onboarding** (pas d'attente du lendemain).
- **Chemin critique Google OAuth** : scopes restreints Gmail — mode Testing limité (100 users, refresh token 7 jours) ; vérification CASA (2-6 semaines) à lancer dès toute décision d'ouverture publique.

## Base de données (Round 001)

- **Nommage tables/colonnes** : tables en anglais snake_case pluriel (`tasks`, `notes`, `mail_drafts`, `google_connections`...) conformément à la convention `.claude/rules/postgres.md` ; les commentaires et enums métier (statuts, origines) restent en français (`a_faire`, `pending_review`, `manuelle`...).
- **RLS et rôle applicatif** : RLS activé sur les 14 tables de contenu utilisateur (`google_connections`, `tasks`, `notes`, `note_appends`, `events`, `mails`, `sender_preferences`, `mail_drafts`, `briefs`, `assistant_conversations`, `assistant_conversation_turns`, `notifications`, `usage_events`, `llm_usage`) via policy `user_id = current_setting('app.current_user_id', true)` (comparaison texte, pas `::uuid` — les id Better-auth sont du texte/cuid). `invitations` est volontairement exclue de RLS (gérée par rôle admin applicatif, pas par cloisonnement per-utilisateur). Un rôle Postgres non-superuser `app_rls` (mot de passe dev `app_rls_password_dev`, à rotationner en prod) a été créé pour porter ces policies — **le backend FastAPI doit se connecter avec `app_rls` pour les requêtes applicatives** (pas `app_admin`, qui est superuser et contourne RLS). Coordination nécessaire avec `backend/app/db/client.py` (helper `scoped_connection(user_id)` qui pose `SET LOCAL app.current_user_id`).
- **Conversation assistant normalisée** : `assistant_conversations` (en-tête) + `assistant_conversation_turns` (détail des tours, unicité `(conversationId, turnKey)`) pour rendre chaque tour idempotent, même pattern que `assistantActionKey` sur `tasks` et `actionKey` sur `note_appends`.
- **Brief** : deux champs distincts — `briefDate` (date calendaire couverte, type `date`) et `generatedAt` (timestamptz, instant réel de génération) ; unicité partielle `(userId, briefDate) WHERE type='quotidien'` (adapté du plan qui mentionnait `type='scheduled'`, harmonisé avec les valeurs françaises `quotidien`/`a_la_demande` utilisées partout ailleurs).
- **Better-auth `role`** : ajouté via `additionalFields` (non modifiable côté client, `input: false`), avec CHECK `IN ('user','admin')` posé côté Drizzle. L'inscription publique est désactivée (`emailAndPassword.disableSignUp`) ; le seed lève ce verrou pour lui-même via la variable de process `MYDAY_SEED_CONTEXT` (import dynamique de `auth.ts` après l'avoir posée, pour éviter le hoisting ESM d'un import statique).
