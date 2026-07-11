---
name: rls-pattern
description: Pattern RLS MyDay — role app_rls, scoped_connection, policies USING-only, default privileges auto-grant
metadata:
  type: project
---

Pattern de cloisonnement RLS des tables de contenu utilisateur (source : `drizzle/0002_enable_rls.sql`, `backend/app/db/client.py`).

- Role applicatif `app_rls` (NOSUPERUSER) fait le DML ; `app_admin` (owner, superuser) fait le DDL/migrations et **bypasse** RLS. Un 2e pool admin existe pour les tables hors-RLS (`user`, `session`, `invitations`).
- Chaque table de contenu a `user_id text NOT NULL` + policy `<table>_user_isolation` : `USING (user_id = current_setting('app.current_user_id', true))`. Pas de `WITH CHECK` explicite → il retombe sur l'expression `USING`, donc les INSERT sont bien contraints (`user_id` doit = user courant). Pas de cast `::uuid` (ids Better-auth = cuid texte).
- `current_setting(..., true)` manquant → NULL → FALSE → fail-closed (aucune ligne).
- Côté backend : `scoped_connection(user_id)` ouvre une transaction et pose `app.current_user_id` en LOCAL. TOUTE requête de contenu doit passer par là.
- **GRANT auto** : la migration 0002 fait `ALTER DEFAULT PRIVILEGES ... GRANT ... TO app_rls`. Donc toute NOUVELLE table créée ensuite par `app_admin` reçoit automatiquement les grants. Un GRANT explicite par table reste une bonne ceinture-bretelles, mais n'est pas la cause de fail-closed la plus probable.

**How to apply :** pour toute nouvelle table de contenu, exiger `user_id text NOT NULL`, ENABLE RLS + policy copiée à l'identique, et vérifier les grants en psql. Rappeler que le vrai risque d'oubli n'est pas le GRANT (couvert par default privileges) mais l'enregistrement de la migration ([[drizzle-manual-migrations]]).
