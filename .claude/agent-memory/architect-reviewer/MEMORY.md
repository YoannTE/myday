# Index mémoire — architect-reviewer (MyDay)

- [Pattern RLS du projet](rls-pattern.md) — role app_rls, scoped_connection, policies USING-only, default privileges
- [Piège migrations Drizzle manuelles](drizzle-manual-migrations.md) — SQL hors _journal.json silencieusement ignoré par db:migrate
- [Contrat de casse API](api-casing-contract.md) — snake_case de bout en bout, apiCall ne transforme rien
- [Contraintes notifications/sender_prefs](notifications-contract.md) — contenu NOT NULL, usage_events fermé au tri, normaliser expediteur→email
- [Contrat client LLM](llm-client-contract.md) — complete_json renvoie un dict brut sans validation schéma, valider Pydantic côté appelant
- [Idempotence SANS Core](sans-core-idempotence.md) — clés LLM non stables sans DBOS, dédup à l'endpoint via turn_key
- [Envoi mail au plus une fois](mail-send-at-most-once.md) — fenêtre ambiguë → sending_unconfirmed + reconciliation rfc822msgid, pas retour pending_review
