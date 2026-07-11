import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ====================================================================
// Mail - copie de travail d'un message Gmail. MyDay ne supprime JAMAIS
// rien dans Gmail (lecture + reponse uniquement). Unicite (userId, gmailId)
// pour l'idempotence de la synchronisation.
// ====================================================================

export const mails = pgTable(
  "mails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    gmailId: text("gmail_id").notNull(),
    expediteur: text("expediteur").notNull(),
    sujet: text("sujet"),
    extrait: text("extrait"),
    resumeIa: text("resume_ia"),
    score: integer("score"),
    raisonScore: text("raison_score"),
    // pending_triage : pas encore passe par le tri IA - triaged : score pose
    // archived_remote : supprime/archive cote Gmail (MyDay ne re-supprime jamais)
    statut: text("statut").notNull().default("pending_triage"),
    lu: boolean("lu").notNull().default(false),
    repondu: boolean("repondu").notNull().default(false),
    dateReception: timestamp("date_reception", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mails_user_gmail_unique").on(table.userId, table.gmailId),
    index("mails_user_id_idx").on(table.userId),
    index("mails_statut_idx").on(table.statut),
    index("mails_score_idx").on(table.score),
    index("mails_date_reception_idx").on(table.dateReception),
    check(
      "mails_statut_check",
      sql`${table.statut} IN ('pending_triage', 'triaged', 'archived_remote')`,
    ),
  ],
);

// ====================================================================
// Préférence expéditeur - alimentee par les boutons "Important / Pas
// important" du tri des mails, consommee par le pre-filtre heuristique.
// ====================================================================

export const senderPreferences = pgTable(
  "sender_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    email: text("email").notNull(),
    statut: text("statut").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sender_preferences_user_email_unique").on(
      table.userId,
      table.email,
    ),
    index("sender_preferences_user_id_idx").on(table.userId),
    check(
      "sender_preferences_statut_check",
      sql`${table.statut} IN ('important', 'muet')`,
    ),
  ],
);

// ====================================================================
// Brouillon de mail - propose par l'assistant conversationnel, jamais
// envoye sans validation explicite de l'utilisateur (regle metier
// absolue). Machine a etats verrouillee : index unique partiel sur
// sentGmailId pour garantir au niveau BDD qu'un brouillon n'est jamais
// envoye deux fois, meme en cas de retry concurrent.
// ====================================================================

export const mailDrafts = pgTable(
  "mail_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    destinataire: text("destinataire").notNull(),
    objet: text("objet"),
    corps: text("corps").notNull(),
    // pending_review -> sending -> sent | rejected | expired | sending_unconfirmed
    statut: text("statut").notNull().default("pending_review"),
    sentGmailId: text("sent_gmail_id"),
    mailOrigineId: uuid("mail_origine_id").references(() => mails.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("mail_drafts_user_id_idx").on(table.userId),
    index("mail_drafts_statut_idx").on(table.statut),
    // Garde anti-double-envoi : un seul brouillon peut porter un sentGmailId donne
    uniqueIndex("mail_drafts_sent_gmail_id_unique")
      .on(table.sentGmailId)
      .where(sql`${table.sentGmailId} IS NOT NULL`),
    check(
      "mail_drafts_statut_check",
      sql`${table.statut} IN ('pending_review', 'sending', 'sent', 'rejected', 'expired', 'sending_unconfirmed')`,
    ),
  ],
);

export type Mail = typeof mails.$inferSelect;
export type SenderPreference = typeof senderPreferences.$inferSelect;
export type MailDraft = typeof mailDrafts.$inferSelect;
