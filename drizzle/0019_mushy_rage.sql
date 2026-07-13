CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demandeur_id" text NOT NULL,
	"destinataire_id" text NOT NULL,
	"statut" text DEFAULT 'en_attente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_statut_check" CHECK ("contacts"."statut" IN ('en_attente', 'accepte')),
	CONSTRAINT "contacts_pas_soi_meme_check" CHECK ("contacts"."demandeur_id" <> "contacts"."destinataire_id")
);
--> statement-breakpoint
CREATE TABLE "partages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proprietaire_id" text NOT NULL,
	"cible_id" text NOT NULL,
	"element_type" text NOT NULL,
	"element_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partages_element_type_check" CHECK ("partages"."element_type" IN ('event', 'task', 'note')),
	CONSTRAINT "partages_pas_soi_meme_check" CHECK ("partages"."proprietaire_id" <> "partages"."cible_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_demandeur_id_user_id_fk" FOREIGN KEY ("demandeur_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_destinataire_id_user_id_fk" FOREIGN KEY ("destinataire_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partages" ADD CONSTRAINT "partages_proprietaire_id_user_id_fk" FOREIGN KEY ("proprietaire_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partages" ADD CONSTRAINT "partages_cible_id_user_id_fk" FOREIGN KEY ("cible_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_paire_unique" ON "contacts" USING btree ("demandeur_id","destinataire_id");--> statement-breakpoint
CREATE INDEX "contacts_destinataire_idx" ON "contacts" USING btree ("destinataire_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partages_unique" ON "partages" USING btree ("proprietaire_id","cible_id","element_type","element_id");--> statement-breakpoint
CREATE INDEX "partages_cible_idx" ON "partages" USING btree ("cible_id");--> statement-breakpoint
CREATE INDEX "partages_element_idx" ON "partages" USING btree ("element_type","element_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" IN ('mail_important', 'rappel_evenement', 'rappel_tache', 'tache_planifiee', 'brief_pret', 'contact_demande', 'contact_accepte', 'partage_recu'));
--> statement-breakpoint

-- ====================================================================
-- RLS du partage (Round 016).
-- contacts/partages : visibles par les deux participants uniquement.
-- events/tasks/notes/note_items : policies FOR SELECT supplementaires qui
-- ouvrent la LECTURE des elements partages au destinataire. Les policies
-- d'isolation existantes (user_isolation, FOR ALL) restent les seules a
-- couvrir INSERT/UPDATE/DELETE : le partage est en lecture seule, garanti
-- par Postgres lui-meme.
-- ====================================================================

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "contacts_participants" ON "contacts"
  USING (
    "demandeur_id" = current_setting('app.current_user_id', true)
    OR "destinataire_id" = current_setting('app.current_user_id', true)
  );
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contacts" TO app_rls;
--> statement-breakpoint

ALTER TABLE "partages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "partages_participants" ON "partages"
  USING (
    "proprietaire_id" = current_setting('app.current_user_id', true)
    OR "cible_id" = current_setting('app.current_user_id', true)
  );
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "partages" TO app_rls;
--> statement-breakpoint

CREATE POLICY "events_partages_select" ON "events" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'event'
        AND p."element_id" = "events"."id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "tasks_partages_select" ON "tasks" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'task'
        AND p."element_id" = "tasks"."id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "notes_partages_select" ON "notes" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'note'
        AND p."element_id" = "notes"."id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "note_items_partages_select" ON "note_items" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "partages" p
      WHERE p."element_type" = 'note'
        AND p."element_id" = "note_items"."note_id"
        AND p."cible_id" = current_setting('app.current_user_id', true)
    )
  );