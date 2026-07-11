# Rapport de test — Round 006 « L'IA entre en scène : tri des mails »

**Date** : 2026-07-11
**Verdict** : PASS
**Itérations** : 1 (0 bug bloquant ; 2 findings mineurs corrigés)
**Stack** : dual-stack (Next.js 16 :3000 + FastAPI :8000 + Postgres + MinIO)
**Mode** : « SANS plateforme Core » (tri = service FastAPI normal) + « règles d'abord, IA plus tard »
(pas de clé `ANTHROPIC_API_KEY` → fallback heuristique = chemin nominal, prêt-pour-IA).

## Smoke

| Test | Résultat |
|---|---|
| Backend `pytest -q` | **160 passed** (11 nouveaux triage + tests mails/feedback/cockpit) |
| Backend `ruff check app` | All checks passed |
| Frontend `npx tsc --noEmit` | 0 erreur |
| Frontend `npm run build` | Succès (`/mails` généré) |
| Endpoints protégés sans cookie (`/api/mails`, `POST /api/triage/refresh`, `/api/mails/{id}/feedback`) | 401 |
| `/health` | 200 |

## Docker

N/A applicatif (Postgres + MinIO via compose). E2E réel exécuté par le lead (voir ci-dessous).

## Tri réel end-to-end (lead, sur les 24 mails du Round 003)

- `run_mail_triage` sur 24 mails `pending_triage` → **processed 24, important_count 12,
  skipped_prefilter 3, llm_calls 0** (fallback heuristique, sans clé — correct). Tous → `triaged`.
- Scores heuristiques : action_keywords → 70, known_sender → 65, newsletter/no-reply → 15
  (« Score automatique (règles) »). Limite assumée du mode règles : PayPal/Boulanger surestimés
  (le LLM affinerait) — le feedback utilisateur corrige.
- **Notifications plafonnées** : 3 créées (sur 12 importants, plafond `max_push_per_hour=3`).
- **Idempotence** : re-run → processed 0, notifications inchangées (aucun doublon).
- **Aucune PII** dans les logs (grep sujet/expéditeur/extrait/contenu → 0).

## Playwright / Smoke navigateur (lead)

- Page `/mails` : liste scorée (badges score), filtres « Importants / Tous », « 12 mails écartés
  par le tri · voir », lien « Mails » dans la navbar. Mail ouvert : **EXTRAIT** (pas de résumé IA
  en mode règles, sans message d'erreur) + « SCORE 70 · Score automatique (règles) » + boutons
  Important / Pas important.
- **Boucle de feedback validée** : « Pas important » sur setclub → `sender_preferences` =
  `communication@setclub.com | muet` (email normalisé depuis le From brut) + mail reclassé
  immédiatement à **score 5 · « Expéditeur en sourdine »** (correction #4).
- Design AEVIO (bleu, aucun vert), mobile-first.

## Adversarial (qa-tester) — 12 corrections vérifiées

Trigger tri hors verrou sync (après `finalize_sync`) ; advisory lock anti-concurrent ;
`notifications.contenu` jamais NULL ; feedback reclasse les mails triaged du même expéditeur ;
normalisation email unique réutilisée ; persist `UPDATE ... FROM (VALUES ...)` par ligne ; seuil
unique `settings.triage_importance_threshold` ; prompts sans to_type/corps ; client Anthropic sans
`response_format`, clé vide → 0 appel réseau (testé avec `anthropic` poisonné) ; `cost_usd` jamais
fabriqué ; statut `muet` (pas `muted`) ; séquencement `main.py`. PII logs clean. Idempotence testée.

## Bugs trouvés (2, corrigés)

1. **[LOW]** `persistence.py::queue_notifications` ignorait la préférence utilisateur
   `notif_important_mail` (Round 005) — un utilisateur ayant désactivé « notifications mails
   importants » aurait quand même reçu des rows. **Corrigé** : lecture de `user_preferences.
   notif_important_mail`, skip si `false`. pytest 160 toujours vert.
2. **[TRÈS BAS]** `src/components/cockpit/types.ts` : `MailsImportantsData.mails` déclaré
   non-optionnel alors que le backend omet la clé quand `placeholder=true`. **Corrigé** :
   `mails?: Mail[]` + guard `?? []` côté cockpit-client. tsc vert.

## Parcours à valider par toi

Aucun parcours automatisable manquant pour ce round (mode règles = chemin nominal, pas d'email/
paiement/OAuth réel à tester ; le smoke navigateur du tri et du feedback est fait).

**Bon à savoir (rien à tester)** : le tri fonctionne aujourd'hui avec des règles (expéditeur connu,
mots d'action, newsletters). Le jour où tu fourniras une **clé Anthropic**, le score devient plus
fin et un **vrai résumé** de chaque mail important remplace automatiquement l'extrait brut — sans
aucune autre modification. (Ajout dans `.env.local` : `ANTHROPIC_API_KEY=...`.)

BEGIN_QA_RESULT_JSON
{
"schema": "reborn.qa.testRound.result.v1",
"roundId": "006",
"mode": "happy-path-and-adversarial",
"verdict": "PASS",
"validatedByExtension": false,
"iterations": 1,
"findings": [
{"severity": "low", "file": "backend/app/services/mail_triage/persistence.py", "status": "fixed", "description": "queue_notifications respecte désormais user_preferences.notif_important_mail"},
{"severity": "very-low", "file": "src/components/cockpit/types.ts", "status": "fixed", "description": "MailsImportantsData.mails rendu optionnel + guard"}
]
}
END_QA_RESULT_JSON
