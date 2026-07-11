# Log - Round 002

## Endpoints touches

(alimente par /round-implement PHASE 4 etape 3)
- GET /api/admin/invitations (cree) : liste des invitations + statut derive (expiree) + invite_url (require_admin)
- POST /api/admin/invitations (cree) : cree une invitation {email} -> {invitation, invite_url} ; 400 email deja inscrit / doublon pending
- POST /api/admin/invitations/{id}/renew (cree) : nouveau jeton + expiration, statut envoyee ; 400 si acceptee
- DELETE /api/admin/invitations/{id} (cree) : revocation (statut revoquee) ; 400 si acceptee
- GET /api/admin/accounts (cree) : email, nom, role, active, derniere connexion (max session.created_at, nullable)
- PATCH /api/admin/accounts/{id} (cree) : {active} flip + delete sessions (meme transaction) ; garde dernier-admin-actif
- DELETE /api/me (cree) : suppression de son compte (cascade FK, transaction admin) + garde dernier-admin
- GET /api/invitations/preview (cree) : preview publique/lecture seule d'un jeton d'invitation (jamais l'email invite) - {inviterFirstName, valid, reason?, expiresAt}

## Fichiers touches

(alimente par les agents dev via le skill output-format, append-only)
- src/lib/db/schema/auth.ts (modifie) : ajout colonne user.active (boolean, defaut true)
- src/lib/db/schema/systeme.ts (modifie) : invitations.acceptedBy (FK user SET NULL) + acceptedAt, CHECK statut etendu a revoquee, index unique partiel email WHERE statut=envoyee
- drizzle/0003_lovely_bishop.sql (cree) : migration active + acceptedBy/acceptedAt + CHECK + index partiel
- src/lib/invitations.ts (cree) : validateInvitationToken (helper unique hook + preview) + INVITATION_ERROR_MESSAGES
- src/lib/auth.ts (modifie) : retrait disableSignUp, additionalField active, hooks before/after sign-up (claim atomique + lien acceptedBy), hook before sign-in (compte desactive), sendResetPassword log dev
- src/lib/session.ts (modifie) : requireAdmin()
- backend/app/config.py (modifie)
- backend/app/db/client.py (modifie)
- backend/app/auth/session.py (modifie)
- backend/app/models/admin.py (cree)
- backend/app/services/invitations.py (cree)
- backend/app/services/accounts.py (cree)
- backend/app/utils/errors.py (cree)
- backend/app/api/admin.py (cree)
- backend/app/api/me.py (modifie)
- backend/app/main.py (modifie)
- backend/tests/conftest.py (modifie)
- backend/tests/test_admin.py (cree)
- backend/tests/test_me_delete.py (cree)
- src/app/api/invitations/preview/route.ts (cree)
- src/components/auth/auth-split-layout.tsx (cree)
- src/components/auth/sign-in-form.tsx (cree)
- src/components/auth/sign-up-form.tsx (cree)
- src/components/auth/invitation-banner.tsx (cree)
- src/components/auth/invitation-status-card.tsx (cree)
- src/components/auth/invitation-required-card.tsx (cree)
- src/components/auth/invitation-only-mention.tsx (cree)
- src/components/auth/forgot-password-form.tsx (cree)
- src/components/auth/reset-password-form.tsx (cree)
- src/components/auth/reset-password-invalid-card.tsx (cree)
- src/app/sign-in/page.tsx (modifie)
- src/app/sign-up/page.tsx (modifie)
- src/app/mot-de-passe-oublie/page.tsx (cree)
- src/app/reinitialiser-mot-de-passe/page.tsx (cree)
- src/proxy.ts (cree)
- src/lib/invitation-messages.ts (cree)
- src/lib/invitations.ts (modifie)
- src/lib/avatar.ts (cree)
- src/components/layout/navbar.tsx (modifie)
- src/components/layout/navbar-user-menu.tsx (cree)
- src/app/reglages/page.tsx (cree)
- src/components/reglages/reglages-tabs.tsx (cree)
- src/components/reglages/profil-card.tsx (cree)
- src/components/reglages/google-connexion-placeholder.tsx (cree)
- src/components/reglages/modifier-profil-dialog.tsx (cree)
- src/components/reglages/brief-notifications-placeholder.tsx (cree)
- src/components/reglages/danger-zone.tsx (cree)
- src/components/reglages/admin/types.ts (cree)
- src/components/reglages/admin/admin-section.tsx (cree)
- src/components/reglages/admin/invitations-panel.tsx (cree)
- src/components/reglages/admin/accounts-panel.tsx (cree)
- src/components/ui/tabs.tsx (cree)
- src/components/ui/badge.tsx (cree)
- src/components/auth-form.tsx (supprime)
- src/lib/auth.ts (modifie) : accents des commentaires (correctif QA)
- src/lib/invitations.ts (modifie) : accents des commentaires (correctif QA)
- backend/app/services/invitations.py (modifie) : accents des commentaires (correctif QA)
- backend/app/services/accounts.py (modifie) : accents des commentaires (correctif QA)
- src/components/auth/sign-in-form.tsx (modifie) : correctif QA MAJOR — traduction du message Better-auth « Invalid email or password » en français
- src/app/layout.tsx (modifie) : correctif QA — suppressHydrationWarning sur <html> (warning hydratation dark mode)
- src/components/reglages/danger-zone.tsx (modifie) : correctif QA — texte de suppression exact (pas de révocation Google avant le Round 003)
