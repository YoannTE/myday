CREATE TABLE "google_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"scopes" text[],
	"calendar_sync_token" text,
	"gmail_history_id" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"calendar_synced_at" timestamp with time zone,
	"gmail_synced_at" timestamp with time zone,
	"sync_locked_until" timestamp with time zone,
	"reauth_notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_connections_status_check" CHECK ("google_connections"."status" IN ('connected', 'disconnected', 'error', 'reauth_required'))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"titre" text NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"lieu" text,
	"description" text,
	"google_event_id" text,
	"source" text DEFAULT 'myday' NOT NULL,
	"sync_status" text DEFAULT 'synced' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_source_check" CHECK ("events"."source" IN ('google', 'myday')),
	CONSTRAINT "events_sync_status_check" CHECK ("events"."sync_status" IN ('synced', 'sync_pending', 'sync_error'))
);
--> statement-breakpoint
CREATE TABLE "note_appends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"action_key" text NOT NULL,
	"contenu" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"titre" text NOT NULL,
	"contenu" text,
	"epinglee" boolean DEFAULT false NOT NULL,
	"archivee" boolean DEFAULT false NOT NULL,
	"origine" text DEFAULT 'manuelle' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_origine_check" CHECK ("notes"."origine" IN ('manuelle', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"titre" text NOT NULL,
	"description" text,
	"priorite" text DEFAULT 'normale' NOT NULL,
	"echeance" timestamp with time zone,
	"statut" text DEFAULT 'a_faire' NOT NULL,
	"origine" text DEFAULT 'manuelle' NOT NULL,
	"assistant_action_key" text,
	"mail_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_priorite_check" CHECK ("tasks"."priorite" IN ('basse', 'normale', 'haute')),
	CONSTRAINT "tasks_statut_check" CHECK ("tasks"."statut" IN ('a_faire', 'faite')),
	CONSTRAINT "tasks_origine_check" CHECK ("tasks"."origine" IN ('manuelle', 'assistant', 'mail'))
);
--> statement-breakpoint
CREATE TABLE "mail_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"destinataire" text NOT NULL,
	"objet" text,
	"corps" text NOT NULL,
	"statut" text DEFAULT 'pending_review' NOT NULL,
	"sent_gmail_id" text,
	"mail_origine_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_drafts_statut_check" CHECK ("mail_drafts"."statut" IN ('pending_review', 'sending', 'sent', 'rejected', 'expired', 'sending_unconfirmed'))
);
--> statement-breakpoint
CREATE TABLE "mails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"gmail_id" text NOT NULL,
	"expediteur" text NOT NULL,
	"sujet" text,
	"extrait" text,
	"resume_ia" text,
	"score" integer,
	"raison_score" text,
	"statut" text DEFAULT 'pending_triage' NOT NULL,
	"lu" boolean DEFAULT false NOT NULL,
	"repondu" boolean DEFAULT false NOT NULL,
	"date_reception" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mails_statut_check" CHECK ("mails"."statut" IN ('pending_triage', 'triaged'))
);
--> statement-breakpoint
CREATE TABLE "sender_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"statut" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sender_preferences_statut_check" CHECK ("sender_preferences"."statut" IN ('important', 'muet'))
);
--> statement-breakpoint
CREATE TABLE "assistant_conversation_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"turn_key" text NOT NULL,
	"role" text NOT NULL,
	"contenu" text NOT NULL,
	"actions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_conversation_turns_role_check" CHECK ("assistant_conversation_turns"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'quotidien' NOT NULL,
	"degraded" boolean DEFAULT false NOT NULL,
	"contenu" jsonb NOT NULL,
	"brief_date" date NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefs_type_check" CHECK ("briefs"."type" IN ('quotidien', 'a_la_demande'))
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"jeton" text NOT NULL,
	"expiration" timestamp with time zone NOT NULL,
	"statut" text DEFAULT 'envoyee' NOT NULL,
	"invite_par" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_jeton_unique" UNIQUE("jeton"),
	CONSTRAINT "invitations_statut_check" CHECK ("invitations"."statut" IN ('envoyee', 'acceptee'))
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"agent" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"contenu" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"lue" boolean DEFAULT false NOT NULL,
	"date_envoi" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" IN ('mail_important', 'rappel_evenement', 'brief_pret'))
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_type_check" CHECK ("usage_events"."type" IN ('dashboard_opened', 'brief_generated', 'brief_opened', 'task_completed', 'assistant_message_sent', 'mail_replied'))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_appends" ADD CONSTRAINT "note_appends_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_appends" ADD CONSTRAINT "note_appends_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mail_id_mails_id_fk" FOREIGN KEY ("mail_id") REFERENCES "public"."mails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_drafts" ADD CONSTRAINT "mail_drafts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_drafts" ADD CONSTRAINT "mail_drafts_mail_origine_id_mails_id_fk" FOREIGN KEY ("mail_origine_id") REFERENCES "public"."mails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mails" ADD CONSTRAINT "mails_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_preferences" ADD CONSTRAINT "sender_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversation_turns" ADD CONSTRAINT "assistant_conversation_turns_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversation_turns" ADD CONSTRAINT "assistant_conversation_turns_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invite_par_user_id_fk" FOREIGN KEY ("invite_par") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "google_connections_user_id_unique" ON "google_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "google_connections_status_idx" ON "google_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_user_id_idx" ON "events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_debut_idx" ON "events" USING btree ("debut");--> statement-breakpoint
CREATE INDEX "events_sync_status_idx" ON "events" USING btree ("sync_status");--> statement-breakpoint
CREATE UNIQUE INDEX "events_user_google_event_id_unique" ON "events" USING btree ("user_id","google_event_id") WHERE "events"."google_event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "note_appends_user_id_idx" ON "note_appends" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_appends_note_id_idx" ON "note_appends" USING btree ("note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "note_appends_note_action_key_unique" ON "note_appends" USING btree ("note_id","action_key");--> statement-breakpoint
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_archivee_idx" ON "notes" USING btree ("archivee");--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_statut_idx" ON "tasks" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "tasks_echeance_idx" ON "tasks" USING btree ("echeance");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_assistant_action_key_unique" ON "tasks" USING btree ("user_id","assistant_action_key") WHERE "tasks"."assistant_action_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "mail_drafts_user_id_idx" ON "mail_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mail_drafts_statut_idx" ON "mail_drafts" USING btree ("statut");--> statement-breakpoint
CREATE UNIQUE INDEX "mail_drafts_sent_gmail_id_unique" ON "mail_drafts" USING btree ("sent_gmail_id") WHERE "mail_drafts"."sent_gmail_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mails_user_gmail_unique" ON "mails" USING btree ("user_id","gmail_id");--> statement-breakpoint
CREATE INDEX "mails_user_id_idx" ON "mails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mails_statut_idx" ON "mails" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "mails_score_idx" ON "mails" USING btree ("score");--> statement-breakpoint
CREATE INDEX "mails_date_reception_idx" ON "mails" USING btree ("date_reception");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_preferences_user_email_unique" ON "sender_preferences" USING btree ("user_id","email");--> statement-breakpoint
CREATE INDEX "sender_preferences_user_id_idx" ON "sender_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assistant_conversation_turns_user_id_idx" ON "assistant_conversation_turns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assistant_conversation_turns_conversation_id_idx" ON "assistant_conversation_turns" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_conversation_turns_turn_key_unique" ON "assistant_conversation_turns" USING btree ("conversation_id","turn_key");--> statement-breakpoint
CREATE INDEX "assistant_conversations_user_id_idx" ON "assistant_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "briefs_user_id_idx" ON "briefs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "briefs_brief_date_idx" ON "briefs" USING btree ("brief_date");--> statement-breakpoint
CREATE UNIQUE INDEX "briefs_user_daily_unique" ON "briefs" USING btree ("user_id","brief_date") WHERE "briefs"."type" = 'quotidien';--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_statut_idx" ON "invitations" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "llm_usage_user_id_idx" ON "llm_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "llm_usage_agent_idx" ON "llm_usage" USING btree ("agent");--> statement-breakpoint
CREATE INDEX "llm_usage_created_at_idx" ON "llm_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_lue_idx" ON "notifications" USING btree ("lue");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_ref_type_unique" ON "notifications" USING btree ("user_id","ref_id","type");--> statement-breakpoint
CREATE INDEX "usage_events_user_id_idx" ON "usage_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_events_type_idx" ON "usage_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "usage_events_created_at_idx" ON "usage_events" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("user"."role" IN ('user', 'admin'));