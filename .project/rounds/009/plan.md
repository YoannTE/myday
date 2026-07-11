# Plan d'exécution — Round 009 « Notifications push et recherche »

## Contexte et décisions

- **F10 Notifications push** : web push (VAPID) pour PWA installée (iOS ≥ 16.4), branché sur les
  notifications DÉJÀ produites (mail_important R006, brief_pret R007) + nouveaux rappels d'événements.
  Réglages par type existent déjà (`user_preferences.notif_important_mail/notif_event_reminder/
  notif_brief_ready`). Plafond anti-spam. Fallback email best-effort pour les alertes critiques.
- **F11 Recherche globale** : modale de recherche (notes/tâches/mails/événements). **⌘K est pris par
  l'assistant (R008)** → décision : raccourci **⌘/ (Cmd+/) / Ctrl+/** + icône loupe dans la navbar.
  Pas de mockup dédié → style modale AEVIO (Dialog shadcn), résultats groupés inspirés de notes.html.
- **VAPID déjà généré** par le lead dans `.env.local` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`). `pywebpush` ajouté à requirements + installé.
- Schéma : `notifications` existe (type mail_important/rappel_evenement/brief_pret, unique
  (user_id, ref_id, type)). **MIGRATION** : nouvelle table `push_subscriptions`.
- RLS via `scoped_connection`. PII : pas de contenu sensible dans les logs.

## Découpage en agents

### Agent DB — `postgres-developer` [SYNCHRONE, en premier] — table push_subscriptions

- `src/lib/db/schema/systeme.ts` (ou nouveau `push.ts`) : table `push_subscriptions`
  - `userId text NOT NULL` réf user onDelete cascade
  - `endpoint text NOT NULL` **UNIQUE** (l'endpoint identifie l'abonnement navigateur)
  - `p256dh text NOT NULL`, `auth text NOT NULL` (clés de chiffrement du push)
  - `createdAt`, `updatedAt`
  - index sur userId
- `npm run db:generate` → ajouter RLS (ENABLE + POLICY user_isolation + GRANT app_rls) DANS la
  migration générée+journalisée (SOP migration RLS journalisée R005, copier `0005`). `db:migrate`.
  Vérifier en psql. Exporter le type.

### Agent BACK — `fastapi-developer` — push + notifications + rappels + recherche (opus)

Fichiers (≤150 lignes/fichier) :
- `config.py` (MODIFIÉ) : `vapid_public_key: str=""`, `vapid_private_key: str=""`,
  `vapid_subject: str="mailto:admin@admin.com"`, `push_max_per_hour: int=10`,
  `event_reminder_minutes: int=30`, `event_reminder_scheduler_enabled: bool=True`,
  `event_reminder_interval_minutes: int=5`.
- `services/push/subscriptions.py` : CRUD abonnements (upsert par endpoint via scoped_connection ;
  suppression). 
- `services/push/sender.py` : `send_web_push(sub, payload)` via `pywebpush` (claims VAPID) ; sur
  `WebPushException` 404/410 → supprimer l'abonnement mort. `notify_user(user_id, type, title, body,
  url)` : vérifie la préférence par type (`user_preferences.notif_*`) ; plafond `push_max_per_hour`
  (COUNT notifications récentes) ; envoie à tous les abonnements du user (best-effort, chaque échec
  isolé). Fallback email (best-effort) pour type critique `rappel_evenement` si AUCUN abonnement
  actif : réutilise `gmail_client.send_message` (helper R008) vers l'email du user — best-effort, non
  bloquant. PII : pas de contenu de mail/événement détaillé dans le payload push au-delà du titre.
- `services/push/notifications_bridge.py` : `create_notification_and_push(user_id, type, ref_id,
  contenu, title, url)` — INSERT notification `ON CONFLICT (user_id, ref_id, type) DO NOTHING` + si
  inséré → `notify_user`. **Wire** : mail_triage (`queue_notifications`) et daily_brief (`notify`)
  appellent ce pont au lieu d'un INSERT nu (édition ciblée de leurs sites d'insertion — garder la
  logique de plafond/préférence existante, ajouter l'envoi push).
- `services/event_reminders.py` + scheduler : tick `event_reminder_interval_minutes` ; pour chaque
  user, événements commençant dans [now+minutes-fenêtre, now+minutes+fenêtre] sans notification
  `rappel_evenement` (unique ref_id=event.id) → `create_notification_and_push`. Idempotent (unique).
  Démarré/arrêté dans le lifespan `main.py` (`max_instances=1, coalesce=True`).
- `api/push.py` : `GET /api/push/vapid-public-key` (public — mais derrière auth OK), `POST
  /api/push/subscribe` `{endpoint, keys:{p256dh, auth}}`, `DELETE /api/push/subscribe` `{endpoint}`.
- `api/notifications.py` : `GET /api/notifications?lue=false` (liste), `POST /api/notifications/read`
  `{ids?}` (marquer lues), `GET /api/notifications/unread-count`.
- `services/search.py` + `api/search.py` : `GET /api/search?q=` → recherche ILIKE scopée sur notes
  (titre/contenu), tâches (titre/description), événements (titre/lieu), mails (expediteur/sujet/
  extrait, statut triaged). Retourne `{data: {notes:[], taches:[], events:[], mails:[]}}` (max ~5/type).
- `main.py` (MODIFIÉ) : routers push/notifications/search + scheduler rappels dans le lifespan.
- Tests : subscribe/unsubscribe, notify respecte préférence + plafond, abonnement mort supprimé
  (mock pywebpush), rappel d'événement idempotent, recherche scopée RLS, bridge mail/brief pousse.

### Agent FRONT — `nextjs-developer` — abonnement push + sw.js + modale recherche (opus)

INVOQUE `frontend-design`. Mockup notifications : `reglages.html` (section notifications).
- **Push** : `src/components/reglages/notifications-push.tsx` (dans l'onglet Brief & notifications)
  — bouton « Activer les notifications sur cet appareil » : demande la permission,
  `registration.pushManager.subscribe({userVisibleOnly:true, applicationServerKey: <vapid public>})`
  (clé récupérée via `GET /api/push/vapid-public-key`), `POST /api/push/subscribe`. État : activé /
  désactivé / non supporté (iOS non installé → message « installe l'app d'abord »). Désactiver →
  `DELETE`. Les toggles par type existent déjà (ne pas dupliquer).
- `public/sw.js` (MODIFIÉ) : handlers `push` (affiche `self.registration.showNotification(title,
  {body, icon:/icons/icon-192.png, data:{url}})`) et `notificationclick` (focus/ouvre l'URL).
- **Cloche notifications** (navbar) : `src/components/layout/notifications-bell.tsx` — badge du
  nombre de non-lues (`GET /api/notifications/unread-count`), dropdown liste + marquer lues.
- **Recherche** : `src/components/search/search-modal.tsx` (Dialog shadcn) — ouvert par une icône
  loupe dans la navbar + raccourci **⌘/ / Ctrl+/** global. Champ + résultats groupés (notes/tâches/
  mails/événements) via `GET /api/search?q=` (debounce), clic → navigation vers la page concernée.
  `src/components/layout/navbar.tsx` : ajouter l'icône loupe + la cloche (propriétaire navbar).
- Types snake_case. NE TOUCHE PAS : assistant, cockpit, planning, notes, taches, backend.

## Contrat API figé (snake_case)
- `GET /api/push/vapid-public-key` → `{"data": {"public_key"}}`
- `POST /api/push/subscribe` `{endpoint, keys:{p256dh, auth}}` → `{"data": {"ok": true}}`
- `DELETE /api/push/subscribe` `{endpoint}` → `204`
- `GET /api/notifications?lue=false` → `{"data": [{id, type, contenu, ref_id, lue, date_envoi}]}`
- `POST /api/notifications/read` `{ids?}` → `{"data": {"marked": n}}` (tous si ids absent)
- `GET /api/notifications/unread-count` → `{"data": {"count": n}}`
- `GET /api/search?q=` → `{"data": {notes:[...], taches:[...], events:[...], mails:[...]}}`

## Coordination
- DB en premier. `config.py`, `main.py`, `services/push/**`, `services/event_reminders.py`,
  `services/search.py`, `api/{push,notifications,search}.py`, + édition ciblée mail_triage/daily_brief
  (bridge) → BACK. `navbar.tsx`, `sw.js`, reglages notifications, search modal, notifications bell →
  FRONT. Contrat figé.

## Tests fin de round
- DB : `\d push_subscriptions` RLS + unique endpoint.
- Backend `pytest` (mock pywebpush — JAMAIS de vrai push/email) + `ruff`. Redémarrer uvicorn ;
  endpoints 401.
- Frontend `tsc` + build. `/api/search` protégé.
- E2E : `POST /api/search?q=` renvoie des résultats groupés ; abonnement push (navigateur) si
  possible ; rappel d'événement créé pour un event à +30 min (test direct).
- Adversarial : abonnement mort (410) supprimé ; notif désactivée par préférence → pas de push ;
  plafond respecté ; recherche scopée (pas les données d'un autre user) ; ⌘/ n'entre pas en conflit
  avec ⌘K assistant.

## Corrections review intégrées (PRIORITAIRES — architect + lead-dev)

Priment sur le texte ci-dessus.

1. **pywebpush est SYNCHRONE (BLOQUANT)** : l'event loop est partagé avec 3 schedulers →
   `await anyio.to_thread.run_sync(lambda: webpush(...))`. JAMAIS d'appel `webpush` sync direct.
2. **Push HORS transaction/connexion BDD (BLOQUANT)** : INSERT notification dans `scoped_connection`,
   COMMIT (fermer la connexion), PUIS push best-effort après (pool `max_size=10` — un push réseau lent
   dans la transaction épuise le pool). Découpler strictement.
3. **Le pont est PUSH-ONLY pour mail/brief (BLOQUANT)** : `queue_notifications` (R006) et
   `persist_brief` (R007) GARDENT leur INSERT + logique de plafond/préférence existante. On ajoute
   juste, APRÈS leur commit, un appel `dispatch_push(user_id, type, title, body, url)` (best-effort,
   ne duplique NI l'INSERT NI le compteur). Seul `event_reminders` fait INSERT (nouveau) PUIS
   `dispatch_push`. `dispatch_push` : vérifie la préférence par type + plafond `push_max_per_hour`,
   envoie aux abonnements (anyio.to_thread), purge les abonnements morts (404/410) sous scoped_connection.
4. **RETIRER le fallback email Gmail** : envoyer un mail au user via Gmail crée une **boucle
   d'auto-ingestion** (le mail est resynchronisé puis re-trié) + dépend du token Google. Le fallback
   email est **différé** (hors périmètre R009). Documenter : « fallback email non implémenté (risque
   de boucle) — push uniquement ce round ». Ne PAS réutiliser `gmail_client.send_message` ici.
5. **VAPID — format de clé (IMPORTANT)** : la clé privée en base est le base64url des 32 octets bruts.
   Vérifier que `pywebpush.webpush(vapid_private_key=...)` l'accepte tel quel ; sinon construire un
   `py_vapid.Vapid01.from_raw(base64url_decode(private))` et passer l'instance. Les `vapid_claims`
   (`{"sub": settings.vapid_subject}`) sont reconstruits à chaque envoi. **Tester le format** (au
   minimum : la construction du header VAPID ne lève pas ; l'envoi réseau est mocké en test).
6. **Scheduler rappels : requêter `events`, pas les users (IMPORTANT)** : `SELECT events` commençant
   dans `[now + minutes - Δ, now + minutes + Δ]` (Δ = intervalle du tick) qui n'ont PAS encore de
   notification `rappel_evenement` (LEFT JOIN / NOT EXISTS sur notifications ref_id=event.id), via
   `get_admin_pool()` ou une requête cross-user maîtrisée, puis pour chacun INSERT+push scopé au
   `event.user_id`. Idempotent (unique (user_id, ref_id, type)). Fenêtre = intervalle du tick pour ne
   ni rater ni doubler.
7. **subscribe = upsert par endpoint** : `INSERT ... ON CONFLICT (endpoint) DO UPDATE SET user_id=$,
   p256dh=$, auth=$, updated_at=now()` (appareil partagé : le dernier abonné possède l'endpoint).
   Purge des abonnements morts via scoped_connection (RLS).
8. **Recherche : requêtes paramétrées** — `ILIKE '%' || $1 || '%'` (jamais de f-string SQL), les 4
   SELECT dans UNE seule `scoped_connection`. Bornes ~5/type.
9. **VAPID public key exposée** : la route `GET /api/push/vapid-public-key` peut rester derrière auth
   (le SW s'abonne depuis une page authentifiée) — OK.

## Risques / vigilance
1. **Push réel non testable en CI** : mocker `pywebpush` dans les tests ; le vrai envoi nécessite un
   abonnement navigateur + PWA installée. Le lead teste la souscription au mieux dans le navigateur.
2. **iOS ≥ 16.4** : web push seulement si PWA installée sur l'écran d'accueil → message clair sinon.
3. **VAPID applicationServerKey** : le front doit convertir la clé publique base64url en `Uint8Array`
   pour `subscribe()`.
4. **Fallback email best-effort** : jamais bloquant, jamais vers un tiers (uniquement l'email du user).
5. **⌘/ vs ⌘K** : raccourcis distincts (assistant garde ⌘K, recherche prend ⌘/).
6. **Bridge notifications** : ne pas casser la logique existante de plafond/préférence de R006/R007 ;
   ajouter le push, préserver l'idempotence `ON CONFLICT`.
7. Casse snake_case : contrat figé, grep.
