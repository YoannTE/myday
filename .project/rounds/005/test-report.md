# Rapport de test — Round 005 « Onboarding et PWA »

**Date** : 2026-07-11
**Verdict** : PASS
**Itérations** : 1 (0 bug bloquant côté QA ; 1 bug d'intégration corrigé par le lead en consolidation)
**Stack** : dual-stack (Next.js 16 :3000 + FastAPI :8000 + Postgres + MinIO)

> Rapport rédigé en mode CLI standalone (tools QA Reborn absents). Verdict produit par
> l'agent `qa-tester` (happy path + adversariale) + smoke navigateur réel par le lead.

## Smoke

| Test | Résultat |
|---|---|
| Backend `pytest -q` | **133 passed** (10 nouveaux : préférences, idempotence concurrente, RLS, validations) |
| Backend `ruff check app` | All checks passed |
| Frontend `npx tsc --noEmit` | 0 erreur |
| Frontend `npm run build` | Succès (routes `/onboarding`, `/manifest.webmanifest` générées) |
| Migration `\d user_preferences` | RLS=t, policy `user_preferences_user_isolation`, grants app_rls, CHECK `brief_hour`+`onboarding_step`, `UNIQUE(user_id)` seul — RLS **dans** la migration journalisée `0005_elite_shard.sql` |
| `GET /api/preferences` sans cookie | 401 |
| `/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.png` sans cookie | **200 (publics)** |
| `/onboarding` sans cookie | 307 (protégé) |
| PATCH `/api/preferences` `brief_hour:"99:99"` / `onboarding_step:9` | 400 (validation service → 400, pas 422) |

## Docker

N/A pour le code applicatif (Postgres + MinIO via compose, healthy ; Next/uvicorn en process direct).

## Playwright / Smoke navigateur (réel, par le lead)

Parcours onboarding complet vérifié end-to-end (compte admin) :
- **Étape 1 Google** : détecte « Ton compte Google est déjà connecté » (réutilise le statut Round 003),
  boutons « Continuer » / « Passer cette étape ».
- **Étape 2 Préférences** : heure du brief (07:00) + 3 toggles bleus (défauts via create-or-default).
- **Étape 3 PWA** : bouton « Installer » + « Continuer sans installer » (hook `usePwaInstall`).
- **Étape 4 Finale** : « Ton cockpit est prêt » (copie honnête : brief réel au Round 007), « Ouvrir mon cockpit ».
- **Persistance** vérifiée en base : `onboarding_step` progresse 0→2→4, puis `onboarding_completed=true` à la fin.
- **Redirection** vers `/` à la complétion, **sans** bannière de reprise.
- **Bannière de reprise** : réapparaît (« Termine ta configuration · Connecte Google → ») quand
  `onboarding_completed=false`, pointe vers la bonne étape.
- Assets PWA publics (manifest/sw/icônes 200), `/onboarding` protégé (307).

> Note : l'état onboarding de l'admin a été **remis à zéro** après test, pour que tu vives le
> premier lancement naturellement (bannière + wizard) lors de ta revue.

## Bugs

### Corrigé par le lead (consolidation)

1. **[BLOQUANT] Assets PWA protégés par le middleware d'auth** — `manifest.webmanifest`, `sw.js`
   et `/icons/*` redirigeaient vers `/sign-in` (307) car non whitelistés dans `src/proxy.ts`
   (middleware Next 16). Un manifest/SW inaccessible = PWA non installable. Aucun agent ne
   possédait `proxy.ts` (coordination gap). **Corrigé** : ajout de `manifest.webmanifest`, `sw.js`,
   `/icons` à la liste blanche publique. Vérifié : 200 pour les assets, 307 conservé pour `/onboarding`.
   → Capitalisé en SOP `pwa-assets-public-proxy`.

### QA (qa-tester)

Aucun bug bloquant ni mineur détecté (analyse statique exhaustive + endpoints testés en direct).

## Couverture adversariale (qa-tester)

Confirmés : validation `brief_hour`/`onboarding_step` → 400 (dans le service, pas 422) ;
create-or-default via `scoped_connection` + idempotence concurrente (`UNIQUE(user_id)`) ;
PATCH pose `updated_at=now()` ; OAuth `next` whitelisté (chemins internes, rejette `//host`,
défaut `/reglages` préservé, double vérif au callback) ; SW enregistré **uniquement en prod**
+ `unregister()` défensif en dev, cache versionné + purge activate, `/api` jamais intercepté ;
`themeColor` dans `viewport` (Next 16) ; hook `usePwaInstall` singleton (pas de `window` brut) ;
responsive planning `PlanningJour`/`PlanningSemaine` mutuellement exclusifs ; snake_case 0 hit ;
réutilisation prouvée des états d'échec Round 002/003.

## Parcours à valider par toi

1. **Installer l'app sur ton téléphone**
   - Où aller : ouvre `http://localhost:3000/onboarding` (sur ton téléphone ou Chrome), va à l'étape 3
   - Ce que tu fais : appuie « Installer » (ou « Partager → Sur l'écran d'accueil » sur iPhone)
   - Ce que tu dois voir : une icône MyDay sur ton écran d'accueil ; en l'ouvrant, l'app se lance
     en plein écran, sans barre d'adresse

2. **Connexion réelle à ton compte Google**
   - Où aller : onboarding, étape 1
   - Ce que tu fais : « Continuer avec Google » → choisis ton compte → autorise
   - Ce que tu dois voir : retour sur l'étape 1 avec un message confirmant que Google est connecté,
     puis tu continues vers l'étape 2

3. **Ressenti du parcours d'accueil sur un vrai téléphone**
   - Où aller : suis les 4 étapes en entier sur ton téléphone
   - Ce que tu fais : avance jusqu'à « Ouvrir mon cockpit »
   - Ce que tu dois voir : chaque étape agréable à lire, rien ne déborde, boutons faciles à toucher,
     et tu arrives bien sur ton cockpit

BEGIN_QA_RESULT_JSON
{
"schema": "reborn.qa.testRound.result.v1",
"roundId": "005",
"mode": "happy-path-and-adversarial",
"verdict": "PASS",
"validatedByExtension": false,
"iterations": 1,
"findings": [
{"severity": "blocker", "file": "src/proxy.ts", "status": "fixed", "description": "Assets PWA (manifest/sw/icons) protégés par le middleware d'auth → non installable ; whitelistés."}
]
}
END_QA_RESULT_JSON
