---
id: "009"
title: "Notifications push et recherche"
status: "done"
depends_on: ["008"]
---

## Objectifs

Palier 3 — le confort : les alertes qui sortent de l'app et la recherche globale.

## Périmètre

- [ ] F10 - Notifications push : web push (PWA installée, iOS ≥ 16.4), fallback email pour les alertes critiques, réglages on/off par type + plafond anti-spam, branchement des notifications déjà produites par les workflows (mail important, brief prêt, rappel événement)
- [ ] F11 - Recherche globale : modale ⌘K (notes, tâches, mails, événements) — pas de mockup dédié (la barre du haut est occupée par l'assistant) : reprendre le style des modales AEVIO One, s'inspirer de pages/notes.html pour les résultats
- [ ] Rappels d'événements : planification des notifications « événement dans 30 min »

## Mockups liés

- F10 : pages/reglages.html (section notifications) + png/reglages.png et pages/onboarding.html (étape PWA)
- F11 : pas de mockup dédié — style design.md + composants existants (décision tracée ici)

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-11
**Statut final** : done

**Livré**
Le confort. Notifications push web (VAPID/pywebpush) branchées sur les notifications déjà produites
(mail important R006, brief prêt R007) + nouveaux rappels d'événements (« dans 30 min », scheduler
dédié idempotent). Abonnement push dans les réglages (6 états, iOS ≥16.4 si PWA installée), handlers
`push`/`notificationclick` dans le service worker, cloche de notifications dans la navbar (badge
non-lues + dropdown). Recherche globale : modale (⌘/ + icône loupe) sur notes/tâches/mails/événements,
résultats groupés, requêtes paramétrées scopées RLS. Validé end-to-end : recherche « facture » → mails
groupés dans l'UI.

**Décisions techniques**
- **⌘K = assistant (R008)** → recherche sur **⌘/ / Ctrl+/** + loupe.
- Push : `pywebpush` (synchrone) appelé via `anyio.to_thread` ; envoi HORS transaction BDD (commit la
  notification, puis push best-effort — sinon épuisement du pool). Pont **push-only** : mail_triage et
  daily_brief gardent leur INSERT/plafond, ajoutent juste un `dispatch_push` après commit.
- **Fallback email retiré** (différé) : envoyer un mail au user via Gmail créerait une boucle
  d'auto-ingestion (resync + re-tri). Push uniquement ce round.
- Abonnement push : upsert par `endpoint` via pool admin (la RLS bloque la réassignation d'un endpoint
  partagé cross-user, comme les écritures session/invitations) ; lectures/suppressions scopées RLS.
- Migration : nouvelle table `push_subscriptions` (RLS, unique endpoint). Clés VAPID générées.
- Rappels : scheduler qui requête `events` (fenêtre), pas les users ; idempotent (unique ref_id).

**Bugs et blocages**
- 0 bug QA. Les 2 reviews (architect + lead-dev) ont capturé les risques en amont (push I/O dans la
  transaction, boucle fallback email, pywebpush sync) — corrigés avant implémentation (9 corrections).

**Enseignements**
- Une lib synchrone (pywebpush) dans du code async → `anyio.to_thread`, et l'I/O réseau lent JAMAIS
  dans une transaction BDD (épuisement du pool sous `--workers 1`).
- S'auto-envoyer un email comme « fallback » recrée une boucle d'ingestion — à éviter.

**Endpoints exposés**
- GET/POST/DELETE `/api/push/subscribe` · GET `/api/push/vapid-public-key`
- GET `/api/notifications` · POST `/api/notifications/read` · GET `/api/notifications/unread-count`
- GET `/api/search` · scheduler rappels d'événements (lifespan)
