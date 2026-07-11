-- ====================================================================
-- Row Level Security (RLS) - cloisonnement strict des donnees utilisateur
-- applique au niveau Postgres, en complement (pas en remplacement) des
-- verifications applicatives (session.user.id === row.userId).
--
-- Fonctionnement : chaque table de contenu ne renvoie/n'accepte que les
-- lignes dont user_id correspond a l'utilisateur pose par le backend via
-- `SET LOCAL app.current_user_id = '<id>'` en debut de transaction. Cote
-- FastAPI, c'est le helper `scoped_connection(user_id)` de
-- backend/app/db/client.py qui pose ce parametre (tache coordonnee avec
-- l'agent fastapi-developer - Round 001 etape 1b).
--
-- IMPORTANT (obligatoire pour que RLS serve a quelque chose) : le role
-- Postgres utilise par le backend pour les requetes applicatives DOIT etre
-- le role `app_rls` cree ci-dessous, PAS `app_admin`. Les superusers et les
-- proprietaires de table contournent RLS par defaut - `app_admin` (proprietaire
-- des tables, cree superuser par l'image postgres officielle via
-- POSTGRES_USER) bypass donc TOUJOURS les policies. `app_admin` reste utilise
-- pour les migrations (DDL), `app_rls` doit etre utilise pour les requetes
-- applicatives (DML) une fois branche cote FastAPI.
--
-- Convention de comparaison : `current_setting('app.current_user_id', true)`
-- renvoie NULL si le parametre n'est pas pose (le `true` = missing_ok) : la
-- comparaison avec user_id renvoie alors NULL (donc FALSE), et RLS ne
-- retourne aucune ligne - fail-closed par defaut. Pas de cast `::uuid` : les
-- identifiants Better-auth (user.id) sont du texte (cuid), pas des uuid.
--
-- Mot de passe dev ci-dessous a rotationner pour tout environnement reel
-- (meme convention que app_admin/app_password_dev deja en place).
-- ====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_rls') THEN
    CREATE ROLE app_rls LOGIN PASSWORD 'app_rls_password_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO app_rls;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;
--> statement-breakpoint

ALTER TABLE "google_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "google_connections_user_isolation" ON "google_connections"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tasks_user_isolation" ON "tasks"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notes_user_isolation" ON "notes"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "note_appends" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "note_appends_user_isolation" ON "note_appends"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "events_user_isolation" ON "events"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "mails" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mails_user_isolation" ON "mails"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "sender_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sender_preferences_user_isolation" ON "sender_preferences"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "mail_drafts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mail_drafts_user_isolation" ON "mail_drafts"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "briefs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "briefs_user_isolation" ON "briefs"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "assistant_conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assistant_conversations_user_isolation" ON "assistant_conversations"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "assistant_conversation_turns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assistant_conversation_turns_user_isolation" ON "assistant_conversation_turns"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notifications_user_isolation" ON "notifications"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "usage_events_user_isolation" ON "usage_events"
  USING ("user_id" = current_setting('app.current_user_id', true));
--> statement-breakpoint

ALTER TABLE "llm_usage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "llm_usage_user_isolation" ON "llm_usage"
  USING ("user_id" = current_setting('app.current_user_id', true));
