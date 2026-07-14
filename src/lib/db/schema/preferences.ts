import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ====================================================================
// Preferences utilisateur - reglages notifications/brief + progression
// de l'onboarding (Round 005). Une seule ligne par utilisateur (creee a
// la demande, create-or-default cote FastAPI via scoped_connection).
//
// Semantique figee onboarding_step : 0 = non demarre, 1..4 = etape
// courante affichee (1 Google, 2 Preferences, 3 PWA, 4 Final),
// onboarding_completed=true = termine.
// ====================================================================

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    briefHour: text("brief_hour").notNull().default("07:00"),
    briefTone: text("brief_tone").notNull().default("neutre"),
    timezone: text("timezone").notNull().default("Europe/Paris"),
    // Thème par défaut de l'application (Round 016+). Mémorisé sur le profil
    // pour être réappliqué à chaque ouverture, sur tous les appareils.
    theme: text("theme").notNull().default("clair"),
    // Ville affichée par le widget météo du cockpit (Round 015). Ville par
    // défaut : Paris. Modifiable par l'utilisateur, mémorisée sur son profil.
    meteoVille: text("meteo_ville").notNull().default("Paris"),
    notifImportantMail: boolean("notif_important_mail").notNull().default(true),
    notifEventReminder: boolean("notif_event_reminder").notNull().default(true),
    notifBriefReady: boolean("notif_brief_ready").notNull().default(true),

    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    onboardingStep: integer("onboarding_step").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_preferences_user_id_unique").on(table.userId),
    check(
      "user_preferences_brief_hour_check",
      sql`${table.briefHour} ~ '^[0-2][0-9]:[0-5][0-9]$'`,
    ),
    check(
      "user_preferences_onboarding_step_check",
      sql`${table.onboardingStep} BETWEEN 0 AND 4`,
    ),
    check(
      "user_preferences_brief_tone_check",
      sql`${table.briefTone} IN ('neutre', 'motivant', 'direct')`,
    ),
    check(
      "user_preferences_theme_check",
      sql`${table.theme} IN ('clair', 'sombre')`,
    ),
  ],
);

export type UserPreference = typeof userPreferences.$inferSelect;
