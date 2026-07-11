---
id: "004"
title: "Cockpit : dashboard, planning, notes, tâches"
status: "done"
depends_on: ["003"]
---

## Objectifs

Palier 1 — le cockpit utile : le dashboard en lecture avec les vraies données, le planning complet, les notes et les tâches natives. Test de sortie : Manon s'en sert seule une semaine.

## Périmètre

- [x] F3 - Dashboard cockpit : page d'accueil connectée (sans le bloc brief IA, posé au round 007) — sections Notes (liste épinglée), Ta journée (timeline + pastille maintenant), Tes tâches (checklist), Mails importants (placeholder avant round 006), liens « Tout voir → »
- [x] F4 - Planning : page complète vue semaine/jour, création/édition d'événements (écriture Google Agenda idempotente), badges « via l'assistant »/« Non synchronisé », navigation semaine, retour « ← Cockpit »
- [x] F5 - To-do list : tâches natives (titre, priorité, échéance, origine), cocher/ajouter/modifier depuis le dashboard
- [x] F6 - Notes : page complète (liste + note ouverte, épingler, archiver, recherche dans les notes), champ « Note rapide », origine manuelle/assistant
- [x] Journal d'usage : table d'événements produit (dashboard_opened, task_completed...) alimentée dès ce round (décision revue experts)

## Mockups liés

- F3 : pages/dashboard.html + png/dashboard.png
- F4 : pages/planning.html + png/planning.png
- F5 : pages/dashboard.html (section Tes tâches) + png/dashboard.png
- F6 : pages/notes.html + png/notes.png

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

**Date** : 2026-07-11
**Statut final** : done

**Livré**
Le cœur fonctionnel de l'app. Cockpit `/` connecté aux vraies données (Notes épinglées,
Ta journée en timeline avec pastille « maintenant », Tes tâches, Mails importants en
placeholder), garde d'auth par Server Component. Planning `/planning` complet (vue semaine,
navigation, CRUD événements avec écriture Google Agenda idempotente réutilisant le socle
Round 003, badge « Non synchronisé »). To-do `/taches` + ajout/cochage. Notes `/notes`
(liste + note ouverte, épingler, archiver, recherche). Journal d'usage alimenté
(`dashboard_opened`, `task_completed`). 14 endpoints FastAPI (tasks/notes/events/cockpit/usage).
Aucune migration BDD (schéma des 13 entités déjà posé au Round 001).

**Décisions techniques**
- 4 agents en parallèle contre un contrat API figé (2 back, 2 front), plan reviewé par
  architect + lead-dev (12 corrections intégrées avant implémentation).
- Écriture Google : réutilisation de `load_connection`/`push_local_events`/`_push_one`
  (Round 003) ; sur échec/verrou/reauth → `sync_pending` (jamais `sync_error` orphelin) ;
  nouveau context manager `_connected_client` (best-effort, ne libère jamais un verrou tiers).
- `update_event`/`delete_event` ajoutés au client Google (édition/suppression réelles).
- Fuseau `Europe/Paris` en config pour les bornes du jour du cockpit.
- Journal d'usage : `task_completed` émis serveur-side de façon atomique
  (`WHERE statut <> 'faite'`) ; `dashboard_opened` émis client-side au montage.
- Pas de badge « via l'assistant » sur les events (table `events` sans colonne origine).

**Bugs et blocages**
- 1 bug mineur (corrigé) : `NoteOrigine` TS `"utilisateur"` → `"manuelle"` (fidélité contrat).
- Piège framework non-bloquant (capitalisé en SOP) : sous fastapi 0.139, `include_router`
  n'aplatit plus les routes dans `app.routes` (`_IncludedRouter`) → l'introspection naïve
  fait croire à tort qu'aucun router n'est monté. Vérité = TestClient/curl. A aussi nécessité
  un redémarrage d'uvicorn (lancé sans `--reload`) pour servir les nouveaux endpoints.
- Informatif : la 1ʳᵉ soumission de formulaire juste après chargement peut être perdue
  (soumission native avant hydratation, artefact dev).

**Enseignements**
- Prouver qu'un endpoint est monté en le frappant (TestClient/curl), jamais en comptant des
  `APIRoute` dans `app.routes`. Redémarrer uvicorn après ajout d'endpoints.
- Un contrat API figé (snake_case) permet un vrai parallélisme front/back sans casse.

**Endpoints exposés / modifiés**
- GET/POST `/api/tasks`, PATCH/DELETE `/api/tasks/{id}`
- GET/POST `/api/notes`, PATCH/DELETE `/api/notes/{id}`
- GET/POST `/api/events`, PATCH/DELETE `/api/events/{id}`
- GET `/api/cockpit` · POST `/api/usage-events`
