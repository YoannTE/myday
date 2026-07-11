---
name: pattern-oauth-dualstack-enforcement
description: Pièges récurrents de l'implémentation OAuth source-de-données en dual-stack MyDay (RLS jetons, port callback, state)
metadata:
  type: feedback
---

Deux pièges systématiques quand un round implémente un flux OAuth tiers (Google) + sync en service FastAPI dans MyDay.

**1. Table de jetons TOUJOURS via `scoped_connection(user_id)` / rôle `app_rls`, jamais le pool admin.**
- Why: `google_connections` est listée parmi les 14 tables RLS de Round 001 (`user_id = current_setting('app.current_user_id')`). Y accéder via le pool `app_admin` (superuser) bypasse RLS et transforme le cloisonnement en simple convention `WHERE`. Un `WHERE user_id` oublié = fuite de refresh tokens Google cross-utilisateur (pire cible du projet). Voir [[pattern-securite-jetons-oauth]] et [[pattern-enforcement-cloisonnement]].
- How to apply: rejeter tout repository de jetons/curseurs qui dit « pool admin, table hors RLS ». Le scheduler de fond a le `user_id` → `SET LOCAL app.current_user_id` marche sans cookie. Aucune justification d'admin pool.

**2. Incohérence de port sur le callback OAuth en dual-stack.**
- Why: les redirect_uri Google sont enregistrés sur `:3000` (Next.js) mais les endpoints `/api/google/*` sont souvent placés côté FastAPI (`:8000`). De plus `window.location = /api/google/connect` (relatif) frappe `:3000`. Résultat: callback jamais reçu par FastAPI → OAuth cassé au premier clic.
- How to apply: exiger que le plan tranche explicitement — (a) Route Handlers Next.js qui appellent FastAPI, (b) rewrite Next `/api/google/:path*` → `:8000`, ou (c) redirect_uri `:8000` + redirection absolue.

**3. `state` anti-CSRF**: doit porter nonce+expiry ET être recroisé avec la session Better-auth au callback (state.user_id == session courante), sinon account-linking CSRF.

**4. Sans Core/DBOS**: la reprise crash repose sur curseur-transactionnel + prochain run planifié + expiration verrou (2 min), pas sur le replay DBOS — doit être documenté et testé.

**5. `tokenExpiry`**: colonne indispensable pour la logique « refresh si expiré » ; souvent absente du schéma initial.
