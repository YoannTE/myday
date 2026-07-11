# Rapport de test — Round 003 « Connexion Google et synchronisation »

**Date** : 2026-07-10
**Verdict** : PASS
**Itérations** : 2 (itération 1 = 2 bugs bloquants + 1 mineur ; itération 2 = 0 bug bloquant)
**Stack** : dual-stack (Next.js :3000 + FastAPI :8000 + Postgres + MinIO)

> Note : ce rapport a été rédigé en mode CLI standalone (les tools QA Reborn
> `qa_final_report_write` / `qa_report_validate` sont absents hors runtime Reborn).
> Le verdict a été produit par l'agent `qa-tester` sur une passe happy path +
> adversariale complète, puis consigné ici.

## Smoke

| Test | Résultat |
|---|---|
| Frontend up (`curl -I localhost:3000`) | 307 → login, OK |
| API up (`curl localhost:8000/health`) | 200, OK |
| Endpoint protégé sans cookie (`GET /api/google/status`) | 401 `Non authentifie`, OK |
| Build TypeScript (`npx tsc --noEmit`) | 0 erreur |
| Tests backend (`pytest` via venv `~/.pi-tools/myday-venv`) | 86 passed, 1 warning (dépréciation `httpx` dans starlette testclient, non bloquant) |

## Docker

N/A pour ce round — Postgres + MinIO tournent via `docker compose`, les serveurs
applicatifs (Next dev + uvicorn) tournent en process direct. Consigne : ne pas
relancer. Aucune vérification Docker supplémentaire nécessaire.

## Playwright

Pas de pilotage navigateur automatisé sur cette itération : vérification statique
équivalente + vérification visuelle manuelle antérieure de la carte Google
(« Compte Google connecté · SYNCHRONISÉ IL Y A 22 MIN », pastille bleue).

Inventaire des composants Google vérifié : `GoogleCard` (dispatch d'états),
`GoogleCardConnecte` (resynchroniser + déconnecter avec dialog), `useGoogleStatus`
(chargement + rechargement), `messageErreurGoogle` (i18n des erreurs réseau).

## Bugs trouvés

### Itération 1 (corrigés)

1. **[BLOQUANT] Désalignement snake_case / camelCase** entre la réponse API
   (`GoogleStatusResponse` en snake_case) et le frontend (qui lisait en camelCase).
   Conséquence : fraîcheur jamais affichée, carte toujours « Pas encore synchronisé »,
   bannière de reconnexion jamais montrée.
   Fix : frontend aligné sur snake_case (`calendar_synced_at`, `gmail_synced_at`,
   `last_manual_sync_at`, `reauth_required`) dans `types.ts`, `google-card.tsx`,
   `google-card-connecte.tsx`, `freshness.tsx`. Convention projet confirmée = snake_case.

2. **[MAJEUR] Toasts verts** — `toast.success()` s'affichait en vert, violant la
   règle design AEVIO One « AUCUN vert ».
   Fix : `richColors` retiré de `layout.tsx` ; classNames `success`/`info` en bleu
   accent (`bg-soft`/`text-accent`) et `error` neutre dans `sonner.tsx`.

3. **[MINEUR] Aucune configuration de logging** backend.
   Fix : `logging.basicConfig(level=logging.INFO, ...)` dans `backend/app/main.py`.

### Itération 2

Aucun bug bloquant ni majeur résiduel.

Points mineurs relevés (non bloquants, aucun correctif demandé) :
- Warning de dépréciation `starlette.testclient` (httpx) dans la suite de tests.
- `sync.py` : double `release_sync_lock` sur le chemin nominal — vérifié volontaire
  (`UPDATE ... SET sync_locked_until = NULL` idempotent, « filet de sécurité »).

Revue adversariale des services Google (oauth, sync, calendar_branch, gmail_branch,
google_connection, routes connect/callback) : gestion d'erreur robuste
(`invalid_grant` → `reauth_required`), refresh single-flight par verrou asyncio,
verrou BDD anti-double-run atomique, une branche en échec n'échoue pas l'autre
(`return_exceptions=True`), révocation Google best-effort non bloquante (timeout 3 s),
anti-spam 429 sur la sync manuelle fonctionnel, PKCE + état signé + vérification
`userId` côté callback. Aucun bug bloquant.

## Parcours à valider par toi

1. **Connexion à un vrai compte Google**
   - Où aller : ouvre l'app, va dans Réglages, onglet « Mon compte »
   - Ce que tu fais : clique sur « Connecter Google » → choisis ton compte Google réel → accepte les autorisations demandées
   - Ce que tu dois voir : tu reviens automatiquement sur Réglages avec la carte « Compte Google connecté »

2. **Vérité de la synchronisation Agenda et Gmail**
   - Où aller : Réglages → Mon compte (une fois connecté)
   - Ce que tu fais : clique sur « Resynchroniser », attends quelques secondes
   - Ce que tu dois voir : un message qui confirme le lancement, puis tes événements d'agenda récents et tes mails récents apparaissent dans MyDay peu après

3. **Refus de connexion Google**
   - Où aller : Réglages → Mon compte
   - Ce que tu fais : clique sur « Connecter Google », puis sur l'écran Google clique sur « Annuler » au lieu d'autoriser
   - Ce que tu dois voir : tu reviens sur Réglages sans être connecté, sans message d'erreur technique bizarre, juste un état clair « non connecté »

4. **Déconnexion Google et reconnexion**
   - Où aller : Réglages → Mon compte (connecté)
   - Ce que tu fais : clique sur « Déconnecter », confirme dans la fenêtre, puis reconnecte-toi juste après
   - Ce que tu dois voir : après déconnexion, la carte affiche « non connecté » ; après reconnexion, la synchronisation reprend normalement

BEGIN_QA_RESULT_JSON
{
"schema": "reborn.qa.testRound.result.v1",
"roundId": "003",
"mode": "happy-path-and-adversarial",
"verdict": "PASS",
"validatedByExtension": false,
"iterations": 2,
"findings": []
}
END_QA_RESULT_JSON
