# Plan d'exécution — Round 008 « Assistant conversationnel »

## Contexte et décisions structurantes

- **SANS Core** (SOP `agent-design-to-fastapi-service`) : l'assistant = service FastAPI. Le design
  `.project/agent-designs/assistant_conversationnel.md` = spéc fonctionnelle. Client LLM
  `mail_triage.llm.complete_json` réutilisé (dict brut → validation Pydantic + catch `Exception`).
- **CLÉ ANTHROPIC PRÉSENTE** (ce round) : contrairement à R006/R007, l'IA est active. L'assistant
  fonctionne réellement. Garder le fallback gracieux (si l'appel LLM échoue → message d'erreur
  clair, jamais de crash), mais le chemin nominal EST l'IA.
- **HITL adapté (pas de pause durable DBOS)** : `wait_for_review` → **machine à états `mail_drafts`
  + décision hors-ligne**. Le run traite le message, crée le brouillon en `pending_review` et
  REND LA MAIN (pas de pause). La validation (Approuver/Modifier/Refuser) est un appel API séparé.
  L'envoi n'a lieu QUE sur décision explicite `approve`.
- **RÈGLE MÉTIER ABSOLUE** : aucun mail n'est envoyé sans validation explicite. Garantie « au plus
  un envoi » via l'index unique `mail_drafts_sent_gmail_id_unique` + machine à états
  `pending_review → sending → sent` (transition atomique `WHERE statut='pending_review'`).
- **Gmail send à AJOUTER** : `gmail_client` n'a que la lecture → ajouter `send_message(raw)` (POST
  `/gmail/v1/users/me/messages/send`, message RFC822 base64url). Scope `gmail.send` déjà accordé (R003).
- Schéma déjà posé : `assistant_conversations`, `assistant_conversation_turns` (turn_key unique,
  role user/assistant, contenu, actions jsonb), `mail_drafts` (statuts, unique sent_gmail_id).
  **AUCUNE migration.** RLS via `scoped_connection`. PII : jamais de contenu mail/message dans les logs.

## Découpage en agents (3 agents, contrat figé)

### Agent BACK-CONV — `fastapi-developer` — moteur conversation + endpoints message (opus)

Dossier `backend/app/services/assistant/` (≤150 lignes/fichier) :
- `config.py` (MODIFIÉ) : `assistant_llm_model="claude-sonnet-4-5"`, `assistant_max_actions_per_message=3`,
  `assistant_allow_email_send=True`, `assistant_hitl_timeout_hours=24`, `assistant_reply_tone="naturel"`,
  `assistant_rate_limit_per_min=10`.
- `assistant/context.py` : `load_context(user_id, conversation_id, context_ref)` — 10 derniers tours
  (scoped), préférences, mail/événement référencé (vérifié appartenir à user_id, sinon ignoré).
- `assistant/plan.py` : `plan_actions(message, history, ref_data, ...)` via `complete_json` →
  `ActionPlanModel` Pydantic (`intent: actions|question|clarification`, `actions: [{type, action_key,
  params}]`, `clarification_question?`). Génère un `action_key` UUID par action (idempotence).
  Types d'actions : `create_task|create_note|create_event|query_data|draft_email`. Prompt système
  du design (adapté). Échec/invalide → intent `clarification` avec question générique (jamais de crash).
- `assistant/actions.py` : exécuteurs `create_task` (INSERT tasks origine='assistant', idempotent
  `assistant_action_key` unique déjà au schéma), `create_note` (INSERT/append note origine='assistant'
  via `note_appends` action_key), `query_data` (SELECT scopé lecture → résultat brut). Tous via
  `scoped_connection`, idempotents par `action_key`.
