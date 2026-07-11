ALTER TABLE "mails" DROP CONSTRAINT "mails_statut_check";--> statement-breakpoint
ALTER TABLE "google_connections" ADD COLUMN "token_expiry" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "google_connections" ADD COLUMN "last_manual_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "client_uuid" text;--> statement-breakpoint
CREATE INDEX "events_client_uuid_idx" ON "events" USING btree ("client_uuid");--> statement-breakpoint
ALTER TABLE "mails" ADD CONSTRAINT "mails_statut_check" CHECK ("mails"."statut" IN ('pending_triage', 'triaged', 'archived_remote'));