---
id: "012"
title: "Tâches : dates & catégories"
status: done
depends_on: ["010"]
---

## Objectifs

Enrichir les tâches : rendre la date d'échéance éditable/visible (champ `tasks.echeance`
existant) et introduire des catégories personnalisables par utilisateur, pour organiser
et filtrer les tâches (Pro, Perso, …).

## Périmètre

- [x] F1 : Date d'échéance optionnelle éditable dans le formulaire de tâche (date picker shadcn), affichée sur la carte de tâche (cockpit + `/taches`). Base pour « tâches du jour » du brief (Round 014).
- [x] F2 : Catégories de tâches **personnalisables** — table `task_categories` (par user, RLS), CRUD (créer/renommer/supprimer), **couleur obligatoire** auto-assignée depuis une palette. Champ `tasks.categorie_id` (FK nullable, `ON DELETE SET NULL`). Groupement/filtre par catégorie ; groupe « Sans catégorie » toujours affiché **en dernier** ; état vide (aucune catégorie) → tâches à plat + CTA discret « Créer une catégorie ».

## Approche technique

- Migration Drizzle `0008` : table `task_categories` (id uuid, user_id text FK user, nom, couleur NOT NULL, created_at/updated_at `timestamptz DEFAULT now()`), `UNIQUE (user_id, nom)` ; colonne `tasks.categorie_id uuid` FK `ON DELETE SET NULL`. RLS sur `task_categories` (policy texte `user_id = current_setting('app.current_user_id', true)`), `GRANT ... TO app_rls` **explicite**, index `task_categories_user_id_idx` + `tasks_categorie_id_idx`. SQL RLS appendu dans le fichier de migration journalisé.
- Backend (FastAPI) : service + endpoints `POST/GET/PATCH/DELETE /api/task-categories`, MAJ endpoints tâches (`echeance`, `categorie_id`). **Valider côté service** que la catégorie appartient au user courant avant d'assigner `categorie_id` (la vérif FK Postgres contourne la RLS).
- Frontend : formulaire tâche (échéance + select catégorie avec création inline), badge couleur sur les cartes, groupement/filtre sur `/taches` et cockpit.
- Délégation : `postgres-developer` (migration/RLS), `fastapi-developer` (endpoints/service), `nextjs-developer` (UI).

## Mockups liés

<!-- Réutiliser design.md + patterns.md (badges, dialogs, date picker). Pas de nouveau mockup. -->

## Tests fin de round

- Migration 0008 s'applique, RLS active, `app_rls` a les droits.
- CRUD catégorie (créer/renommer/supprimer) ; couleur auto-assignée ; `UNIQUE(user_id,nom)` bloque le doublon.
- Assigner date + catégorie à une tâche ; supprimer une catégorie → tâches conservées, `categorie_id` NULL.
- Cloisonnement : un user ne voit pas / ne peut pas assigner les catégories d'un autre (test service).
- États vides (aucune catégorie, tâches sans catégorie en dernier).
- build + tsc + pytest.

## Compte-rendu

**Date** : 2026-07-12
**Statut final** : done

**Livré**
Dates d'échéance exposées dans l'UI des tâches (champ `echeance` existant) + **catégories
de tâches personnalisables** (nouvelle table `task_categories` avec RLS, CRUD, couleur
obligatoire auto-assignée depuis une palette). `tasks.categorie_id` FK nullable
(`ON DELETE SET NULL`). Groupement/filtre par catégorie sur `/taches` et badges au cockpit,
groupe « Sans catégorie » toujours en dernier, état vide géré (liste à plat + CTA).

**Décisions techniques**
- Migration `0008` : `UNIQUE(user_id, nom)`, index `task_categories_user_id_idx` +
  `tasks_categorie_id_idx`, RLS + `GRANT ... TO app_rls` explicite (SQL appendu au fichier journalisé).
- **Cloisonnement applicatif** : la vérif FK Postgres contourne la RLS → contrôle
  d'appartenance côté service (`category_belongs_to_user`) avant d'assigner une catégorie.
- `TaskResponse` (et `TaskSummary` cockpit) incluent `categorie` imbriquée `{id, nom, couleur}` via LEFT JOIN.
- Palette fixe tournante : `#2350E6, #0EA5E9, #8B5CF6, #F59E0B, #EF4444, #10B981, #EC4899, #64748B`.

**Bugs et blocages**
- 1 bug bloquant trouvé par la QA : l'endpoint `/api/cockpit` ne joignait pas les catégories
  → badge invisible au cockpit. **Corrigé** (`services/cockpit.py` + `models/cockpit.py`) et
  verrouillé par un test de non-régression.

**Enseignements**
- Quand un champ enrichit une entité affichée à plusieurs endroits (tâche : `/taches` + cockpit),
  penser à **toutes** les lectures (le cockpit a son propre service d'agrégation, hors du service tâches).

**Endpoints exposés / modifiés**
- GET/POST `/api/task-categories`, PATCH/DELETE `/api/task-categories/{id}` (créés)
- POST `/api/tasks`, PATCH `/api/tasks/{id}` (modifiés : `echeance` + `categorie_id`)
- GET `/api/cockpit` (modifié : catégorie sur les tâches)
