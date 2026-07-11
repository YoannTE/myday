ALTER TABLE "invitations" DROP CONSTRAINT "invitations_statut_check";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "accepted_by" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_email_pending_unique" ON "invitations" USING btree ("email") WHERE "invitations"."statut" = 'envoyee';--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_statut_check" CHECK ("invitations"."statut" IN ('envoyee', 'acceptee', 'revoquee'));