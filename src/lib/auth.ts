import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import { invitations, user } from "./db/schema";
import {
  INVITATION_ERROR_MESSAGES,
  validateInvitationToken,
} from "./invitations";

const googleEnabled = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

// Inscription publique gardée par invitation (règle produit : accès sur
// invitation uniquement, cf. .project/app.md). Contrairement au Round 001, on
// n'utilise PLUS `disableSignUp` : l'endpoint /sign-up/email reste actif mais
// le hook `before` ci-dessous exige un jeton d'invitation valide (claim
// atomique). Le seed admin (src/lib/db/seed.ts) court-circuite ce hook en
// posant MYDAY_SEED_CONTEXT="true" avant d'importer ce module (sinon amorçage
// impossible : aucun admin pour émettre la première invitation).

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        // Jamais modifiable depuis le client (posé uniquement par le seed
        // ou un futur endpoint admin côté serveur)
        input: false,
      },
      active: {
        type: "boolean",
        defaultValue: true,
        // Jamais modifiable depuis le client. La désactivation passe par un
        // endpoint admin côté serveur (Round 002, FastAPI).
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
    // Réinitialisation de mot de passe : en dev on loggue le lien côté serveur
    // (pas d'envoi d'email réel). Le vrai transport arrive plus tard.
    sendResetPassword: async ({ user: target, url }) => {
      console.log(
        `[DEV] Lien de réinitialisation pour ${target.email} : ${url}`,
      );
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  hooks: {
    // Middleware de requête exécuté AVANT le handler d'endpoint. On matche par
    // `ctx.path` (chemin normalisé sans le préfixe /api/auth).
    before: createAuthMiddleware(async (ctx) => {
      // --- Porte d'invitation à l'inscription ---
      if (ctx.path === "/sign-up/email") {
        // Le seed amorce l'admin sans invitation.
        if (process.env.MYDAY_SEED_CONTEXT === "true") return;

        const jeton = ctx.body?.invitationToken;
        if (!jeton || typeof jeton !== "string") {
          throw new APIError("BAD_REQUEST", {
            message: INVITATION_ERROR_MESSAGES.invalide,
          });
        }

        // Claim atomique : seule une invitation `envoyee` non expirée peut
        // passer à `acceptee`. RETURNING vide => rejet. Deux inscriptions
        // concurrentes avec le même jeton : une seule voit une ligne, l'autre
        // 0 ligne (garantie par la condition statut='envoyee').
        const claimed = await db
          .update(invitations)
          .set({ statut: "acceptee", updatedAt: new Date() })
          .where(
            and(
              eq(invitations.jeton, jeton),
              eq(invitations.statut, "envoyee"),
              gt(invitations.expiration, new Date()),
            ),
          )
          .returning();

        if (claimed.length === 0) {
          // Diagnostic lecture seule pour le message français précis.
          const validation = await validateInvitationToken(jeton);
          const reason = validation.valid ? "invalide" : validation.reason;
          throw new APIError("BAD_REQUEST", {
            message: INVITATION_ERROR_MESSAGES[reason],
          });
        }
        return;
      }

      // --- Refus des comptes désactivés à la connexion ---
      if (ctx.path === "/sign-in/email") {
        const email = ctx.body?.email;
        if (email && typeof email === "string") {
          const rows = await db
            .select({ active: user.active })
            .from(user)
            .where(eq(user.email, email))
            .limit(1);
          if (rows[0] && rows[0].active === false) {
            throw new APIError("FORBIDDEN", { message: "Compte désactivé" });
          }
        }
        return;
      }
    }),
    // Après une inscription réussie : lier l'invitation au compte réellement
    // créé (sémantique bearer : peut différer de l'email invité). Idempotent.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      if (process.env.MYDAY_SEED_CONTEXT === "true") return;

      const jeton = ctx.body?.invitationToken;
      const newUserId = ctx.context.newSession?.user?.id;
      if (!jeton || typeof jeton !== "string" || !newUserId) return;

      await db
        .update(invitations)
        .set({ acceptedBy: newUserId, acceptedAt: new Date() })
        .where(
          and(eq(invitations.jeton, jeton), isNull(invitations.acceptedBy)),
        );
    }),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24,
  },
  // Config cookie figée (correction review) : sameSite lax partout, secure
  // uniquement en production (baseURL https).
  //
  // Cross-sous-domaines : quand le front (myday.aevio-one.com) et l'API
  // (api.myday.aevio-one.com) vivent sur des sous-domaines distincts, le cookie
  // de session doit porter un Domain partagé pour que le navigateur l'envoie
  // aussi à l'API. On le pilote par `COOKIE_DOMAIN` (ex: `.myday.aevio-one.com`)
  // : absent en dev (localhost, même origine) → comportement inchangé.
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ...(process.env.COOKIE_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: process.env.COOKIE_DOMAIN,
          },
        }
      : {}),
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
    },
  },
});

export const isGoogleEnabled = googleEnabled;
