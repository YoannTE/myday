# Rapport de test — Round 013 « Planning : vues + heure de fin »

**Date** : 2026-07-12
**Verdict** : PASS (0 bug bloquant)
**Stack** : dual-stack (Next.js 16 + FastAPI + Postgres + MinIO)

## Smoke

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run build` | Succès (route /planning) |
| Backend `pytest -q` | **260 passed** |
| `ruff check` | All checks passed |
| Migration 0009 (index composite `events_user_debut_idx`) | présent (psql) |

## Adversarial (curl live + inspection)

- Fenêtre `from/to` en **chevauchement inclusif** : événement multi-jours chevauchant la borne → renvoyé ; hors fenêtre → absent.
- `from > to` → **400** sur `/api/events` et `/api/events/counts`.
- Agrégat `counts` en **Europe/Paris** : événement 22h30 UTC (00h30 Paris jour+1) → compté sur le bon jour local.
- Cloisonnement RLS : un user ne voit ni events ni counts d'un autre.
- Frontend : fuseau Europe/Paris forcé (`date-utils.ts`), `formaterPlageHoraire` (3 cas), sélecteur 4 vues + persistance localStorage, vue mois (clic jour→jour), vue année (heatmap via counts, clic mois→mois).

## Playwright

15/15 tests passés sur les 4 vues, la navigation prev/suivant/aujourd'hui, le sélecteur persistant, le formulaire (création valide / fin<début / champs requis), l'affichage de l'heure de fin. Desktop + mobile 375px, 0 erreur console/network.

## Bugs

- 0 bloquant. **[INFO]** heatmap année : un événement multi-jours n'est coloré que sur son jour de début (agrégat sur `debut`). Choix d'implémentation raisonnable, polish futur possible.

## Parcours à valider par toi

1. **Les 4 vues sur ton vrai téléphone** : ouvre Planning, teste les boutons Jour/Semaine/Mois/Année et fais défiler — chaque vue doit être lisible sans zoomer, les boutons touchables au doigt.
2. **La densité de la vue Année** : après avoir créé plusieurs rendez-vous, l'onglet Année doit rendre visuellement « plus chargés » les jours qui ont plus de RDV.
3. **La saisie de l'heure de fin sur mobile** : « + Événement » → les sélecteurs de date/heure natifs doivent s'ouvrir proprement au doigt.

BEGIN_QA_RESULT_JSON
{"schema":"reborn.qa.testRound.result.v1","roundId":"013","mode":"happy-path-and-adversarial","verdict":"PASS","validatedByExtension":false,"iterations":0,"findings":[{"file":"backend/app/services/events.py","severity":"info","status":"open","description":"heatmap année : événement multi-jours coloré sur le jour de début uniquement (non bloquant)"}]}
END_QA_RESULT_JSON
