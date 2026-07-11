---
name: google-sync-round003
description: Emplacement réel des helpers Google Agenda (token, push, update) et pièges de réutilisation pour tout round qui écrit vers Google
metadata:
  type: project
---

Socle Google Agenda posé au Round 003 dans `backend/app/services/google/`.

**Obtention d'un access token valide** : PAS dans `oauth.py`.
`oauth.refresh_access_token()` renvoie un `bool`, pas un token.
Le vrai point d'entrée est `sync.load_connection(user_id)` — il pose le verrou
sync (`acquire_sync_lock`), fait le refresh single-flight, renvoie
`{status: ok|locked|reauth_required|not_connected, ...}`. Les tokens bruts se
lisent via `db.google_connection.read_tokens(user_id)`.

**Push local → Google déjà implémenté** : `sync.push_local_events()` +
`sync._push_one()`. Gèrent client_uuid déterministe, `DuplicateEvent` (409) →
réconciliation sans doublon, batch `_PUSH_BATCH=10`. Ne PAS réimplémenter un push
inline dans un handler POST : réutiliser ces fonctions.

**Retour OAuth codé en dur** : `src/app/api/google/callback/route.ts` redirige
TOUJOURS vers `/reglages?google=connected|error`. `connect/route.ts` et
`signerEtatOAuth` (`src/lib/google-oauth.ts`) ne portent AUCUN paramètre `next`.
Donc tout flux qui lance la connexion Google hors de /reglages (ex. onboarding
Round 005) est éjecté vers /reglages, pas ramené à son point d'origine. Réutiliser
le connect « tel quel » est faux dès qu'on veut revenir ailleurs : il faut modifier
connect + callback + le payload d'état signé pour threader une destination. Ces 3
fichiers sont partagés — les assigner explicitement en revue de plan.

**Pièges** :
- `push_local_events` ne sélectionne QUE `sync_status='sync_pending'`. Mettre
  `sync_error` sur échec = le scheduler ne re-tentera jamais. Laisser `sync_pending`.
- `CalendarClient` (calendar_client.py) n'a que `list_events` + `insert_event`.
  PAS d'`update_event` ni `delete_event`. Éditer un event synced ne peut PAS passer
  par insert (id déterministe → 409). Update/Delete Google = code NEUF, pas de la réutilisation.
- `apply_calendar_changes` (calendar_branch.py) : Google gagne SAUF sur rows
  `sync_pending`. La réconciliation par `client_uuid` couvre le crash push→pull.
- Verrou sync : un POST inline qui pousse pendant un run scheduler → coordonner via
  `load_connection` (renvoie `locked`) ou laisser `sync_pending` pour retry différé.
