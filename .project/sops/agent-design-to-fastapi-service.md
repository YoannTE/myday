# SOP — Transposer un agent-design (agent-platform) en service FastAPI sans Core

**ID** : backend-agent-design-to-fastapi-service
**Catégorie** : Backend
**Difficulté** : advanced
**Tags** : agent-platform, sans-core, workflow, llm, anthropic, fallback, prêt-pour-ia, mail-triage
**Créé le** : 2026-07-11
**Origine** : Round 006 (mail_triage) — 1er round IA, décision « SANS plateforme Core »

## Contexte

Décision projet (decisions.md, 2026-07-10) : **aucun Core Reborn Agents accessible** (pas d'URL,
pas de master key, SDK inutilisable). Les workflows conçus dans `.project/agent-designs/*.md`
(avec `@workflow`/`@step`/`@configurable`/`agent_platform.llm`/DBOS) restent la **spécification
fonctionnelle de référence**, mais sont **implémentés en services FastAPI Python normaux**.
Ce SOP resservira à chaque round IA (`daily_brief`, `assistant_conversationnel`).

## Table de transposition (design SDK → service normal)

| Design agent-platform | Implémentation « sans Core » |
| --- | --- |
| `@workflow(name=...)` async fn | `async def run_<workflow>(user_id, ..., trigger)` dans `backend/app/services/<workflow>/orchestrator.py` |
| `@step(retry, timeout)` | fonction async normale ; retry/timeout gérés à la main si nécessaire (souvent inutile au volume MVP) |
| `@configurable({...})` (dashboard Core) | constantes dans `backend/app/config.py` (`<workflow>_*`), surchargeables par env. Exposition Core différée. |
| `agent_platform.llm.parse(schema=...)` | client LLM maison (voir ci-dessous) + parse Pydantic manuel |
| `events.set_step_summary(...)` / `events.emit(...)` | supprimés (pas de vue Op) ; garder des logs structurés SANS PII |
| Persistance/reprise DBOS | idempotence par contrainte d'unicité BDD + UPSERT / `ON CONFLICT` |
| `wait_for_input`/HITL | endpoints FastAPI + statut BDD (ex. brouillon `pending_review`) |
| Advisory anti-rejeu DBOS | `pg_try_advisory_lock(hashtext('<workflow>:'||user_id))` best-effort |

**Le fichier de design reste la source de vérité** pour : barème, prompts système/template,
schémas Pydantic de sortie, stratégie de fallback, failure modes, et la liste des tests requis.

## Client LLM « prêt-pour-IA » à dégradation gracieuse (pattern clé)

Objectif : le round fonctionne SANS clé (fallback), et bascule en IA par la SEULE présence de
`ANTHROPIC_API_KEY`, sans autre changement de code.

```python
# services/<workflow>/llm.py
class LlmUnavailable(Exception): ...

def _build_client():
    key = settings.anthropic_api_key
    if not key:                       # clé vide → JAMAIS d'appel réseau
        raise LlmUnavailable()
    from anthropic import AsyncAnthropic   # import LOCAL
    return AsyncAnthropic(api_key=key)

async def complete_json(model, system, user, schema):
    client = _build_client()          # lève LlmUnavailable si pas de clé
    resp = await client.messages.create(model=model, max_tokens=..., messages=[...])
    # PAS de response_format (param OpenAI, inexistant chez Anthropic) :
    # JSON obtenu par consigne de prompt + parse Pydantic manuel (1 re-tentative).
    ...
```

