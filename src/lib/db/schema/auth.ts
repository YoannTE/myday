import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ====================================================================
// Tables Better-auth (INTOUCHABLES) - noms et structure imposes par
// Better-auth. Ne JAMAIS renommer ces tables, ne JAMAIS modifier leurs
// colonnes natives, ne JAMAIS inserer directement dedans (passer par
// auth.api.*).
//
// Seule extension tolérée : la colonne `role`, ajoutée via le mecanisme
// officiel Better-auth `additionalFields` (voir src/lib/auth.ts). Cette
// colonne doit exister ici pour que l'adapter Drizzle sache la lire/ecrire,
// mais elle n'est jamais modifiee "a la main" en dehors de Better-auth.
// ====================================================================

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // Champ metier ajoute via Better-auth additionalFields (src/lib/auth.ts)
    role: text("role").notNull().default("user"),
    // Compte actif (Round 002) : desactivation admin = active=false +
    // revocation des sessions. Ajoute via additionalFields input:false.
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("user_role_check", sql`${table.role} IN ('user', 'admin')`),
  ],
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
