ALTER TABLE "events" ADD COLUMN "rappel_avance_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "rappel_avance_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_rappel_avance_check" CHECK ("events"."rappel_avance_minutes" IN (0, 5, 30, 60));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_rappel_avance_check" CHECK ("tasks"."rappel_avance_minutes" IN (0, 5, 30, 60));