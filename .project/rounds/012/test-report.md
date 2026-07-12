# Rapport de test — Round 012 « Tâches : dates & catégories »

**Date** : 2026-07-12
**Verdict** : PASS (après correction d'1 bug bloquant)
**Itérations** : 1 (1 bug bloquant corrigé)
**Stack** : dual-stack (Next.js 16 + FastAPI + Postgres + MinIO)

## Smoke

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run build` | Succès (25 routes) |
| Backend `pytest -q` | **254 passed** (~28s) |
| `ruff check app` | All checks passed |
| Migration `0008` | table `task_categories` + `tasks.categorie_id` (FK ON DELETE SET NULL) + `UNIQUE(user_id,nom)` + RLS + GRANT app_rls — vérifiés via psql |
| Docker (Postgres + MinIO) | up & healthy |

## Adversarial (qa-tester)

- **Catégories** : nom dupliqué → 409 ; couleur auto-assignée (palette tournante) ; CRUD OK.
- **Cloisonnement** (4 vecteurs) : un user ne peut ni lister, ni patcher, ni supprimer, ni assigner la catégorie d'un autre (404/400). Contrôle **applicatif** (`category_belongs_to_user`), pas seulement RLS.
- **Suppression catégorie** : tâches conservées, `categorie_id` → NULL (FK SET NULL).
- **Validation** : `echeance` / `categorie_id` invalides → 422 ; null accepté ; UUID inexistant → 400.
- **Frontend** (inspection + build) : groupe « Sans catégorie » toujours en dernier ; état vide → liste à plat + CTA ; badges couleur.

## Bugs

- **[BLOQUANT, corrigé]** `GET /api/cockpit` ne joignait pas `task_categories` (`services/cockpit.py` + `models/cockpit.py` non mis à jour) → le badge de catégorie n'apparaissait pas sur le widget « Tes tâches » du cockpit (périmètre F2). **Corrigé** : LEFT JOIN + `categorie` imbriquée dans `TaskSummary`, verrouillé par `test_cockpit_tache_expose_categorie`.
- **[INFO]** Une `echeance` « date seule » brute peut se décaler d'un jour selon le fuseau serveur — neutralisé par le frontend (midi local avant envoi). Aucune action.

## Parcours à valider par toi

Aucun parcours à valider manuellement pour ce round (ni email, ni paiement, ni OAuth, ni rendu visuel fin ; tout est couvert par les tests automatisés). À voir en vrai une fois déployé : créer une catégorie « Pro », y ranger une tâche avec une date, vérifier le badge sur `/taches` et au cockpit.

BEGIN_QA_RESULT_JSON
{
  "schema": "reborn.qa.testRound.result.v1",
  "roundId": "012",
  "mode": "smoke-and-adversarial",
  "verdict": "PASS",
  "validatedByExtension": false,
  "iterations": 1,
  "findings": [
    {"file": "backend/app/services/cockpit.py", "severity": "blocking", "status": "fixed", "description": "cockpit ne joignait pas les catégories — corrigé + test de non-régression"}
  ]
}
END_QA_RESULT_JSON
