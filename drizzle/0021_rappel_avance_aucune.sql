-- Autorise la valeur -1 (« aucune notification ») pour le délai de rappel
-- des événements et des tâches planifiées.
ALTER TABLE "events" DROP CONSTRAINT "events_rappel_avance_check";--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_rappel_avance_check" CHECK ("events"."rappel_avance_minutes" IN (-1, 0, 5, 30, 60));--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_rappel_avance_check";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_rappel_avance_check" CHECK ("tasks"."rappel_avance_minutes" IN (-1, 0, 5, 30, 60));
