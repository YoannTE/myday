---
id: "003"
title: "Connexion Google et synchronisation"
status: "done"
depends_on: ["002"]
---

## Objectifs

Palier 1 — la fondation données : OAuth Google, greffe de l'Agent Platform, et le workflow google_sync qui remplit le cockpit.

## Périmètre

- [x] F2 - Connexion Google : OAuth officiel (scopes Agenda lecture/écriture + Gmail lecture/envoi), stockage des jetons chiffrés (enveloppe AES-256-GCM, clé hors BDD), carte Google des réglages (état, dernière sync, déconnecter/resynchroniser)
- [x] Greffe Agent Platform : /provision-tenant puis /add-agents-platform (prérequis des workflows), uvicorn --workers 1
- [x] Workflow google_sync : implémentation conforme à `.project/agent-designs/google_sync.md` (branches parallèles agenda/gmail, sync incrémentale, curseurs transactionnels, verrou anti-chevauchement, reauth_required) + scheduler ~5 min + endpoint rafraîchissement manuel + indicateur de fraîcheur

## Mockups liés

- F2 : pages/reglages.html (carte Google) + png/reglages.png
- Fraîcheur : composant `shared/components/fraicheur.html` (présent sur tous les écrans)

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-10
**Statut final** : done

**Livré**
Connexion Google OAuth 2.0 (PKCE + état HMAC signé) bout en bout, chiffrement
des jetons au repos (AES-256-GCM enveloppe, fail-fast au boot si clé absente),
synchronisation incrémentale Agenda (syncToken) + Gmail (historyId) avec curseurs,
verrou anti-chevauchement, résolution de conflit Google-source-of-truth,
idempotence par `clientUuid`. Carte Google dans /reglages (états chargement /
erreur / non connecté / reconnexion nécessaire / connecté) avec fraîcheur réelle,
resynchronisation manuelle (anti-spam 429), déconnexion avec révocation
best-effort. Setup Google Cloud Console réalisé (projet, APIs Calendar+Gmail,
écran de consentement, credentials OAuth). Sync réelle validée : 2 événements
d'agenda + 23 mails importés.

**Décisions techniques**
- Workflows implémentés en services FastAPI simples (pas de plateforme Agent Core
  disponible), mêmes garanties fonctionnelles ; documenté dans decisions.md.
- Flux OAuth : `redirect_uri` sur :3000, donc les Route Handlers Next gèrent
  connect/callback et délèguent l'échange de jetons à FastAPI `POST /api/google/exchange`.
- Convention API confirmée : **snake_case** de bout en bout (voir SOP créé).
- RLS partout via `scoped_connection(user_id)`, refresh single-flight, connexion
  asyncpg par branche, push avant apply, révocation best-effort non bloquante.

**Bugs et blocages**
- BLOQUANT (corrigé) : désalignement snake_case/camelCase API↔frontend → fraîcheur
  jamais affichée, carte figée « Pas encore synchronisé », bannière reconnexion
  jamais montrée. Frontend réaligné sur snake_case. → SOP capitalisé.
- MAJEUR (corrigé) : toasts verts (violation règle design « AUCUN vert ») → retrait
  de `richColors`, classNames bleu accent dans sonner.tsx.
- MINEUR (corrigé) : logging backend non configuré → `logging.basicConfig` dans main.py.
- INFO (non-code) : les jetons Google sont révoqués côté serveur au bout de ~4 min
  en mode Test OAuth (limitation Google, pas un bug applicatif).

**Enseignements**
- Toujours vérifier la casse du contrat API dès qu'un composant lit une réponse :
  un champ `undefined` passe la compilation TS mais casse l'UI en silence.
- Vérifier visuellement les données réelles, pas seulement la compilation.

**Endpoints exposés / modifiés**
- GET `/api/google/connect` (Next) · GET `/api/google/callback` (Next)
- POST `/api/google/exchange` (FastAPI) · POST `/api/google/sync` (FastAPI)
- GET `/api/google/status` (FastAPI) · DELETE `/api/google` (FastAPI)
- DELETE `/api/me` (FastAPI, modifié : révocation Google avant purge)
