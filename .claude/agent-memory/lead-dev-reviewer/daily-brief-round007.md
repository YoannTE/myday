---
name: daily-brief-round007
description: Pièges de faisabilité du Round 007 « Brief IA quotidien » (SANS Core) — LLM client réel, jsonb asyncpg, scheduler, idempotence
metadata:
  type: project
---

# Round 007 « Brief IA quotidien » (dual-stack, SANS Core, règles d'abord)

**Contexte** : brief dégradé (sans clé Anthropic) = chemin NOMINAL. Réutilise
`backend/app/services/mail_triage/llm.py`. Pas d'agent-platform SDK.

**Why** : les designs `.project/agent-designs/*.md` décrivent l'API SDK
agent-platform (`llm.parse`, `@configurable`, `@safe_step`, `@step`) alors que
le projet tourne SANS Core = FastAPI normal. Le design est une spec
FONCTIONNELLE, pas exécutable tel quel.

**How to apply** — pièges récurrents à re-vérifier sur tout round « IA » MyDay :

- **`complete_json` réel** : `complete_json(*, user_id, agent, model, system,
  user_prompt, max_tokens=2000) -> dict`. PAS de param `schema` Pydantic, PAS
  de `response_format`. Retourne un dict brut (`json.loads`), retente en
  interne uniquement le JSON malformé, lève `LlmUnavailable`. → l'appelant doit
  faire `Model.model_validate(dict)` lui-même et catcher
  `(LlmUnavailable, ValidationError)` pour partir en dégradé. Écrit déjà dans
  `llm_usage` via sa propre `scoped_connection` → ne pas envelopper
  l'orchestrateur dans une seule scoped_connection.
- **jsonb + asyncpg** : `db/client.py create_pool()` n'enregistre AUCUN codec
  jsonb. Écriture = `json.dumps(x)` + bind `$n::jsonb` (cf. `usage.py`).
  Lecture = la colonne remonte en `str` → `json.loads()` obligatoire avant de
  renvoyer au front. Trap classique sur toute colonne jsonb (`briefs.contenu`).
- **Scheduler périodique** : pattern `google/scheduler.py` = `AsyncIOScheduler`,
  `max_instances=1, coalesce=True`, liste users cross-tenant via
  `get_admin_pool()` (les tables sous RLS ne sont pas lisibles par le pool
  app_rls sans user courant), timeout par run (`asyncio.wait_for`) + try/except
  par user dans la boucle. Tout nouveau scheduler doit copier ces 4 gardes.
  Sans clé LLM le run est rapide ; avec clé (45s/run) le séquentiel N users
  peut dépasser l'intervalle → timeout par run indispensable.
- **Upsert index partiel Postgres** : répéter le prédicat de l'index dans le
  `ON CONFLICT ... WHERE`. `briefs` : `ON CONFLICT (user_id, brief_date) WHERE
  type='quotidien' DO UPDATE SET ..., generated_at = now()`. Ne pas oublier de
  ré-setter `generated_at` dans le DO UPDATE.
- **Contraintes déjà posées (systeme.ts)** : `notifications.type` CHECK inclut
  `brief_pret`, unique `(user_id, ref_id, type)` ; `usage_events.type` CHECK
  inclut `brief_generated`/`brief_opened`. Pas de migration systeme pour le
  brief — seule migration réelle = `brief_tone` sur `user_preferences`.
  `create_usage_event` refuse `task_completed` mais accepte `brief_generated`.
- **Fuseau** : `cockpit._day_bounds()` utilise `settings.app_timezone` (global),
  mais le brief est daté en `user_preferences.timezone`. Incohérence de date
  autour de minuit pour users hors Europe/Paris → filtrer le brief du jour en
  timezone user.
- **Anti-spam manuel** : contrôle SELECT-puis-INSERT sur `briefs a_la_demande`
  généré < 60s = TOCTOU (2 POST → 2 briefs + 2 appels LLM payants). Advisory
  lock si le coût compte, sinon assumer. Robuste au restart (basé BDD).
