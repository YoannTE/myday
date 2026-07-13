import { sql } from "drizzle-orm";
import {
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
// Contact - lien de partage entre deux comptes (Round 016). Le demandeur
// invite par email, le destinataire accepte : ensuite chacun peut partager
// des elements (evenements/taches/notes) avec l'autre. RLS : visible par
// les deux participants (policy ajoutee a la main dans la migration).
// ====================================================================

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    demandeurId: text("demandeur_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    destinataireId: text("destinataire_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    statut: text("statut").notNull().default("en_attente"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("contacts_paire_unique").on(
      table.demandeurId,
      table.destinataireId,
    ),
    index("contacts_destinataire_idx").on(table.destinataireId),
    check(
      "contacts_statut_check",
      sql`${table.statut} IN ('en_attente', 'accepte')`,
    ),
    check(
      "contacts_pas_soi_meme_check",
      sql`${table.demandeurId} <> ${table.destinataireId}`,
    ),
  ],
);

// ====================================================================
// Partage - un element precis (evenement, tache ou note) partage en
// LECTURE SEULE par son proprietaire avec un contact. La lecture cote
// destinataire est ouverte par des policies RLS `FOR SELECT` dediees sur
// events/tasks/notes/note_items (migration) - la modification reste
// couverte par les policies d'isolation proprietaire uniquement.
// Pas de FK sur element_id (polymorphe) : les services suppriment les
// partages a la suppression de l'element.
// ====================================================================

export const partages = pgTable(
  "partages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proprietaireId: text("proprietaire_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cibleId: text("cible_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    elementType: text("element_type").notNull(),
    elementId: uuid("element_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("partages_unique").on(
      table.proprietaireId,
      table.cibleId,
      table.elementType,
      table.elementId,
    ),
    index("partages_cible_idx").on(table.cibleId),
    index("partages_element_idx").on(table.elementType, table.elementId),
    check(
      "partages_element_type_check",
      sql`${table.elementType} IN ('event', 'task', 'note')`,
    ),
    check(
      "partages_pas_soi_meme_check",
      sql`${table.proprietaireId} <> ${table.cibleId}`,
    ),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type Partage = typeof partages.$inferSelect;
