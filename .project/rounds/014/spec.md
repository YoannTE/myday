---
id: "014"
title: "Cockpit & brief repensés"
status: done
depends_on: ["012", "013"]
---

## Objectifs

Rendre le cockpit plus actionnable : brief du jour réordonné selon l'ordre de lecture
naturel, capture rapide par section, notes cliquables, et section planning renommée
affichant les prochains rendez-vous.

## Périmètre

- [x] F5 : **Brief du jour réordonné** — (a) rendez-vous du jour (TOUTE la journée courante), (b) tâches du jour (échéance = aujourd'hui, bornes `Europe/Paris`), (c) 3 mails les plus importants reçus ≤ 5 jours. Blocs vides explicites : pas de RDV → « Aucun rendez-vous aujourd'hui » ; pas de tâche → ligne omise ou « Rien d'urgent » ; < 3 mails → afficher 0 à 3. Ordre **centralisé dans `compose.py`** ; `degraded.py` (mode règles) suit le même ordre.
- [x] F6 : **Notes cliquables** depuis le cockpit (`notes-epinglees.tsx`) → ouvre le détail de la note.
- [x] F7 : **Bouton rond bleu « + »** à côté du titre de chaque section (Notes, Ton planning, Tâches) → ouvre la création rapide correspondante (dialogs existants ; « + » planning → `event-form-dialog`). **Toast de confirmation** après création.
- [x] F8 : « Ta journée » **→ « Ton planning »** + **10 prochains événements à venir** (`journee-timeline.tsx`). État vide : « Aucun rendez-vous prévu » + bouton « + ».
- [x] F9 : **Détail de note** — limiter la largeur/marge de la boîte de contenu à la colonne de base (max-w cohérent) pour éviter le débordement à droite (lisibilité mobile). Fix CSS dans `note-ouverte.tsx`.

## Approche technique

- Backend brief (`context.py` + `compose.py`) : événements du jour (bornes `Europe/Paris`), tâches échéance=aujourd'hui, top 3 mails (score, ≤ 5 j). Ordre des blocs = source unique dans `compose.py` réutilisée par `degraded.py`. Prévoir un moyen de **forcer le mode dégradé** (clé IA absente) pour le qa-tester.
- Frontend : `brief-hero.tsx` rend les 3 blocs ordonnés + états vides ; composant « + » réutilisable branché sur les dialogs ; `notes-epinglees` liens ; `journee-timeline` requête « à venir limit 10 » + état vide ; fix largeur `note-ouverte`.
- Délégation : `fastapi-developer` (brief réordonné), `nextjs-developer` (cockpit, notes, fix CSS).

## Mockups liés

<!-- Réutiliser design.md + patterns.md (carte hero brief, timeline, boutons ronds accent). -->

## Tests fin de round

- Brief : 3 blocs dans le bon ordre, avec données réelles **et** en mode dégradé ; blocs vides gérés.
- Note cliquable ouvre le détail ; boîte de note lisible en mobile (pas de débordement).
- Chaque « + » ouvre la bonne création + toast de confirmation.
- « Ton planning » liste 10 événements à venir + état vide.
- build + tsc + pytest.

## Compte-rendu

**Date** : 2026-07-12
**Statut final** : done

**Livré**
Cockpit repensé : brief du jour réordonné (agenda du jour → tâches du jour → 3 mails ≤5j)
avec blocs vides explicites ; notes cliquables au cockpit ; bouton rond « + » par section
(Notes / Ton planning / Tâches) avec toast ; « Ta journée » → « Ton planning » (10 prochains
événements à venir) ; largeur de la boîte de note corrigée (mobile).

**Décisions techniques**
- Ordre du brief = **source unique** `BRIEF_BLOCK_ORDER` (degraded.py) réutilisée par le mode dégradé + **garde-fou à l'import** de compose.py (`assert` vs `BriefContentModel`) : IA et mode règles ne peuvent plus diverger.
- Tâches « du jour » bornées **Europe/Paris**. Mails = top 3 sur 5 derniers jours.
- Cockpit : `journee` → `prochains` (10 événements `debut >= now`, tri croissant), jointure catégories (Round 012) préservée.
- Bouton « + » réutilisable (`section-add-button.tsx`).

**Bugs et blocages**
- 0 bug bloquant. **[hors périmètre, signalé]** le garde-fou anti-hallucination du brief (compose.py, pré-existant) ne déduplique pas des priorités identiques renvoyées par l'IA → répétitions possibles. À corriger séparément.

**Enseignements**
- Une source unique + assert à l'import protège contre la divergence IA/dégradé.

**Endpoints exposés / modifiés**
- GET `/api/cockpit` (modifié : `journee` → `prochains`) ; brief réordonné (signature inchangée)
