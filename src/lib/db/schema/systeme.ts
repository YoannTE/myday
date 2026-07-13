import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ====================================================================
// Invitation - inscription sur invitation uniquement (regle metier). Cree
// et listee par l'admin uniquement, consommee a l'inscription.
// ====================================================================

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    jeton: text("jeton").notNull().unique(),
    expiration: timestamp("expiration", { withTimezone: true }).notNull(),
    statut: text("statut").notNull().default("envoyee"),
    invitePar: text("invite_par")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Tracabilite de l'acceptation (Round 002). Semantique BEARER : le compte
    // reellement cree (acceptedBy) peut differer de l'email invite (partage du
    // lien). FK SET NULL : l'historique d'invitations survit a la suppression
    // du compte accepteur.
    acceptedBy: text("accepted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invitations_email_idx").on(table.email),
    index("invitations_statut_idx").on(table.statut),
    // Anti-doublon concurrent au niveau DB : au plus une invitation en attente
    // (statut='envoyee') par email. Les invitations acceptees/revoquees ne
    // bloquent pas une nouvelle invitation.
    uniqueIndex("invitations_email_pending_unique")
      .on(table.email)
      .where(sql`${table.statut} = 'envoyee'`),
    check(
      "invitations_statut_check",
      sql`${table.statut} IN ('envoyee', 'acceptee', 'revoquee')`,
    ),
  ],
);

// ====================================================================
// Notification - refId TOUJOURS renseigne (convention) : il pointe vers
// l'entite d'origine selon `type` (mail_important -> mailId, rappel_evenement
// -> eventId, brief_pret -> briefId). Reference polymorphe volontairement
// SANS contrainte FK stricte (pas de table cible unique) ; l'integrite est
// garantie cote application. Unicite (userId, refId, type) : anti-doublons
// de notification pour un meme evenement source.
// ====================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: text("type").notNull(),
    contenu: text("contenu").notNull(),
    // Reference polymorphe vers briefId/mailId/eventId selon `type` (voir note ci-dessus)
    refId: uuid("ref_id").notNull(),
    lue: boolean("lue").notNull().default(false),
    dateEnvoi: timestamp("date_envoi", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_lue_idx").on(table.lue),
    uniqueIndex("notifications_user_ref_type_unique").on(
      table.userId,
      table.refId,
      table.type,
    ),
    check(
      "notifications_type_check",
      sql`${table.type} IN ('mail_important', 'rappel_evenement', 'rappel_tache', 'tache_planifiee', 'brief_pret', 'contact_demande', 'contact_accepte', 'partage_recu')`,
    ),
  ],
);

// ====================================================================
// Journal d'usage - evenements produit legers (baseline avant ouverture
// publique : Yoann + Manon >= 5 jours/7 pendant 4 semaines).
// ====================================================================

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: text("type").notNull(),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_events_user_id_idx").on(table.userId),
    index("usage_events_type_idx").on(table.type),
    index("usage_events_created_at_idx").on(table.createdAt),
    check(
      "usage_events_type_check",
      sql`${table.type} IN ('dashboard_opened', 'brief_generated', 'brief_opened', 'task_completed', 'assistant_message_sent', 'mail_replied')`,
    ),
  ],
);

// ====================================================================
// Compteur de cout IA - un enregistrement par appel LLM, pour la maitrise
// du cout (plafond de frequence, baseline par agent/utilisateur).
// ====================================================================

export const llmUsage = pgTable(
  "llm_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    agent: text("agent").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("llm_usage_user_id_idx").on(table.userId),
    index("llm_usage_agent_idx").on(table.agent),
    index("llm_usage_created_at_idx").on(table.createdAt),
  ],
);

// ====================================================================
// Abonnement push - un enregistrement par abonnement navigateur (Web Push).
// L'endpoint identifie l'abonnement de facon globale (unique tous users
// confondus) : deux users ne peuvent pas partager le meme endpoint.
// ====================================================================

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
  ],
);

export type Invitation = typeof invitations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type LlmUsage = typeof llmUsage.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
