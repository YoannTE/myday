---
name: llm-client-contract
description: Contrat du client LLM réutilisable mail_triage/llm.py (complete_json) — renvoie un dict brut, aucune validation de schéma
metadata:
  type: project
---

Le client LLM gracieux `backend/app/services/mail_triage/llm.py` est le client
réutilisé par tous les services IA "sans plateforme Core" (mail_triage, daily_brief…).

- `complete_json(*, user_id, agent, model, system, user_prompt, max_tokens=2000) -> dict`.
- Clé `anthropic_api_key` vide → `LlmUnavailable` levée immédiatement (0 appel réseau) → chemin dégradé nominal.
- Il fait déjà **1 re-tentative interne** sur JSON non parsable, puis lève `LlmUnavailable`.
- Il **ne prend PAS de paramètre `schema`** et renvoie `json.loads(text)` brut : **aucune validation Pydantic**.
- Enregistre systématiquement les tokens dans `llm_usage` (colonne `agent` = discriminant par service).

**How to apply :** tout appelant doit valider lui-même le dict retourné contre son
modèle Pydantic et traiter `ValidationError` **au même titre que** `LlmUnavailable`
comme déclencheur du fallback dégradé. Le design SDK (`llm.parse(..., schema=...)`)
ne correspond PAS à ce client — c'est l'API agent-platform, pas le service FastAPI normal.
Passer `agent="<nom_service>"` pour tracer le coût. Voir [[api-casing-contract]].
