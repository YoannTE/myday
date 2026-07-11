# Rapport de test — Round 009 « Notifications push et recherche »

**Date** : 2026-07-11
**Verdict** : PASS
**Itérations** : 1 (0 bug)
**Stack** : dual-stack (Next.js 16 :3000 + FastAPI :8000 + Postgres + MinIO)

## Smoke

| Test | Résultat |
|---|---|
| Backend `pytest -q` | **230 passed** (~25s, aucun appel réseau réel — pywebpush mocké) |
| Backend `ruff check app` | All checks passed |
| Frontend `npx tsc --noEmit` | 0 erreur |
| Frontend `npm run build` | Succès |
| Migration `\d push_subscriptions` | RLS activée, policy `user_isolation`, unique `endpoint`, grants app_rls, journalisée `0007` |
| Endpoints sans cookie (`search`, `notifications`, `unread-count`, `push/subscribe`, `push/vapid-public-key`) | 401 |
| `/health` 200 · `/sw.js` 200 (public) | OK |

## Recherche & notifications réelles (lead + qa-tester)

- **Recherche** (smoke navigateur lead) : icône loupe → modale (⌘/), « facture » → groupe « MAILS · 2 »
  (Boulanger + SET TO WORK), résultats groupés Notes/Tâches/Événements/Mails, live débouncé.
- **Injections testées** (qa-tester, API vivante) : `q=%`, `q='`, `q=_`, `q=... OR '1'='1`,
  `q='; DROP TABLE notes; --` → 200 sans erreur, RLS intact, table `notes` intacte. Requêtes paramétrées.
- **Push cycle** (qa-tester) : `vapid-public-key` → clé ; `subscribe` (payload factice) → `{ok:true}` +
  row en base ; `unsubscribe` → 204 + row supprimée ; subscribe corps vide → 422.
- **Notifications** : `unread-count` 3 → `read` (tout) → `{marked:3}` → `unread-count` 0.
- Navbar : loupe + cloche (badge non-lues). sw.js : handlers `push` + `notificationclick` ajoutés.

## Adversarial (qa-tester) — 9 corrections vérifiées

`pywebpush` via `anyio.to_thread` (jamais sync dans l'event loop) ; `dispatch_push` push-only HORS
transaction BDD (best-effort après commit) ; mail_triage/daily_brief gardent leur INSERT/plafond +
push après commit ; PAS de fallback email Gmail (retiré — boucle d'auto-ingestion) ; scheduler
rappels par requête `events` (fenêtre, NOT EXISTS, idempotent) ; subscribe upsert par endpoint (pool
admin justifié pour la réassignation cross-user, lectures/suppressions scopées RLS) ; recherche ILIKE
paramétrée ; `vapid-public-key` derrière auth. PII : aucun contenu sensible dans les logs.

## Bugs

Aucun. Les 2 reviews (architect + lead-dev) ont capturé les risques en amont (I/O hors transaction,
boucle fallback email, pywebpush sync) — tous corrigés avant implémentation.

## Décisions notables

- **⌘K = assistant (R008)** → recherche sur **⌘/ / Ctrl+/** + icône loupe.
- **Fallback email différé** : envoyer un mail au user via Gmail créerait une boucle (resync + re-tri) ;
  reporté. Push uniquement ce round.
- **Upsert abonnement via pool admin** : la RLS bloque la réassignation d'un endpoint partagé
  cross-user → `subscribe` passe par le pool admin (comme session/invitations) ; lectures/suppressions
  restent RLS.

## Parcours à valider par toi

1. **Activer les notifications sur ton téléphone** : installe MyDay sur l'écran d'accueil, ouvre-la →
   Réglages → « Notifications sur cet appareil » → « Activer » → autorise. Tu dois voir « Notifications
   activées sur cet appareil ».
2. **Recevoir une vraie notification** : sur ton téléphone (app fermée possible), attends un mail
   important, un brief prêt, ou un événement dans 30 min → une notification apparaît ; le clic ouvre
   MyDay sur la bonne page.
3. **Recherche via la loupe** : clique la loupe (ou ⌘/) → tape un mot présent dans tes mails/notes →
   résultats groupés → clic → navigation vers la bonne page.

BEGIN_QA_RESULT_JSON
{
"schema": "reborn.qa.testRound.result.v1",
"roundId": "009",
"mode": "happy-path-and-adversarial",
"verdict": "PASS",
"validatedByExtension": false,
"iterations": 1,
"findings": []
}
END_QA_RESULT_JSON
