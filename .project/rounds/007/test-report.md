# Rapport de test — Round 007 « Brief IA quotidien »

**Date** : 2026-07-11
**Verdict** : PASS
**Itérations** : 1 (0 bug bloquant ; 2 findings corrigés)
**Stack** : dual-stack (Next.js 16 :3000 + FastAPI :8000 + Postgres + MinIO)
**Mode** : « SANS Core » (service FastAPI) + « règles d'abord » (pas de clé `ANTHROPIC_API_KEY` →
brief dégradé « express » sans IA = chemin nominal, prêt-pour-IA).

## Smoke

| Test | Résultat |
|---|---|
| Backend `pytest -q` | **172 passed** (12 nouveaux daily_brief) |
| Backend `ruff check app` | All checks passed |
| Frontend `npx tsc --noEmit` | 0 erreur |
| Frontend `npm run build` | Succès |
| Migration `\d user_preferences` | `brief_tone` NOT NULL default 'neutre' + CHECK (neutre/motivant/direct), RLS active, journalisée `0006_fuzzy_gwen_stacy.sql` |
| `POST /api/brief/generate` sans cookie | 401 |
| `/health` | 200 |

## Brief réel end-to-end (lead + qa-tester, session admin)

- `POST /api/brief/generate` (manual) → 200 `{brief_id, generated:true, degraded:true}` — brief
  inséré, `contenu` jsonb structuré (headline, priorities, schedule_summary, tasks_summary,
  mails_summary, alerts) citant les vrais mails/tâches de l'admin.
- Re-génération immédiate → **429** « Un brief vient d'être généré, réessaie dans une minute »
  (anti-spam confirmé).
- `GET /api/cockpit` → clé `brief` présente et désérialisée (`json.loads`, pas de string brute).
- **Carte hero cockpit** (smoke navigateur lead) : badge « Brief · 12:27 » + libellé discret
  « Brief express » (dégradé, gris, pas d'alarme), headline « Voici ta journée en un coup d'œil. »,
  3 priorités numérotées, synthèses Planning/Tâches/Mails, alerte « Données non actualisées depuis
  4 h. », bouton « Régénérer ».
- **PII** : logs uvicorn = `user_id`, `trigger`, `brief_date`, `degraded`, nom d'exception — aucun
  contenu de brief/mail/événement. Conforme.

## Adversarial (qa-tester) — 9 corrections vérifiées

Validation `BriefContentModel(**dict)` (complete_json renvoie un dict brut) ; jsonb `json.dumps`+
`::jsonb` / `json.loads` ; scheduler `max_instances=1`/`coalesce` + `asyncio.wait_for` + try/except
par user + liste `WHERE onboarding_completed=true` ; upsert `ON CONFLICT ... WHERE type='quotidien'` ;
`today_local` cockpit depuis `user_preferences.timezone` ; garde-fou anti-hallucination sur chemin
LLM uniquement ; anti-spam 429 ; ton depuis `user_preferences.brief_tone`. Idempotence upsert +
notif `ON CONFLICT DO NOTHING` + `usage_events brief_generated`. Mapping trigger→type correct.

## Bugs trouvés (2, corrigés)

1. **[MOYEN]** `compose.py` : le `except` ne capturait que `(LlmUnavailable, ValidationError,
   TypeError, ValueError)` — une vraie erreur Anthropic (timeout, `APIError`, rate-limit) serait
   remontée non catchée (500) au lieu du brief dégradé, une fois une clé configurée. Latent sans clé
   (chemin nominal), mais casse la promesse « prêt-pour-IA / filet dégradé systématique ». **Corrigé** :
   `except Exception` (log du nom d'exception uniquement, pas de PII). SOP `agent-design-to-fastapi-
   service` mis à jour pour prévenir la récurrence (Round 008).
2. **[BAS]** `etape-finale.tsx` : le texte annonçait « ton brief arrive très bientôt » alors que
   R007 génère le brief à ce clic (trigger onboarding). Trompeur. **Corrigé** : « ton tout premier
   brief vient d'être préparé » / badge « Brief · prêt » / « il t'attend en haut du cockpit ».

## Parcours à valider par toi

1. **Le premier brief à la fin de l'inscription**
   - Où aller : refais l'onboarding (ou depuis un compte non terminé), va jusqu'à « Ouvrir mon cockpit »
   - Ce que tu dois voir : le texte dit maintenant que ton premier brief est prêt ; en arrivant sur
     le cockpit, la carte Brief en haut est déjà remplie.

2. **La carte Brief du cockpit avec tes vraies données**
   - Où aller : la page d'accueil, tout en haut
   - Ce que tu dois voir : une accroche, jusqu'à 3 priorités, un résumé planning/tâches/mails, et 0-2
     alertes. Dis-moi si ça se lit vite et sonne juste (ou trop robotique — c'est normal en mode règles).

3. **Le badge « Brief express »**
   - Où aller : à côté de l'heure sur la carte Brief
   - Ce que tu dois voir : un petit badge gris discret « Brief express ». C'est le signe que le brief
     est assemblé sans IA (pas de clé). **Dès que tu ajoutes une clé Anthropic** (`ANTHROPIC_API_KEY`
     dans `.env.local`), ce badge disparaît et le brief est rédigé finement (accroche + priorités
     croisées mails/tâches/agenda).

BEGIN_QA_RESULT_JSON
{
"schema": "reborn.qa.testRound.result.v1",
"roundId": "007",
"mode": "happy-path-and-adversarial",
"verdict": "PASS",
"validatedByExtension": false,
"iterations": 1,
"findings": [
{"severity": "medium", "file": "backend/app/services/daily_brief/compose.py", "status": "fixed", "description": "except élargi à Exception → brief dégradé sur toute défaillance LLM (y compris erreurs Anthropic réseau/API)"},
{"severity": "low", "file": "src/components/onboarding/etape-finale.tsx", "status": "fixed", "description": "copy corrigée : le brief est prêt (généré à l'étape finale), plus « arrive bientôt »"}
]
}
END_QA_RESULT_JSON