- `assistant/reply.py` : `compose_reply(plan, action_results, draft, sent, tone)` via `complete_json`
  → texte ; fallback template (« J'ai créé … ») si LLM échoue.
- `assistant/persist.py` : `persist_turn(conversation_id, user_msg, reply, actions)` — 2 rows
  (user + assistant) idempotent `(conversation_id, turn_key)`. Crée la conversation si absente.
- `assistant/orchestrator.py` : `run_assistant_message(user_id, conversation_id, message, context_ref)`
  → load → plan → (clarification → reply → persist, fin) OU boucle actions (max
  `assistant_max_actions_per_message`, dispatch ; `create_event` et `draft_email` délégués au module
  de BACK-MAIL via import) → reply → persist. Retourne `{reply, actions_done, draft, clarification_needed}`.
- `api/assistant.py` : `POST /api/assistant/message` (auth, anti-spam `assistant_rate_limit_per_min`
  → 429), `GET /api/assistant/conversations/{id}` (tours), `POST /api/assistant/conversations`
  (créer/obtenir la conversation courante). Routers.
- `main.py` (MODIFIÉ) : enregistrer `assistant_router` + `assistant_drafts_router` (créé par BACK-MAIL).
- Tests : plan (mock ou vrai LLM — utiliser mock pour déterminisme), actions (create_task/note/query,
  idempotence action_key), clarification, anti-spam 429, RLS, persist_turn idempotent.

### Agent BACK-MAIL — `fastapi-developer` — outils event/mail + envoi validé (opus)

- `gmail_client.py` (MODIFIÉ) : ajouter `async def send_message(self, raw_base64url: str) -> dict`
  (POST messages/send). Helper `build_rfc822(to, subject, body, in_reply_to?)` (MIME + base64url).
- `assistant/tools_event.py` : `create_event(user_id, params, action_key)` — RÉUTILISE le socle
  events R004 (`events_google` / INSERT events source='myday' sync_pending + push best-effort),
  idempotent par `action_key` (client_uuid dérivé). Renvoie l'événement.
- `assistant/draft.py` : `draft_email(user_id, params, ref_data)` via `complete_json` → `{to, subject,
  body}` ; INSERT `mail_drafts` statut `pending_review` (destinataire, objet, corps, mail_origine_id
  = context_ref.mail_id si réponse). Retourne le brouillon (draft_id + contenu).
- `services/assistant_drafts.py` + `api/assistant_drafts.py` : décision hors-ligne :
  - `GET /api/assistant/drafts/{id}` (détail).
  - `POST /api/assistant/drafts/{id}/decision` `{decision: "approve"|"reject", edited?: {to, subject,
    body}}` :
    - `reject` → statut `rejected`.
    - `approve` (si `settings.assistant_allow_email_send`) → **transition atomique**
      `UPDATE mail_drafts SET statut='sending' WHERE id=$ AND statut='pending_review' RETURNING *`
      (si 0 row → déjà traité, 409/idempotent) ; construire RFC822 (version éditée si fournie) ;
      obtenir un token Google valide (socle R003 `load_connection`+`read_tokens`) ; `send_message` ;
      succès → `UPDATE statut='sent', sent_gmail_id=$` ; échec → statut retour `pending_review` avec
      message d'erreur FR (l'utilisateur corrige et re-approuve = reprise sur erreur). **Jamais deux
      envois** (unique sent_gmail_id + garde `WHERE statut='pending_review'`).
  - Si `assistant_allow_email_send=False` : `approve` → 403 « envoi désactivé », brouillon conservé.
- Tests : create_event idempotent, draft_email crée pending_review, approve → send (mock gmail) →
  sent + at-most-once (double approve → 1 seul envoi), reject → rejected, edited body envoyé,
  send échoue → retour pending_review, allow_email_send=false → pas d'envoi, RLS.

### Agent FRONT-ASSIST — `nextjs-developer` — page chat F9 + navbar + reply-from-mail (opus)

