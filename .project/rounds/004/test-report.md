# Rapport de test — Round 004 « Cockpit : dashboard, planning, notes, tâches »

**Date** : 2026-07-11
**Verdict** : PASS
**Itérations** : 1 (0 bug bloquant ; 1 bug mineur corrigé)
**Stack** : dual-stack (Next.js :3000 + FastAPI :8000 + Postgres + MinIO)

> Rapport rédigé en mode CLI standalone (tools QA Reborn absents). Verdict produit
> par l'agent `qa-tester` (happy path + adversariale) + smoke navigateur réel par le lead.

## Smoke

| Test | Résultat |
|---|---|
| Backend `pytest -q` (venv `~/.pi-tools/myday-venv`) | **123 passed**, 1 warning (dépréciation httpx testclient, non bloquant) |
| Backend `ruff check app` | All checks passed |
| Frontend `npx tsc --noEmit` | 0 erreur |
| Frontend `npm run build` | Succès, toutes les routes générées (`/`, `/planning`, `/notes`, `/taches`, `/dashboard`) |
| `curl /health` | 200 `{status:ok, db:true, schema:true}` |
| Endpoints protégés sans cookie (`/api/tasks`, `/api/notes`, `/api/events`, `/api/cockpit`, `POST /api/usage-events`) | 401 partout |

## Docker

N/A — Postgres + MinIO tournent via `docker compose` ; Next dev + uvicorn en process
direct. Serveurs déjà up, non relancés (sauf redémarrage uvicorn par le lead pour
charger les nouveaux endpoints).

## Playwright / Smoke navigateur (réel, par le lead)

- **Cockpit `/`** : garde d'auth OK (Server Component `requireUser`), navbar avec liens
  Cockpit/Planning/Notes/Tâches, 4 sections (Notes, Ta journée, Tes tâches, Mails
  importants avec badge « Bientôt »), états vides propres, aucun vert. `dashboard_opened`
  vérifié enregistré en base (`usage_events`).
- **Tâches** : création end-to-end depuis `/taches` (POST → tâche persistée en base →
  affichée avec checkbox). Journal d'usage fonctionnel.
- **Notes `/notes`** : rendu OK (retour Cockpit, recherche, bouton « + Note », layout
  liste + note ouverte, états vides).
- **Planning `/planning`** : vue semaine, navigation « ‹ SEMAINE DU 6 AU 12 JUILLET › »,
  bouton « + Événement », jour courant mis en avant. **Affiche les vrais événements
  synchronisés Google** (« Anniversaire Goia » du Round 003) → `GET /api/events` OK.
- Contrat snake_case : grep anti-camelCase sur `cockpit/taches/planning/notes` → 0 hit.

## Bugs trouvés

### Corrigés

1. **[MINEUR]** `src/components/notes/types.ts` — `NoteOrigine` déclarait
   `"utilisateur" | "assistant"` au lieu de `"manuelle" | "assistant"` (valeur réelle
   API/BDD `notes_origine_check`). Aucun impact fonctionnel (seule comparaison :
   `=== "assistant"`), mais infidélité au contrat. **Corrigé** → `"manuelle" | "assistant"`.

### Informatif (non bloquant, non corrigé)

- La toute première soumission d'un formulaire dans les millisecondes suivant le
  chargement d'une page peut être perdue (soumission native du navigateur avant que
  React n'ait attaché son `onSubmit` — artefact d'hydratation en mode dev). Reproduit
  une fois sur l'ajout de tâche ; le 2ᵉ essai et tous les suivants fonctionnent. Effet
  négligeable en production (hydratation plus rapide). À surveiller si le symptôme
  réapparaît.

## Couverture adversariale (revue de code, qa-tester)

Confirmés : échec Google / verrou `locked` / `reauth_required` → statut reste
`sync_pending` (jamais `sync_error` orphelin) ; sauvegarde locale jamais bloquée ;
`fin <= debut` → 400 sur POST ET PATCH ; verrou sync jamais libéré par un non-détenteur ;
`task_completed` atomique (`WHERE statut <> 'faite'`, pas de double-émission, testé) ;
`usage-events` rejette `task_completed` et types hors CHECK (400) ; bornes du jour cockpit
en `Europe/Paris` (zoneinfo) ; pas de badge « via l'assistant » sur les events (correction #7) ;
garde d'auth sur toutes les pages ; `/dashboard` → redirect `/` ; états vides gérés sans crash.

## Parcours à valider par toi

1. **Regarder le cockpit se remplir avec de vraies données**
   - Où aller : ouvre http://localhost:3000 (connecte-toi avec `admin@admin.com` / `password` si besoin)
   - Ce que tu fais : crée une note et épingle-la, ajoute une tâche, crée un événement pour aujourd'hui depuis « Planning »
   - Ce que tu dois voir : de retour sur le cockpit, ta note épinglée dans « Notes », ta tâche dans « Tes tâches », ton événement dans « Ta journée » (avec un point qui clignote si l'heure actuelle est dans la plage)

2. **Synchronisation avec Google Agenda** (si ton compte Google est connecté)
   - Où aller : va dans « Planning », clique « + Événement »
   - Ce que tu fais : remplis titre + date + heures de début/fin, valide
   - Ce que tu dois voir : l'événement apparaît tout de suite ; après quelques secondes il apparaît aussi dans ton vrai Google Agenda. Si un badge « Non synchronisé » reste, attends une minute et rafraîchis la page.

3. **Ressenti de la navigation entre les 4 sections**
   - Où aller : ouvre http://localhost:3000
   - Ce que tu fais : clique « Planning », « Notes », « Tâches », reviens « Cockpit »
   - Ce que tu dois voir : chaque page se charge vite, avec des rectangles gris qui pulsent pendant le chargement, jamais d'écran blanc bloqué

BEGIN_QA_RESULT_JSON
{
"schema": "reborn.qa.testRound.result.v1",
"roundId": "004",
"mode": "happy-path-and-adversarial",
"verdict": "PASS",
"validatedByExtension": false,
"iterations": 1,
"findings": [
{"severity": "minor", "file": "src/components/notes/types.ts", "status": "fixed", "description": "NoteOrigine 'utilisateur' -> 'manuelle' (fidélité au contrat)"}
]
}
END_QA_RESULT_JSON
