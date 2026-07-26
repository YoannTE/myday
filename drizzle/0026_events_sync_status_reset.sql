-- ====================================================================
-- Retrait temporaire de Google : deblocage des evenements « Non synchronise ».
--
-- Contexte : depuis le retrait de l'integration Gmail / Agenda (decisions.md,
-- 2026-07-25), le scheduler de synchronisation ne tourne plus. Les evenements
-- crees alors qu'une ancienne ligne `google_connections` trainait encore en
-- base sont restes bloques en `sync_pending` / `sync_error`, et affichaient le
-- badge « Non synchronise » a vie puisque plus aucun run ne pouvait les
-- resorber.
--
-- Consequence assumee : ces evenements ne seront PAS remontes retroactivement
-- vers Google le jour ou l'integration sera reactivee (ils sont consideres
-- comme purement locaux). Pour les remonter, il faudra les repasser
-- explicitement en `sync_pending` a ce moment-la.
-- ====================================================================

UPDATE "events"
SET "sync_status" = 'synced',
    "updated_at" = now()
WHERE "sync_status" IN ('sync_pending', 'sync_error');
