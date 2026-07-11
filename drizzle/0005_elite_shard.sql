CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"brief_hour" text DEFAULT '07:00' NOT NULL,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"notif_important_mail" boolean DEFAULT true NOT NULL,
	"notif_event_reminder" boolean DEFAULT true NOT NULL,
	"notif_brief_ready" boolean DEFAULT true NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_brief_hour_check" CHECK ("user_preferences"."brief_hour" ~ '^[0-2][0-9]:[0-5][0-9]$'),
	CONSTRAINT "user_preferences_onboarding_step_check" CHECK ("user_preferences"."onboarding_step" BETWEEN 0 AND 4)
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_id_unique" ON "user_preferences" USING btree ("user_id");
--> statement-breakpoint

ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "user_preferences_user_isolation" ON "user_preferences"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "user_preferences" TO app_rls;