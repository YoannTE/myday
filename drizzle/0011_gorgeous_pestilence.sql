CREATE TABLE "note_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nom" text NOT NULL,
	"couleur" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "categorie_id" uuid;--> statement-breakpoint
ALTER TABLE "note_categories" ADD CONSTRAINT "note_categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_categories_user_id_idx" ON "note_categories" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "note_categories_user_id_nom_unique" ON "note_categories" USING btree ("user_id","nom");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_categorie_id_note_categories_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."note_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_categorie_id_idx" ON "notes" USING btree ("categorie_id");
--> statement-breakpoint

ALTER TABLE "note_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "note_categories_user_isolation" ON "note_categories"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "note_categories" TO app_rls;