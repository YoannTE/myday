CREATE TABLE "budget_acces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"tentatives" integer DEFAULT 0 NOT NULL,
	"bloque_jusqua" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_comptes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"libelle" text NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"date_releve" date,
	"position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date_operation" date NOT NULL,
	"libelle" text NOT NULL,
	"categorie" text NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"sens" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_operations_sens_check" CHECK ("budget_operations"."sens" IN ('entree', 'sortie')),
	CONSTRAINT "budget_operations_montant_check" CHECK ("budget_operations"."montant" >= 0)
);
--> statement-breakpoint
CREATE TABLE "budget_previsions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"libelle" text NOT NULL,
	"categorie" text NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"sens" text NOT NULL,
	"echeance" text,
	"fait" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_previsions_sens_check" CHECK ("budget_previsions"."sens" IN ('entree', 'sortie')),
	CONSTRAINT "budget_previsions_montant_check" CHECK ("budget_previsions"."montant" >= 0),
	CONSTRAINT "budget_previsions_echeance_check" CHECK ("budget_previsions"."echeance" IS NULL OR "budget_previsions"."echeance" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "budget_recurrents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"libelle" text NOT NULL,
	"categorie" text NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"sens" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_recurrents_sens_check" CHECK ("budget_recurrents"."sens" IN ('entree', 'sortie')),
	CONSTRAINT "budget_recurrents_montant_check" CHECK ("budget_recurrents"."montant" >= 0)
);
--> statement-breakpoint
ALTER TABLE "budget_acces" ADD CONSTRAINT "budget_acces_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_comptes" ADD CONSTRAINT "budget_comptes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_operations" ADD CONSTRAINT "budget_operations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_previsions" ADD CONSTRAINT "budget_previsions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_recurrents" ADD CONSTRAINT "budget_recurrents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_acces_user_id_unique" ON "budget_acces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budget_comptes_user_id_idx" ON "budget_comptes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budget_operations_user_id_idx" ON "budget_operations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budget_operations_date_idx" ON "budget_operations" USING btree ("date_operation");--> statement-breakpoint
CREATE INDEX "budget_previsions_user_id_idx" ON "budget_previsions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budget_previsions_echeance_idx" ON "budget_previsions" USING btree ("echeance");--> statement-breakpoint
CREATE INDEX "budget_recurrents_user_id_idx" ON "budget_recurrents" USING btree ("user_id");
--> statement-breakpoint

-- ====================================================================
-- Row Level Security - section Budget (meme convention que 0002_enable_rls.sql).
-- drizzle-kit ne genere ni les policies ni les grants : ils sont ajoutes ici,
-- a la fin du fichier GENERE (donc deja present dans _journal.json), pour que
-- `db:migrate` les applique. Chaque table de contenu budget est cloisonnee sur
-- `app.current_user_id`, pose par `scoped_connection(user_id)` cote FastAPI.
-- Fail-closed : parametre absent => current_setting renvoie NULL => aucune ligne.
-- ====================================================================

ALTER TABLE "budget_acces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "budget_acces_user_isolation" ON "budget_acces"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget_acces" TO app_rls;
--> statement-breakpoint

ALTER TABLE "budget_recurrents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "budget_recurrents_user_isolation" ON "budget_recurrents"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget_recurrents" TO app_rls;
--> statement-breakpoint

ALTER TABLE "budget_operations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "budget_operations_user_isolation" ON "budget_operations"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget_operations" TO app_rls;
--> statement-breakpoint

ALTER TABLE "budget_previsions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "budget_previsions_user_isolation" ON "budget_previsions"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget_previsions" TO app_rls;
--> statement-breakpoint

ALTER TABLE "budget_comptes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "budget_comptes_user_isolation" ON "budget_comptes"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget_comptes" TO app_rls;
