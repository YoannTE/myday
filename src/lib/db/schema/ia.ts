import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ====================================================================
// Brief - contenu genere par l'agent IA. `briefDate` est le jour couvert
// par le brief (date calendaire, pas d'heure) ; `generatedAt` est l'instant
// reel de generation. Un seul brief "quotidien" par utilisateur et par jour
// (index unique partiel) - les briefs "a_la_demande" ne sont pas limites.
// `degraded` signale un brief genere avec des donnees partielles (ex. sync
// Google en panne).
// ====================================================================

export const briefs = pgTable(
  "briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: text("type").notNull().default("quotidien"),
    degraded: boolean("degraded").notNull().default(false),
    contenu: jsonb("contenu").notNull(),
    briefDate: date("brief_date").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("briefs_user_id_idx").on(table.userId),
    index("briefs_brief_date_idx").on(table.briefDate),
    // Un seul brief quotidien par utilisateur et par jour couvert
    uniqueIndex("briefs_user_daily_unique")
      .on(table.userId, table.briefDate)
      .where(sql`${table.type} = 'quotidien'`),
    check("briefs_type_check", sql`${table.type} IN ('quotidien', 'a_la_demande')`),
  ],
);

// ====================================================================
// Conversation assistant - regroupe les tours (messages + actions) d'un
// echange avec l'assistant conversationnel. Le detail des messages vit
// dans assistant_conversation_turns pour permettre une idempotence par
// tour (turnKey), meme pattern que assistantActionKey sur les taches.
// ====================================================================

export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("assistant_conversations_user_id_idx").on(table.userId)],
);

export const assistantConversationTurns = pgTable(
  "assistant_conversation_turns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    // Denormalise depuis la conversation pour permettre une policy RLS directe
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Cle d'idempotence du tour (retry-safe cote assistant)
    turnKey: text("turn_key").notNull(),
    role: text("role").notNull(),
    contenu: text("contenu").notNull(),
    // Actions effectuees pendant ce tour (tache creee, evenement ajoute, brouillon propose...)
    actions: jsonb("actions"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("assistant_conversation_turns_user_id_idx").on(table.userId),
    index("assistant_conversation_turns_conversation_id_idx").on(
      table.conversationId,
    ),
    uniqueIndex("assistant_conversation_turns_turn_key_unique").on(
      table.conversationId,
      table.turnKey,
    ),
    check(
      "assistant_conversation_turns_role_check",
      sql`${table.role} IN ('user', 'assistant')`,
    ),
  ],
);

export type Brief = typeof briefs.$inferSelect;
export type AssistantConversation = typeof assistantConversations.$inferSelect;
export type AssistantConversationTurn =
  typeof assistantConversationTurns.$inferSelect;
