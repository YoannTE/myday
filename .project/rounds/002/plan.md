# Plan d'exécution — Round 002 « Comptes et invitations »

Généré le 2026-07-10, **reviewé et corrigé** (architect + lead-dev : 7 bloquants,
5 importants intégrés). SOP chargé : `audit-templates-starterkit`.

## Décisions actées par la review

- **Valeurs de statut en BDD SANS accent** (convention existante du schéma) :
  `envoyee` / `acceptee` / `revoquee`. Les messages UI restent accentués
  (« Invitation expirée »...). Tout littéral SQL/Drizzle utilise la forme ASCII.
- **Claim atomique du jeton dans le hook `before`** (pas `after`) :
  `UPDATE invitations SET statut='acceptee' WHERE jeton=$1 AND statut='envoyee'
  AND expiration > now() RETURNING *` → 0 ligne = rejet. Deux signups concurrents
  ne peuvent PAS créer deux comptes. Le `after` ne fait que lier
  `acceptedBy`/`acceptedAt`. Trade-off assumé : si la création échoue après le
  claim, le jeton est brûlé → l'admin renouvelle (documenté).
- **Bypass seed** : le hook `before` court-circuite si `MYDAY_SEED_CONTEXT="true"`
  (sinon le seed admin est rejeté → deadlock d'amorçage).
- **Sémantique BEARER du jeton (tranchée)** : le lien d'invitation est le secret ;
  l'email d'inscription peut différer de l'email invité (partage WhatsApp).
  `acceptedBy` trace la réalité. Contrepartie : refuser d'inviter un email qui a
  déjà un compte. → à documenter dans `.project/decisions.md`.
- **Suppression de compte simplifiée et atomique** : toutes les FK userId sont
  `ON DELETE CASCADE` (vérifié) → `DELETE FROM "user" WHERE id=$me` en UNE
  transaction sur la **connexion admin**, avec garde dernier-admin atomique dans
  le même statement. Pas de purge scopée préalable. ⚠ Dette tracée : au Round 003,
  rouvrir DELETE /api/me pour révoquer le jeton Google AVANT le delete.
- **Pool admin FastAPI** : un 2e pool restreint (DATABASE_URL admin) est créé,
  utilisé UNIQUEMENT par les modules admin/me (sessions, user, invitations —
  tables hors RLS dont `app_rls` n'a pas les grants d'écriture). Justification
  documentée dans le code.
- **Désactivation** : `active=false` + `DELETE FROM session WHERE user_id=$1`
  dans LA MÊME transaction (fenêtre désactivé-mais-connecté fermée). Garde
  dernier-admin-ACTIF atomique aussi sur cette route.
- **Enforcement désactivation** : la vraie garde = révocation des sessions +
  vérification `active` dans `get_current_user` (FastAPI) et hook `before`
  sign-in (Next). Le middleware = défense en profondeur (présence de cookie
  seulement) ; chaque page protégée appelle `requireUser()`.
- **Helper unique de validité** : `src/lib/invitations.ts` →
  `validateInvitationToken(jeton)` (valide/expirée/utilisée/révoquée) partagé par
  le hook ET la preview. Côté FastAPI, le statut « expiree » est DÉRIVÉ à
  l'affichage (expiration < now() ET statut='envoyee'), jamais stocké.
- **Preview publique** `/api/invitations/preview?token=` : retourne UNIQUEMENT
  `{ inviterFirstName, valid, reason?, expiresAt }` — JAMAIS l'email invité.

## Séquencement (corrigé : migration d'abord)

```
ÉTAPE 0 (postgres-developer, SÉQUENTIEL — prérequis transverse) :
  migrations + hooks Better-auth + helpers (test d'intégration HTTP réel)
ÉTAPE 1 (2 agents EN PARALLÈLE) :
  fastapi-developer → endpoints admin + compte
  nextjs-developer  → pages auth + réglages/admin
ÉTAPE 2 (lead) : vérification croisée bout en bout
```

## Contrats d'interface (FIGÉS)

- Signup client : `authClient.signUp.email({ email, password, name, invitationToken })`.
  `invitationToken` est un champ TRANSITOIRE (PAS un additionalField persisté).
  ⚠ À PROUVER EMPIRIQUEMENT en ÉTAPE 0 (SEC-1) : hook de requête
  (`hooks.before` + `createAuthMiddleware`, path `/sign-up/email`) lit
  `ctx.body.invitationToken` ; le client ne strippe pas le champ ; le rejet via
  `APIError` (import `better-auth/api`) remonte dans `error.message` côté client.
  Si l'un de ces points échoue → fallback documenté : Route Handler
  `POST /api/invitations/accept` qui claim puis appelle `auth.api.signUpEmail`
  côté serveur (avec bypass hook par contexte), même contrat d'erreurs.
- Erreurs hook (françaises) : « Invitation invalide », « Invitation expirée »,
  « Invitation déjà utilisée », « Invitation révoquée », « Compte désactivé » (sign-in).
- Colonnes invitations RÉELLES : `jeton`, `expiration`, `invitePar`,
  + NOUVELLES : `acceptedBy` (text, FK user SET NULL), `acceptedAt` (timestamptz).
- Endpoints FastAPI (Depends get_current_user ; admin via `require_admin` 403
  « Accès réservé à l'administrateur ») :
  - `GET  /api/admin/invitations` → liste + statut dérivé (envoyee/acceptee/revoquee/expiree) + `invite_url`
  - `POST /api/admin/invitations` `{email}` → 400 si email déjà inscrit OU invitation
    `envoyee` existante (l'unicité DB fait foi) ; jeton `secrets.token_urlsafe(32)`,
    expiration 7 jours → `{invitation, invite_url}`
  - `POST /api/admin/invitations/{id}/renew` → nouveau jeton + expiration, statut `envoyee`
    (autorisé depuis `envoyee` ou `revoquee` ; refusé si `acceptee`)
  - `DELETE /api/admin/invitations/{id}` → statut `revoquee` (refusé si `acceptee`)
  - `GET  /api/admin/accounts` → email, nom, role, active, dernière connexion
    (= max(session.createdAt), NULLABLE → « Jamais connecté » côté UI)
  - `PATCH /api/admin/accounts/{id}` `{active}` → flip + delete sessions (même
    transaction) ; garde dernier-admin-actif atomique ; 400 « Impossible de
    désactiver le dernier administrateur actif »
  - `DELETE /api/me` → delete user cascade (transaction admin) + garde
    dernier-admin atomique ; 400 « Impossible de supprimer le dernier administrateur »
- Invitation URL : `{APP_URL}/sign-up?invitation={jeton}` (APP_URL en config backend).

## ÉTAPE 0 — postgres-developer (sonnet)

Lire : ce plan, `.project/rounds/002/sops.md`, `src/lib/auth.ts`, `src/lib/session.ts`,
`src/lib/db/schema/{systeme,auth}.ts`, `.claude/rules/better-auth.md`, `src/lib/db/seed.ts`.

1. **Migration** (db:generate + custom si besoin) :
   - `user.active` boolean NOT NULL default true — via `additionalFields` Better-auth
     avec **`input: false`** (comme `role`)
   - `invitations.acceptedBy` (text, FK user **ON DELETE SET NULL** — l'historique
     d'invitations survit à la suppression d'un compte) + `acceptedAt` (timestamptz)
   - CHECK invitations étendu : `('envoyee','acceptee','revoquee')`
   - Index UNIQUE PARTIEL `invitations(email) WHERE statut='envoyee'` (anti-doublon
     concurrent au niveau DB)
   - Vérifier/étendre : les policies RLS du Round 001 couvrent bien `FOR ALL`
     (sinon les DELETE scopés échoueraient en silence) — corriger si besoin
2. `src/lib/invitations.ts` : `validateInvitationToken(jeton)` (retourne
   {valid, reason: 'invalide'|'expiree'|'utilisee'|'revoquee', invitation?}) — consommé
   par le hook et la preview.
3. `src/lib/auth.ts` : retirer `disableSignUp` ; hooks :
   - `before /sign-up/email` : bypass si MYDAY_SEED_CONTEXT ; sinon claim atomique
     (UPDATE conditionnel RETURNING via Drizzle) ; rejet APIError messages français
   - `after /sign-up/email` : UPDATE acceptedBy/acceptedAt (idempotent)
   - `before /sign-in/email` : SELECT active → rejet « Compte désactivé »
4. Reset password : `sendResetPassword` → log serveur « [DEV] Lien de
   réinitialisation pour {email} : {url} ».
5. `src/lib/session.ts` : `requireAdmin()` (requireUser + role admin sinon redirect `/`).
6. **Test d'intégration HTTP RÉEL (bloquant)** : serveur dev lancé →
   (a) signup sans jeton → erreur française ; (b) invitation en BDD → signup avec
   jeton → compte créé + invitation acceptee + acceptedBy ; (c) re-signup même
   jeton → « Invitation déjà utilisée » ; (d) seed 2× → toujours idempotent ;
   (e) user active=false → sign-in refusé. Documenter le format exact des hooks
   découvert (pour patterns.md). Si le passage de `invitationToken` échoue →
   implémenter le fallback Route Handler du contrat et le documenter.

## ÉTAPE 1a — fastapi-developer (sonnet)

Lire : ce plan, `.project/rounds/002/sops.md`, `backend/app/` (patterns R001),
`.project/patterns.md`, la migration livrée en ÉTAPE 0.

1. `backend/app/db/client.py` : 2e pool `admin_pool` (DATABASE_URL) — docstring de
   justification, usage restreint aux modules admin/me.
2. `backend/app/auth/session.py` : étendre le SELECT de `get_current_user` à
   `role`, `active` (+ TypedDict) ; refus 401 si `active=false` ; dependency
   `require_admin`.
3. `backend/app/api/admin.py` + `services/admin.py` + `models/admin.py` :
   les 6 endpoints admin du contrat (gardes atomiques en SQL : UPDATE/DELETE
   conditionnels avec sous-requête de comptage des admins actifs).
4. `backend/app/api/me.py` : `DELETE /api/me` (transaction admin, cascade, garde).
5. Tests pytest : 403 non-admin ; création (+ 400 email déjà inscrit, 400 doublon
   pending — via l'index unique) ; renew/révocation (+ refus si acceptee) ;
   désactivation → sessions supprimées mêmes transaction + garde dernier-admin ;
   DELETE /api/me → cascade vérifiée (contenu disparu) + garde ; statut dérivé
   « expiree ». `ruff` vert.
6. Log : endpoints dans `## Endpoints touches`.

## ÉTAPE 1b — nextjs-developer (sonnet)

Lire : ce plan, `.project/rounds/002/sops.md` (checklist templates OBLIGATOIRE),
`.project/design.md`, `.project/patterns.md`, mockups `login.html`+png,
`reglages.html`+png, `src/lib/api.ts`, helper `src/lib/invitations.ts` (ÉTAPE 0).

1. Refonte `/sign-in` + `/sign-up` fidèle au mockup login (split panneau dégradé,
   bandeau invitation via Route Handler GET `/api/invitations/preview?token=`
   — lecture seule, retourne inviterFirstName/valid/reason/expiresAt) ; états
   jeton invalide/expirée/utilisée/révoquée ; `/sign-up` sans jeton → carte
   « MyDay est accessible sur invitation uniquement » (pas de formulaire) ;
   signup envoie `invitationToken` ; redirections → `/`.
2. `/mot-de-passe-oublie` (message neutre anti-énumération) **ET**
   `/reinitialiser-mot-de-passe` (saisie du nouveau mot de passe via le lien —
   `authClient.resetPassword`, gestion token invalide/expiré).
3. `/reglages` fidèle au mockup : onglets Mon compte / Brief & notifications
   (placeholder « Round 007 ») / Administration (visible si role admin — info via
   session) ; profil (nom modifiable `authClient.updateUser`) ; carte Google
   placeholder (« Round 003 ») ; zone suppression (dialog + saisie « SUPPRIMER »
   → DELETE /api/me → signOut → /sign-in) ; admin : invitations (créer, copier
   le lien, renvoyer, révoquer, statuts dont « Expirée » ; états loading + toasts)
   + comptes (dernière connexion ou « Jamais connecté », désactiver/réactiver,
   badge Admin, erreur dernier-admin affichée) + mention confidentialité.
4. `middleware.ts` : allow-list = /sign-in, /sign-up, /mot-de-passe-oublie,
   /reinitialiser-mot-de-passe, /api/auth, /api/invitations/preview, assets ;
   tout le reste exige le cookie (défense en profondeur — les pages gardent
   requireUser()/requireAdmin()).
5. Navbar : avatar → dropdown (Réglages, Se déconnecter).
6. Vérifs : build, tsc, lint + parcours curl réels ; checklist SOP (grep accents
   sur TOUS les fichiers touchés, aucune redirection /dashboard).

## ÉTAPE 2 — Vérification lead (base des tests fin de round)

1. Build + tsc + lint + pytest + ruff verts
2. Parcours réel complet : admin crée invitation → preview → signup jeton →
   compte + acceptee + acceptedBy → login → cockpit ; même jeton → refus
3. Adversarial : sans jeton / expirée / révoquée ; concurrence claim (2 signups
   quasi simultanés → 1 seul compte) ; 403 non-admin ; désactivation → session
   morte immédiatement (test avec session active) ; garde dernier-admin (PATCH
   et DELETE /api/me) ; email déjà inscrit → 400 ; preview ne fuit pas l'email
4. UI conforme mockups + dark mode + mobile ; grep accents global
5. `.project/decisions.md` : sémantique bearer + dette révocation Google (R003)
   documentées

## Risques résiduels

- Signatures hooks Better-auth 1.6 : prouvées en ÉTAPE 0 AVANT le parallèle
  (fallback Route Handler prêt dans le contrat)
- Jeton brûlé si création échoue post-claim : assumé, l'admin renouvelle
- Middleware edge : simple présence de cookie (documenté, pas une garde)
