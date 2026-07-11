---
name: pitfalls-invitations-accounts
description: Pièges du round Comptes/Invitations MyDay (statuts ASCII, cascade user, TOCTOU jeton, désactivation/dernier-admin)
metadata:
  type: project
---

Vérifiés à la revue du Round 002 « Comptes et invitations ». À re-checker sur tout code touchant `invitations`, la suppression/désactivation de compte, ou les hooks Better-auth.

- **Statuts `invitations` = ASCII, sans accent.** La table (`src/lib/db/schema/systeme.ts`) définit `statut` avec `CHECK IN ('envoyee','acceptee')` et colonnes `jeton`/`expiration`/`invitePar` (PAS `token`/`expiresAt`/`invitedBy`). Tout plan/hook comparant `statut='envoyée'` matche 0 ligne ; toute écriture `'revoquee'`/`'révoquée'` viole le CHECK. Il manque `acceptedBy`/`acceptedAt` et un statut révoqué → migration requise avant d'implémenter renew/révocation.
- **Pas d'unicité email pending.** `invitations.email` a un index simple, non unique. « Unicité email pending » exige un `uniqueIndex partiel (email) WHERE statut='envoyee'`, sinon POST concurrents = doublons.
- **Suppression de compte = un seul `DELETE FROM "user"`.** Les 14 tables de contenu + `session` + `account` référencent `user` en `onDelete: cascade`. Une purge atomique se fait avec la connexion admin (superuser, bypass RLS) en une transaction ; le pattern « purge scoped_connection puis delete séparé » est inutilement complexe ET non atomique. Attention : `invitations.invitePar` cascade aussi → supprimer un admin efface son historique d'invitations.
- **get_current_user ne lit ni `role` ni `active`** (`backend/app/auth/session.py` : SELECT id/email/name only, AuthUser sans role). `require_admin` et le refus compte désactivé exigent d'étendre ce SELECT + le TypedDict. La colonne `user.active` n'existe pas encore → migration postgres, dépendance croisée avec fastapi.
- **TOCTOU consommation jeton.** Marquer l'invitation « acceptée » dans le hook `after` est trop tard : deux signups concurrents passent tous deux le `before` et deux comptes sont créés avant l'UPDATE. Claim atomique OBLIGATOIRE dans le `before` : `UPDATE invitations SET statut='acceptee' WHERE jeton=$1 AND statut='envoyee' AND expiration>now() RETURNING` ; 0 ligne = rejet. Le `after` ne fait que lier `acceptedBy`.
- **Dernier admin = deadlock.** Garde dernier-admin requise sur `DELETE /api/me` ET sur `PATCH accounts/{id} {active:false}` (désactiver le dernier admin verrouille l'app, cf. [[pitfalls-dualstack-bootstrap]] « pas d'admin en prod »). Check atomique (DELETE/UPDATE conditionnel comptant les admins actifs), sinon race à 0 admin.
- **Révocation de session = privilège.** Désactivation et suppression suppriment des lignes `session` (hors RLS). `app_rls` n'a probablement pas le DELETE grant → passer par connexion admin, dans la même transaction que le flip `active` pour éviter la fenêtre.

**Why:** l'utilisateur non technique ne verra aucun de ces écarts ; ils cassent en QA adversarial ou en prod.