INVOQUE `frontend-design`. Mockups : `assistant.html` (+ png), navbar (`shared/components/navbar.html`),
`mails.html` (bouton « Répondre avec l'assistant »).
- `src/app/assistant/page.tsx` (Server requireUser + client chat). Conversation : bulles user/assistant,
  badges d'actions (« Tâche créée », « Événement ajouté »…), **carte de validation** pour un brouillon
  (destinataire/objet/corps + Approuver / Modifier (édition inline) / Refuser + mention expiration),
  chips de suggestions. Composants `src/components/assistant/`.
  - Envoi message → `POST /api/assistant/message` → afficher reply + badges + éventuelle carte brouillon.
    Gérer 429 (anti-spam) et `clarification_needed`.
  - Décision brouillon → `POST /api/assistant/drafts/{id}/decision`. Approuver → toast « Mail envoyé ».
- **Barre assistant navbar (⌘K)** : `src/components/layout/navbar.tsx` — la barre « Dis-moi quoi
  faire… » existe déjà ; la brancher : sur Entrée / ⌘K, ouvrir `/assistant` en envoyant le message
  (query param ou state). Raccourci clavier ⌘K global.
- **« Répondre avec l'assistant »** : dans la page mails (`src/components/mails/mail-detail.tsx`),
  bouton qui ouvre `/assistant?mail_id={id}` → le chat démarre avec `context_ref.mail_id` (brouillon
  de réponse contextuel).
- Types snake_case (`src/components/assistant/types.ts`).
- NE TOUCHE PAS : cockpit, planning, notes, taches, reglages, onboarding, brief.

## Contrat API figé (snake_case)

- `POST /api/assistant/conversations` → `{"data": {conversation_id}}` (courante ou nouvelle)
- `GET /api/assistant/conversations/{id}` → `{"data": {conversation_id, turns:[{role, contenu, actions}]}}`
- `POST /api/assistant/message` `{conversation_id, message, context_ref?: {mail_id?, event_id?}}` →
  `{"data": {reply, actions_done:[{type, label, ...}], draft: {draft_id, to, subject, body}|null,
  clarification_needed}}` (429 anti-spam)
- `GET /api/assistant/drafts/{id}` → `{"data": draft}`
- `POST /api/assistant/drafts/{id}/decision` `{decision:"approve"|"reject", edited?:{to,subject,body}}`
  → `{"data": {statut, sent_gmail_id?}}` (403 si envoi désactivé, 409 si déjà traité)

## Coordination / anti-conflits
- `main.py`, `config.py`, `services/assistant/` (conv), `api/assistant.py` → BACK-CONV.
- `gmail_client.py`, `assistant/tools_event.py`, `assistant/draft.py`, `services/assistant_drafts.py`,
  `api/assistant_drafts.py` → BACK-MAIL. L'orchestrateur (BACK-CONV) importe `create_event` et
  `draft_email` de BACK-MAIL (dépendance d'import vérifiée à la convergence).
- Front sur contrat figé. `navbar.tsx` + `mail-detail.tsx` → FRONT-ASSIST uniquement.

## Tests fin de round
- Backend `pytest` (plan mocké, actions idempotentes, brouillon pending_review, approve→send
  at-most-once, reject, send échoue→pending_review, anti-spam, RLS) + `ruff`. Redémarrer uvicorn.
- Frontend `tsc` + build. Grep anti-camelCase.
- E2E réel (clé présente) : envoyer un message à l'assistant (« ajoute une tâche : appeler le
  comptable ») → tâche créée + reply ; « réponds à ce mail… » depuis un mail → brouillon en carte de
  validation → Approuver → **PAS d'envoi réel non désiré** : tester avec `assistant_allow_email_send`
  prudemment (voir Sécurité).
- Adversarial : double approve → 1 envoi ; reject → aucun envoi ; message ambigu → clarification ;
  action d'un autre user → refusée ; aucun envoi sans approve.

## Corrections review intégrées (PRIORITAIRES — architect + lead-dev)

Priment sur le texte ci-dessus. Round le plus sensible : envoi de mail = effet externe IRRÉVERSIBLE.

### Garantie « au plus un envoi » (BLOQUANT)

1. **`send_message` sans retry** (lead #1) : le helper `google/http.py` réessaie les 5xx → double
   POST send. L'envoi Gmail DOIT se faire avec `max_retries=0` (un POST send au plus).
2. **Marqueur d'idempotence Message-ID** (arch #1) : `build_rfc822` pose un header `Message-ID`
   déterministe dérivé de `draft_id` (ex. `<myday-{draft_id}@myday>`), persisté. Permet la
   réconciliation « ai-je déjà envoyé ? » (Gmail send n'a pas de clé d'idempotence native).
3. **Classifier l'échec d'envoi** (les deux) :
   - échec **pré-transmission** (connexion refusée, DNS, 4xx auth/format) → retour `pending_review`
     (rien n'est parti, correction possible + re-approve).
   - échec **AMBIGU** (timeout, 5xx, coupure APRÈS le POST) → statut **`sending_unconfirmed`**,
     JAMAIS `pending_review` (le mail est peut-être parti). Pas de renvoi automatique.
4. **Réconciliation des `sending_unconfirmed`** (arch #2) : sur `POST /decision` d'un draft
   `sending_unconfirmed` (ou approve qui le rencontre), chercher dans « Envoyés » via
   `messages.list q="rfc822msgid:<myday-{draft_id}@myday>"` : trouvé → marquer `sent`
   (JAMAIS de renvoi) ; absent → autoriser UN renvoi contrôlé (transition `sending`). C'est le seul
   mécanisme de reprise (pas de DBOS, pas de scheduler drafts).
5. **`get_message` doit récupérer `Message-ID`** (arch #1/#9) : ajouter `Message-ID` aux
   `metadataHeaders` (nécessaire pour la réconciliation ET le threading `In-Reply-To`/`References`).

### Idempotence des actions (BLOQUANT)

6. **Dédup par `turn_key` EN TÊTE de `POST /message`** (arch #3) : le endpoint calcule/reçoit un
   `turn_key` (clé d'idempotence du message, ex. hash message+conversation ou fourni par le client) ;
   AVANT tout appel LLM/action, SELECT le tour `(conversation_id, turn_key)` ; si présent → renvoyer
   le résultat stocké, court-circuiter (aucune ré-exécution). Les `action_key` sont **dérivés de
   `turn_key + index`** (stables), PAS des UUID générés par le LLM. Un double message identique →
   1 seule tâche/note/event/draft/envoi.
7. **create_event idempotence best-effort** (lead #4) : la table `events` n'a PAS d'unique sur
   action_key (aucune migration). Dédup applicative : `clientUuid` dérivé de l'action_key + SELECT
   avant INSERT. Documenter que c'est best-effort (race négligeable à 1 user en chat séquentiel).

### Sécurité / correction

8. **Token d'envoi HORS verrou sync** (les deux, arch #7) : NE PAS utiliser `load_connection` /
   `_connected_client` (ils prennent le verrou de sync Agenda → `locked`). Helper dédié « access
   token valide » : `read_tokens` + `refresh_access_token` (single-flight) sans verrou calendrier.
   `reauth_required`/`not_connected` → erreur FR claire, AUCUN envoi.
9. **Garde-fou destinataire post-LLM** (arch #4) : dans `draft_email`, ÉCRASER `draft['to']` par le
   destinataire de confiance (params du planner validés, ou `parseaddr(mail.expediteur)` du mail de
   référence). NE JAMAIS faire confiance au `to` inventé par le LLM.
10. **Validation Pydantic des `params` par type d'action** (arch #5) : `TaskParams`, `NoteParams`,
    `EventParams`, `QueryParams`, `DraftParams`. `params` validé AVANT dispatch (`model_validate` dans
    try/except ValidationError) ; action invalide → écartée proprement + signalée dans la réponse,
    jamais de crash. Whitelist de types (type inconnu → ignoré).
11. **`/decision` scopé `user_id`** (arch #6) : charger le brouillon via `scoped_connection`, enforcer
    `draft.user_id == current_user`. Sinon un user approuverait le draft d'un autre (envoyé avec SON
    token Google). Test dédié « approve draft d'un autre user → 404 ».

### Fonctionnel

12. **Expiration des brouillons** (arch #8) : pas de timer → contrôle à la lecture/approbation : si
    `pending_review` ET âge > `assistant_hitl_timeout_hours` → marquer `expired`, approve refusé
    (message « brouillon expiré »). L'UI « expiration » s'appuie là-dessus.
13. **Réponse mail** (les deux) : `to = parseaddr(mail.expediteur)` ; threading via `In-Reply-To`/
    `References` = Message-ID du mail d'origine (récupéré en #5) ; à défaut, réponse non threadée
    assumée. Après envoi réussi d'une réponse (`mail_origine_id` présent) → `UPDATE mails SET
    repondu=true` + `usage_events` type `mail_replied`.
14. **⌘K → sessionStorage, PAS query param** (lead #7) : le message libre ne passe JAMAIS dans l'URL
    (PII). Le stocker en `sessionStorage`, lu par `/assistant` au montage.
15. **Conversation « courante »** (lead #8) : `POST /conversations` crée TOUJOURS une nouvelle
    conversation (sémantique simple, pas d'ambiguïté). Le front garde l'id courant en state.
16. **Anti-spam serveur-autoritaire** : compter les tours user de la dernière minute en BDD
    (restart-safe) ; `uvicorn --workers 1`. `allow_email_send` = booléen settings (global, pas per-user, V1).

### Coordination (arch #11)
17. **Contrat d'import figé AVANT split** : signatures exactes (chemins modules + prototypes) de
    `create_event`, `draft_email` (BACK-MAIL) que l'orchestrateur (BACK-CONV) importe. `assistant/
    __init__.py` reste VIDE (aucun re-export, un seul propriétaire). Pas de cycle (draft/tools_event
    ne réimportent pas l'orchestrateur). Boot vérifié à la convergence.

## Risques / vigilance
1. **Aucun mail sans validation (ABSOLU)** : le run ne peut JAMAIS envoyer ; seul
   `/drafts/{id}/decision` avec `approve` envoie. Transition atomique `WHERE statut='pending_review'`
   + unique `sent_gmail_id` = au plus un envoi. Tester le double-approve.
2. **Envoi réel de mail = effet externe irréversible** : pour la QA, garder
   `assistant_allow_email_send` maîtrisé (le lead testera l'envoi vers une adresse de test à lui, ou
   validera le flux jusqu'à `sending` sans envoi réel non désiré). Ne jamais envoyer à un tiers en test.
3. **Google token** : réutiliser le socle R003 (`load_connection`/`read_tokens`) pour l'envoi ;
   si non connecté/`reauth_required` → erreur claire, pas d'envoi.
4. **PII** : contenu mail/message jamais dans les logs (destinataire tronqué au domaine si besoin).
5. **LLM actif** : catcher `Exception` autour des appels (SOP mis à jour R007) → message clair, pas de
   crash. Valider les sorties Pydantic (plan, draft).
6. **Idempotence** : action_key (tâches/notes/events), (conversation_id, turn_key) (tours),
   sent_gmail_id (envoi). Re-run sûr.
7. **Casse snake_case** : contrat figé, interfaces TS calquées, grep.
