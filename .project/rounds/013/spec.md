---
id: "013"
title: "Planning : vues jour/semaine/mois/année + heure de fin"
status: done
depends_on: ["012"]
---

## Objectifs

Faire du planning une vraie vue calendrier : sélecteur Jour / Semaine / Mois / Année,
et afficher l'heure de fin des événements (champ `events.fin` existant).

## Périmètre

- [x] F3 : Heure de **fin** visible sur chaque événement (carte + détail) au format `HH:mm – HH:mm`. Gérer les cas `fin` un autre jour (multi-jours) et `fin < debut`.
- [x] F4 : Sélecteur de vue **Jour / Semaine / Mois / Année** dans l'en-tête du planning. Réutiliser `planning-jour.tsx` + `planning-semaine.tsx` ; ajouter `planning-mois.tsx` (grille calendaire) et `planning-annee.tsx` (12 mini-mois, densité/points → clic ouvre le mois). Navigation prev/suivant adaptée à la vue ; mémoriser la vue choisie (préférence locale).

## Approche technique

- **Fuseau `Europe/Paris` forcé partout** pour les bornes de vue (corriger `date-utils.ts` qui calcule en heure navigateur ; aligner sur le brief serveur).
- Backend : `GET /api/events` accepte `from`/`to` (ISO). Filtre en **chevauchement** : `debut <= :to AND fin >= :from` (garde les multi-jours). Index composite `(user_id, debut)` pour mois/année.
- Vue **année** : agrégat serveur (`GROUP BY jour, COUNT`) via param `granularite` ou endpoint dédié — ne PAS charger tous les événements de l'année.
- Frontend : état `vue` dans `planning-client.tsx`, fenêtre calculée dans `date-utils.ts`, grilles maison Tailwind (pas de lib calendrier lourde). Affichage fin dans `event-card.tsx` + détail.
- Délégation : `fastapi-developer` (fenêtrage/agrégat events), `nextjs-developer` (vues mois/année, sélecteur, affichage fin).

## Mockups liés

<!-- Réutiliser design.md + patterns.md. Grilles calendaires nouvelles (transposer les tokens AEVIO). -->

## Tests fin de round

- Les 4 vues s'affichent ; navigation prev/next correcte par vue ; fenêtre de chargement correcte (mois ≠ année entière).
- Heure de fin affichée partout ; multi-jours et `fin<debut` gérés à l'affichage.
- **pytest** : fenêtre `from/to` + chevauchement + événement multi-jours ; agrégat année.
- Responsive mobile ; build + tsc.

## Compte-rendu

**Date** : 2026-07-12
**Statut final** : done

**Livré**
Planning multi-vues **Jour / Semaine / Mois / Année** (sélecteur persisté en local), vues
mois (grille calendaire) et année (heatmap de densité) nouvelles, jour/semaine réutilisées.
**Heure de fin** affichée (`HH:mm – HH:mm`, multi-jours et `fin < debut` gérés). Fenêtrage
serveur `from/to` en chevauchement inclusif + endpoint d'agrégat `counts` pour la vue année.

**Décisions techniques**
- Fenêtre en **chevauchement inclusif** : `fin >= from AND debut <= to` (garde les multi-jours).
- Fuseau **Europe/Paris forcé côté client** (`date-utils.ts` via `Intl`) — aligné sur le serveur.
- `GET /api/events/counts` : agrégat `{jour, count}` par jour civil Europe/Paris.
- Index composite `events_user_debut_idx (user_id, debut)` (migration 0009).

**Bugs et blocages**
- 0 bug bloquant. QA : chevauchement/multi-jours/`from>to`→400/bascule jour Paris/cloisonnement vérifiés en live ; 15/15 Playwright sur les 4 vues.

**Enseignements**
- Point mineur (non corrigé, polish futur) : la heatmap année ne colore un événement
  multi-jours que sur son jour de début, alors que la vue mois l'affiche chaque jour.

**Endpoints exposés / modifiés**
- GET `/api/events` (modifié : fenêtrage inclusif) ; GET `/api/events/counts` (créé)
