---
id: "002"
title: "Comptes et invitations"
status: "pending"
depends_on: ["001"]
---

## Objectifs

Palier 1 — l'accès : inscription sur invitation, connexion, et l'espace admin pour inviter Manon.

## Périmètre

- [x] F1 - Comptes sur invitation : page login/inscription (lien d'invitation avec jeton valide/expiré/déjà utilisé, « Invité par Yoann »), connexion email/mot de passe, mot de passe oublié, profil de base
- [x] F13 - Espace admin : section Administration des réglages — envoyer une invitation, renvoyer/révoquer, liste des comptes (email, statut, dernière connexion), désactivation ; l'admin ne voit jamais le contenu des comptes
- [x] Protection des routes : middleware auth (app protégée sauf login/invitation), page réglages squelette (profil + zone suppression de compte)

## Mockups liés

- F1 : pages/login.html + png/login.png
- F13 : pages/reglages.html (section Administration) + png/reglages.png

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-10
**Statut final** : done

**Livré**
Le cycle de vie complet des comptes : inscription sur invitation uniquement (hooks Better-auth avec claim atomique du jeton — prouvé sous concurrence : 2 signups simultanés = 1 seul compte), pages login/inscription fidèles au mockup AEVIO One (bandeau « X t'a invité·e », états jeton invalide/expirée/utilisée/révoquée), mot de passe oublié + réinitialisation de bout en bout, page Réglages complète (profil, placeholders Google/Brief, zone de suppression avec confirmation « SUPPRIMER »), espace Administration (inviter par email avec lien copiable, renvoyer/révoquer, comptes avec dernière connexion, désactiver/réactiver), protection des routes (proxy.ts Next 16 + requireUser/requireAdmin), et 7 endpoints FastAPI admin/compte avec gardes atomiques (dernier admin indéboulonnable, désactivation = sessions tuées dans la même transaction, suppression de compte en cascade).

**Décisions techniques**
Sémantique bearer du jeton d'invitation (le lien est le secret, l'email peut différer — acceptedBy trace la réalité) ; valeurs de statut en BDD en ASCII sans accent (envoyee/acceptee/revoquee), messages UI accentués ; statut « expiree » toujours dérivé, jamais stocké ; claim atomique dans le hook BEFORE (un jeton brûlé si la création échoue → l'admin renouvelle) ; 2e pool Postgres admin côté FastAPI pour les tables hors RLS ; pas d'envoi d'email réel (lien copiable + lien de reset loggé serveur — provider email à brancher plus tard). Dette tracée : DELETE /api/me devra révoquer le jeton Google au Round 003.

**Bugs et blocages**
4 bugs corrigés en 2 itérations : message d'erreur de connexion en anglais (défaut Better-auth non mappé — majeur), warning d'hydratation dark mode (préexistant R001), commentaires non accentués, texte de suppression promettant la révocation Google pas encore implémentée. Aucun blocage : le pari technique du round (champ transitoire invitationToken dans ctx.body des hooks) a été prouvé empiriquement dès l'ÉTAPE 0, sans fallback.

**Enseignements**
Les messages d'erreur par défaut des frameworks tiers arrivent en anglais → SOP créé (mapper par code d'erreur côté UI + tester les cas d'erreur en français). Rate-limit natif Better-auth sur /sign-in (3 req/10 s) à connaître pour les tests E2E. Le format exact des hooks Better-auth 1.6 est capitalisé dans patterns.md.

**Endpoints exposés / modifiés**
- GET/POST /api/admin/invitations, POST /api/admin/invitations/{id}/renew, DELETE /api/admin/invitations/{id} (créés)
- GET /api/admin/accounts, PATCH /api/admin/accounts/{id} (créés)
- DELETE /api/me (créé) · GET /api/invitations/preview (créé, Next public)
<!-- Note : `/round-debrief` remplace la ligne ci-dessus par le compte-rendu structuré. Les notes ajoutées ici seront préservées mais apparaîtront sous le compte-rendu. -->
