---
id: "005"
title: "Onboarding et PWA"
status: "done"
depends_on: ["004"]
---

## Objectifs

Palier 1 — l'arrivée : le parcours d'accueil en 4 étapes et l'app installable sur téléphone.

## Périmètre

- [ ] Onboarding 4 étapes : connexion Google (carte permissions transparente), préférences (heure du brief, notifications), installation PWA (tutoriel iPhone), écran final « Ton premier brief est prêt » (le brief réel arrive au round 007 — état transitoire « cockpit prêt » d'ici là)
- [ ] F12 - PWA mobile : manifest, service worker, installation écran d'accueil, audit responsive de tous les écrans (règles mobile de design.md)
- [ ] Parcours d'échec (décision revue) : refus OAuth/permissions partielles, jeton révoqué (reconnexion guidée), invitation expirée, états vides du premier login

## Mockups liés

- Onboarding + F12 : pages/onboarding.html + png/onboarding.png

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-11
**Statut final** : done

**Livré**
L'arrivée dans l'app. Onboarding en 4 étapes (`/onboarding`) : connexion Google (réutilise le
flux Round 003 avec retour vers l'onboarding), préférences (heure du brief, fuseau, 3 toggles
notifications), installation PWA (bouton natif + tuto iPhone), écran final honnête (brief réel
au Round 007). PWA installable : manifest, service worker (prod-only, network-first, cache
versionné), icônes générées, hook d'installation singleton. Table `user_preferences` (RLS) +
endpoints `GET/PATCH /api/preferences`. Onglet « Brief & notifications » des réglages câblé
(autosave). Bannière de reprise sur le cockpit tant que l'onboarding n'est pas terminé. Audit
responsive (vue jour mobile du planning). Parcours d'échec réutilisés (refus OAuth, jeton
révoqué, invitation expirée).

**Décisions techniques**
- Plan reviewé par architect + lead-dev (15+ corrections intégrées avant implémentation).
- 4 agents en parallèle (DB en premier pour la migration, puis BACK + 2 front) contre contrats figés.
- Migration RLS : statements ENABLE RLS + POLICY + GRANT ajoutés DANS la migration générée et
  journalisée (0005), pas de `.sql` orphelin.
- OAuth `next` threadé connect → état signé HMAC → callback (whitelist chemins internes, défaut
  `/reglages` inchangé) pour ramener l'utilisateur sur `/onboarding`.
- PWA Next 16 : `themeColor` dans l'export `viewport`, manifest via `manifest.ts` (link
  auto-injecté), SW enregistré uniquement en prod + `unregister()` défensif en dev.
- Hook `usePwaInstall()` figé (singleton `beforeinstallprompt`), consommé sans `window` brut.
- Validation métier renvoyée en 400 depuis le service (pas `field_validator` → 422).
- Sémantique `onboarding_step` : 0 non démarré, 1..4 étape courante, `onboarding_completed` = fini.

**Bugs et blocages**
- 1 bug bloquant d'intégration corrigé en consolidation : les assets PWA (manifest/sw/icônes)
  étaient protégés par le middleware d'auth `src/proxy.ts` (Next 16 renomme `middleware.ts` en
  `proxy.ts`) → non installable. Whitelistés. Capitalisé en SOP `pwa-assets-public-proxy`.
- QA : 0 bug bloquant/mineur.

**Enseignements**
- Whitelister les assets servis sans session (manifest, sw, icônes, .well-known) dans le
  middleware d'auth fait partie du « done » d'une feature PWA — vérifier au curl (un 307 est
  invisible dans un navigateur déjà connecté).
- En Next 16, le middleware est `src/proxy.ts` (fonction `proxy`), pas `middleware.ts`.

**Endpoints exposés / modifiés**
- GET `/api/preferences`, PATCH `/api/preferences`
- `/api/google/connect` + `/api/google/callback` (modifiés : threading `next`)
- `/manifest.webmanifest` (route metadata)
