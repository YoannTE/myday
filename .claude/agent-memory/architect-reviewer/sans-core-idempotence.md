---
name: sans-core-idempotence
description: En mode « SANS Core » (service FastAPI sans durabilité DBOS), les clés d'idempotence générées par le LLM ne sont pas stables entre re-runs — dédupliquer au niveau endpoint
metadata:
  type: project
---

Quand un agent-design prévu pour DBOS est ré-implémenté en service FastAPI « SANS Core »
(pas de `wait_for_review` durable, pas de memoization DBOS des steps), les garanties de
reprise/idempotence du design NE tiennent PLUS telles quelles.

Piège principal : un `action_key`/`draft_id` généré par le LLM dans `plan_actions` n'est
**pas stable** entre deux exécutions du même message (chaque run rappelle le LLM → nouveaux
UUID). Les contraintes d'unicité `(user_id, assistant_action_key)` (tasks), `note_appends`,
etc. ne protègent donc pas d'un double-submit / double-clic.

**How to apply :** la déduplication doit se faire à l'ENTRÉE de l'endpoint via
`(conversation_id, turn_key)` — SELECT du tour existant AVANT tout appel LLM/action, et
court-circuit renvoyant le résultat stocké. Dériver les `action_key` de `turn_key + index`
plutôt que d'un UUID LLM aléatoire. Voir [[mail-send-at-most-once]] pour le cas envoi.
La table `events` n'a PAS de colonne/clé d'idempotence assistant (contrairement à `tasks`
et `note_appends`) — seule la dédup endpoint la protège.