Côté appelant : `complete_json` renvoie un **dict brut** (pas de validation Pydantic). Donc :
valider soi-même `MonModel(**data)`, puis **catcher largement** pour retomber sur le fallback :
```python
try:
    raw = await complete_json(user_id=..., agent="<workflow>", model=..., system=..., user_prompt=...)
    parsed = MonModel(**raw)          # validation du schéma
    return parsed.model_dump(), False
except Exception as exc:              # filet SYSTÉMATIQUE : clé absente, JSON/schéma invalide,
    logger.info("... raison=%s", type(exc).__name__)   # ET erreurs Anthropic réseau/API/rate-limit
    return build_fallback(...), True
```
**Piège (Round 007)** : catcher seulement `(LlmUnavailable, ValidationError)` laisse remonter les
erreurs Anthropic génériques (timeout, `APIError`, rate-limit) en 500 une fois la clé activée →
casse la promesse « fallback = filet systématique ». Catcher `Exception` (en ne loggant que le nom
d'exception, jamais de PII). Tester explicitement le chemin « clé absente → 0 appel réseau »
(poisonner `sys.modules["anthropic"]` pour prouver qu'il n'est jamais importé).

Pièges Anthropic : `max_tokens` **obligatoire** ; pas de `response_format` ; l'API renvoie les
**tokens** pas le coût → `llm_usage.cost_usd` calculé via table de prix par modèle, sinon `'0'`
(jamais fabriqué).

## Invariants à ne PAS perdre à la transposition

- **Cloisonnement PII** : contenu métier (mails, texte) uniquement en BDD + appels LLM ; JAMAIS
  dans les logs (logger seulement `user_id`, `trigger`, compteurs, ids).
- **Idempotence** : UPSERT/`ON CONFLICT` sur la clé naturelle ; re-run sans doublon (tester).
- **Non bloquant** : un déclenchement depuis un autre workflow (ex. `google_sync`) ne doit jamais
  casser l'appelant (`try/except`, et **hors verrou** de l'appelant — cf. SOP verrou sync).
- **Respect des préférences utilisateur** : un flag global de config ne remplace PAS une
  préférence par-utilisateur (ex. `user_preferences.notif_important_mail`) — vérifier les deux.
- **Adapter aux données réellement disponibles** : ne pas transposer un prompt qui référence des
  champs absents du schéma (ex. `to_type`, corps complet) — sinon le « prêt-pour-IA » est faux.

## Durcissements découverts quand la vraie clé arrive (Round 008)

Ces bugs ne se voient PAS tant que la clé est absente (les tests mockent) — ils surgissent au
premier vrai appel LLM et cassent TOUTES les features IA à la fois :

1. **Extraction JSON robuste** : `json.loads(text)` brut échoue — les modèles entourent souvent le
   JSON de ```json fences ou d'une phrase. `complete_json` doit extraire : (1) texte brut, (2) contenu
   d'un bloc ```…```, (3) sous-chaîne du 1er `{`/`[` au dernier `}`/`]`. (Fait dans `mail_triage/llm.py`.)
2. **Tests offline par défaut** : dès qu'une `ANTHROPIC_API_KEY` réelle est dans `.env.local`, les
   tests du chemin fallback partent en vrai appel réseau (lents, non déterministes, échecs). Fixture
   `autouse` dans `conftest.py` : `monkeypatch.setattr(settings, "anthropic_api_key", "")`. Les tests
   du chemin LLM mockent `complete_json` explicitement.
3. **Contexte temporel** : un planificateur/rédacteur LLM ne connaît pas la date → il ne résout pas
   « vendredi »/« demain » et demande une clarification. Injecter date+heure (timezone user) dans le
   user prompt.
4. **Tolérance de clés** : le modèle renvoie parfois `"action"` au lieu de `"type"` (ou variantes).
   Expliciter le format EXACT dans le prompt (avec un exemple JSON complet) ET lire de façon tolérante
   côté code (`raw.get("type") or raw.get("action")`).
5. **Modèle** : vérifier l'ID de modèle réellement servi (ex. `claude-haiku-4-5-20251001` a répondu ;
   valider par un appel réel « réponds OK » avant de bâtir dessus).

## Découpage & tests

- Un fichier par responsabilité (`normalize`, `prefilter`, `scoring`, `summaries`, `persistence`,
  `orchestrator`, `llm`), ≤150 lignes.
- Tests : happy path **en mode fallback** (chemin nominal tant qu'il n'y a pas de clé), pré-filtre
  pur, dégradation LLM (0 appel réseau), idempotence, plafonds, RLS cross-user. Ne PAS dépendre
  d'un appel LLM réel (mock ou clé absente).
