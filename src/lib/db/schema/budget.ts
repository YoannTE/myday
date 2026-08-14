import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ====================================================================
// Budget - section privee de MyDay, protegee par un code a 4 chiffres en
// plus de la session (cf. `budget_access`). Quatre tables de contenu :
//
//   budget_recurrents    ce qui revient chaque mois (salaires, prets...)
//   budget_operations    les entrees/sorties ponctuelles du quotidien
//   budget_previsions    les projets et rentrees exceptionnelles a venir
//   budget_comptes       les soldes detenus (point de depart des projections)
//
// Convention commune : `sens` vaut 'entree' ou 'sortie' (ASCII sans accent,
// comme tous les statuts stockes en base) et `montant` est TOUJOURS positif -
// c'est `sens` qui porte le signe. Les montants sont en numeric(12,2) : jamais
// de flottant pour de l'argent.
// ====================================================================

const SENS_VALUES = sql`('entree', 'sortie')`;

// ====================================================================
// Verrou du budget - une ligne par utilisateur. Le code n'est jamais stocke
// en clair : `code_hash` contient un derive scrypt sale (cf.
// backend/app/security/code_budget.py). `tentatives` + `bloque_jusqua`
// verrouillent la saisie apres plusieurs echecs : un code a 4 chiffres n'a
// que 10 000 combinaisons, le debit d'essais DOIT etre limite.
// ====================================================================

export const budgetAcces = pgTable(
  "budget_acces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    codeHash: text("code_hash").notNull(),
    tentatives: integer("tentatives").notNull().default(0),
    bloqueJusqua: timestamp("bloque_jusqua", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("budget_acces_user_id_unique").on(table.userId)],
);

// ====================================================================
// Recurrent - une ligne qui revient a l'identique tous les mois. `actif`
// permet de suspendre une ligne (fin d'un pret, abonnement resilie) sans
// perdre l'historique de saisie.
// ====================================================================

export const budgetRecurrents = pgTable(
  "budget_recurrents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    libelle: text("libelle").notNull(),
    categorie: text("categorie").notNull(),
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
    sens: text("sens").notNull(),
    actif: boolean("actif").notNull().default(true),
    position: integer("position"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("budget_recurrents_user_id_idx").on(table.userId),
    check("budget_recurrents_sens_check", sql`${table.sens} IN ${SENS_VALUES}`),
    check("budget_recurrents_montant_check", sql`${table.montant} >= 0`),
  ],
);

// ====================================================================
// Operation ponctuelle - le quotidien (courses, essence, restaurant, une
// rentree exceptionnelle). Datee au jour pres, rattachee a un mois par sa
// date.
// ====================================================================

export const budgetOperations = pgTable(
  "budget_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    dateOperation: date("date_operation").notNull(),
    libelle: text("libelle").notNull(),
    categorie: text("categorie").notNull(),
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
    sens: text("sens").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("budget_operations_user_id_idx").on(table.userId),
    index("budget_operations_date_idx").on(table.dateOperation),
    check("budget_operations_sens_check", sql`${table.sens} IN ${SENS_VALUES}`),
    check("budget_operations_montant_check", sql`${table.montant} >= 0`),
  ],
);

// ====================================================================
// Prevision - projet ou rentree exceptionnelle a venir. `echeance` est un
// mois au format 'YYYY-MM' (texte, pas une date : on raisonne au mois, pas
// au jour) ou NULL quand rien n'est encore cale. `fait` sort la ligne des
// projections une fois realisee.
// ====================================================================

export const budgetPrevisions = pgTable(
  "budget_previsions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    libelle: text("libelle").notNull(),
    categorie: text("categorie").notNull(),
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
    sens: text("sens").notNull(),
    echeance: text("echeance"),
    fait: boolean("fait").notNull().default(false),
    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("budget_previsions_user_id_idx").on(table.userId),
    index("budget_previsions_echeance_idx").on(table.echeance),
    check("budget_previsions_sens_check", sql`${table.sens} IN ${SENS_VALUES}`),
    check("budget_previsions_montant_check", sql`${table.montant} >= 0`),
    check(
      "budget_previsions_echeance_check",
      sql`${table.echeance} IS NULL OR ${table.echeance} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
  ],
);

// ====================================================================
// Compte - un solde detenu a une date de releve. La somme des comptes est le
// point de depart de la projection de solde. Le montant peut etre negatif
// (decouvert, credit en cours).
// ====================================================================

export const budgetComptes = pgTable(
  "budget_comptes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    libelle: text("libelle").notNull(),
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
    dateReleve: date("date_releve"),
    position: integer("position"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("budget_comptes_user_id_idx").on(table.userId)],
);

export type BudgetAcces = typeof budgetAcces.$inferSelect;
export type BudgetRecurrent = typeof budgetRecurrents.$inferSelect;
export type BudgetOperation = typeof budgetOperations.$inferSelect;
export type BudgetPrevision = typeof budgetPrevisions.$inferSelect;
export type BudgetCompte = typeof budgetComptes.$inferSelect;
