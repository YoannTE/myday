CREATE TABLE "task_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nom" text NOT NULL,
	"couleur" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "categorie_id" uuid;--> statement-breakpoint
ALTER TABLE "task_categories" ADD CONSTRAINT "task_categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_categories_user_id_idx" ON "task_categories" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_categories_user_id_nom_unique" ON "task_categories" USING btree ("user_id","nom");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_categorie_id_task_categories_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."task_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_categorie_id_idx" ON "tasks" USING btree ("categorie_id");
--> statement-breakpoint

ALTER TABLE "task_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_categories_user_isolation" ON "task_categories"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "task_categories" TO app_rls;