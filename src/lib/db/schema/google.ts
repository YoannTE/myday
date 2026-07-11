import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ====================================================================
// Connexion Google - une seule connexion par utilisateur (Agenda + Gmail
// via OAuth officiel). Les jetons restent en `text` NON chiffres ce round
// (Round 001) : le chiffrement enveloppe AES-256-GCM (cle hors BDD) est
// apporte par le Round 003 EN MEME TEMPS que l'integration OAuth reelle.
// Aucun jeton reel n'est ecrit avant le Round 003.
// ====================================================================

export const googleConnections = pgTable(
  "google_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Jetons OAuth chiffres (AES-256-GCM enveloppe, base64) depuis le Round 003.
    // Le format base64 chiffre tient dans les colonnes text existantes : pas de
    // renommage `*_enc`. Aucun jeton en clair n'est jamais ecrit.
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    scopes: text("scopes").array(),

    // Expiration du jeton d'acces (retournee par Google, `expires_in`). Sans
    // elle, impossible de savoir quand rafraichir avant un appel Google.
    tokenExpiry: timestamp("token_expiry", { withTimezone: true }),

    // Curseurs de synchronisation incrementale (anti-doublons, Google
    // reste la source de verite en cas de conflit - decisions.md)
    calendarSyncToken: text("calendar_sync_token"),
    gmailHistoryId: text("gmail_history_id"),

    // Etat de la connexion : connected / disconnected / error / reauth_required
    status: text("status").notNull().default("connected"),
    calendarSyncedAt: timestamp("calendar_synced_at", { withTimezone: true }),
    gmailSyncedAt: timestamp("gmail_synced_at", { withTimezone: true }),

    // Horodatage de la derniere synchronisation manuelle declenchee par
    // l'utilisateur (bouton "Resynchroniser"). Sert d'anti-spam dedie
    // (1/30 s) : distinct de calendar/gmail_synced_at qui n'avancent que si
    // la branche correspondante reussit.
    lastManualSyncAt: timestamp("last_manual_sync_at", { withTimezone: true }),

    // Verrou anti-synchronisation concurrente pose par le worker de sync
    syncLockedUntil: timestamp("sync_locked_until", { withTimezone: true }),
    // Evite de renvoyer plusieurs fois la notification de reconnexion requise
    reauthNotified: boolean("reauth_notified").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("google_connections_user_id_unique").on(table.userId),
    index("google_connections_status_idx").on(table.status),
    check(
      "google_connections_status_check",
      sql`${table.status} IN ('connected', 'disconnected', 'error', 'reauth_required')`,
    ),
  ],
);

export type GoogleConnection = typeof googleConnections.$inferSelect;
