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
import { mails } from "./mails";

// ====================================================================
// Tâche - origine manuelle/assistant/mail. assistantActionKey rend les
// creations de l'assistant idempotentes (retry sans doublon), unique par
// utilisateur via index partiel.
// ====================================================================

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    titre: text("titre").notNull(),
    description: text("description"),
    priorite: text("priorite").notNull().default("normale"),
    echeance: timestamp("echeance", { withTimezone: true }),
    statut: text("statut").notNull().default("a_faire"),
    origine: text("origine").notNull().default("manuelle"),
    // Cle d'idempotence posee par l'assistant conversationnel (retry-safe)
    assistantActionKey: text("assistant_action_key"),
    mailId: uuid("mail_id").references(() => mails.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_statut_idx").on(table.statut),
    index("tasks_echeance_idx").on(table.echeance),
    uniqueIndex("tasks_assistant_action_key_unique")
      .on(table.userId, table.assistantActionKey)
      .where(sql`${table.assistantActionKey} IS NOT NULL`),
    check("tasks_priorite_check", sql`${table.priorite} IN ('basse', 'normale', 'haute')`),
    check("tasks_statut_check", sql`${table.statut} IN ('a_faire', 'faite')`),
    check(
      "tasks_origine_check",
      sql`${table.origine} IN ('manuelle', 'assistant', 'mail')`,
    ),
  ],
);

// ====================================================================
// Note - epinglee/archivee, origine manuelle/assistant (badge "via
// l'assistant" sur les mockups).
// ====================================================================

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    titre: text("titre").notNull(),
    contenu: text("contenu"),
    epinglee: boolean("epinglee").notNull().default(false),
    archivee: boolean("archivee").notNull().default(false),
    origine: text("origine").notNull().default("manuelle"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notes_user_id_idx").on(table.userId),
    index("notes_archivee_idx").on(table.archivee),
    check("notes_origine_check", sql`${table.origine} IN ('manuelle', 'assistant')`),
  ],
);

// ====================================================================
// Ajout de note - historique des ajouts realises par l'assistant sur une
// note existante (ex. ajout d'un article a une liste de courses).
// actionKey unique par note pour l'idempotence des retries assistant.
// userId denormalise depuis notes pour permettre une policy RLS directe.
// ====================================================================

export const noteAppends = pgTable(
  "note_appends",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actionKey: text("action_key").notNull(),
    contenu: text("contenu").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("note_appends_user_id_idx").on(table.userId),
    index("note_appends_note_id_idx").on(table.noteId),
    uniqueIndex("note_appends_note_action_key_unique").on(
      table.noteId,
      table.actionKey,
    ),
  ],
);

// ====================================================================
// Événement - synchronisation bidirectionnelle avec Google Agenda.
// Google reste la source de verite en cas de conflit (decisions.md).
// Unicite (userId, googleEventId) en index partiel : anti-doublons de
// synchronisation, sans empecher les evenements MyDay natifs (googleEventId
// null).
// ====================================================================

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    titre: text("titre").notNull(),
    debut: timestamp("debut", { withTimezone: true }).notNull(),
    fin: timestamp("fin", { withTimezone: true }).notNull(),
    lieu: text("lieu"),
    description: text("description"),
    googleEventId: text("google_event_id"),
    // Cle d'idempotence client : propagee vers Google dans
    // extendedProperties.private.mydayClientUuid lors de la remontee d'un
    // evenement local, puis re-matchee au pull. Evite les doublons si un crash
    // survient entre l'insert cote Google et l'UPDATE local du googleEventId.
    clientUuid: text("client_uuid"),
    // google : cree/importe depuis Google Agenda - myday : cree nativement dans MyDay
    source: text("source").notNull().default("myday"),
    syncStatus: text("sync_status").notNull().default("synced"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_user_id_idx").on(table.userId),
    index("events_debut_idx").on(table.debut),
    index("events_sync_status_idx").on(table.syncStatus),
    index("events_client_uuid_idx").on(table.clientUuid),
    uniqueIndex("events_user_google_event_id_unique")
      .on(table.userId, table.googleEventId)
      .where(sql`${table.googleEventId} IS NOT NULL`),
    check("events_source_check", sql`${table.source} IN ('google', 'myday')`),
    check(
      "events_sync_status_check",
      sql`${table.syncStatus} IN ('synced', 'sync_pending', 'sync_error')`,
    ),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type NoteAppend = typeof noteAppends.$inferSelect;
export type Event = typeof events.$inferSelect;
