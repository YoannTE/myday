# Mémoire lead-dev — MyDay

Index des mémoires réutilisables pour les revues du projet MyDay.

- [Projet MyDay](project-myday.md) — cockpit perso unifié Google+IA, MVP F1-F13, blocages techniques clés
- [Risques Google OAuth restreint](risk-google-oauth-restricted.md) — scopes Gmail/Agenda = vérification + expiration refresh token
- [Risques sync bidirectionnelle](risk-bidirectional-sync.md) — doublons, conflits, curseurs incrémentaux
- [Contrainte Agent Platform single-worker](constraint-agent-platform-runtime.md) — --workers 1, SOP 10 port 6432
- [Pièges bootstrap dual-stack](pitfalls-dualstack-bootstrap.md) — seed idempotent, cookie cross-stack signé, migrations au boot, admin prod, CORS
- [Pièges comptes/invitations](pitfalls-invitations-accounts.md) — statuts ASCII, cascade user, TOCTOU jeton, dernier-admin, révocation session
- [Dérives sync R003](risk-sync-schema-drift.md) — mails CHECK sans archived_remote, events sans clientUuid, RLS vs pool admin, refresh concurrent + gather asyncpg
