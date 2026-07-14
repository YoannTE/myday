-- ====================================================================
-- Partage collaboratif (Round 016 v2) : les elements partages deviennent
-- MODIFIABLES par le destinataire (plus seulement lisibles).
--
-- Regles :
-- - UPDATE ouvert au destinataire sur events/tasks/notes partages ;
-- - la SUPPRESSION reste reservee au proprietaire (aucune policy DELETE) ;
-- - note_items : l'autorisation derive de la note parente (celui qui peut
--   modifier la note peut ajouter/cocher/editer/supprimer ses elements,
--   y compris ceux crees par l'autre participant) ;
-- - les restrictions de champs (categorie, epinglee, rappels...) sont
--   appliquees cote services (400 explicite pour un non-proprietaire).
-- ====================================================================

CREATE POLICY "events_partages_update" ON "events" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'event'
        AND p."element_id" = "events"."id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "tasks_partages_update" ON "tasks" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'task'
        AND p."element_id" = "tasks"."id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "notes_partages_update" ON "notes" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'note'
        AND p."element_id" = "notes"."id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint

-- Elements de note : visibilite et edition derivees de la note parente.
-- (Le proprietaire de la note voit et gere aussi les elements crees par le
-- destinataire, dont user_id est celui du createur.)
CREATE POLICY "note_items_via_note_select" ON "note_items" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "notes" n
      WHERE n."id" = "note_items"."note_id"
        AND n."user_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "note_items_partages_insert" ON "note_items" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'note'
        AND p."element_id" = "note_items"."note_id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "note_items_edition_update" ON "note_items" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "notes" n
      WHERE n."id" = "note_items"."note_id"
        AND n."user_id" = current_setting('app.current_user_id', true)
    )
    OR EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'note'
        AND p."element_id" = "note_items"."note_id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "note_items_edition_delete" ON "note_items" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "notes" n
      WHERE n."id" = "note_items"."note_id"
        AND n."user_id" = current_setting('app.current_user_id', true)
    )
    OR EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'note'
        AND p."element_id" = "note_items"."note_id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
