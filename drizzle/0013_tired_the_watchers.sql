CREATE TABLE "note_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"contenu" text NOT NULL,
	"coche" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note_items" ADD CONSTRAINT "note_items_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_items" ADD CONSTRAINT "note_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_items_user_id_idx" ON "note_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_items_note_id_idx" ON "note_items" USING btree ("note_id");
--> statement-breakpoint

ALTER TABLE "note_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "note_items_user_isolation" ON "note_items"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "note_items" TO app_rls;