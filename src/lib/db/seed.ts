// Seed idempotent de l'utilisateur admin (identifiants pilotes par env,
// avec repli dev). Reutilisable en prod : sans admin au premier deploiement
// c'est un deadlock (personne ne peut envoyer d'invitation).
// Usage : npm run db:seed (peut etre execute plusieurs fois sans erreur)

import { eq } from "drizzle-orm";
import { db } from "./index";
import { user } from "./schema";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@admin.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "password";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Admin";

async function ensureAdminRole() {
  await db
    .update(user)
    .set({ role: "admin" })
    .where(eq(user.email, ADMIN_EMAIL));
}

async function main() {
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, ADMIN_EMAIL));

  if (existing.length > 0) {
    if (existing[0].role !== "admin") {
      await ensureAdminRole();
      console.log(`✓ Role admin pose sur un compte deja existant (${ADMIN_EMAIL})`);
    } else {
      console.log(`✓ Admin deja existant (${ADMIN_EMAIL})`);
    }
    return;
  }

  // Leve le verrou d'inscription publique (src/lib/auth.ts) pour ce script
  // uniquement, en important auth.ts dynamiquement APRES avoir pose la
  // variable d'environnement (un import statique serait hoiste et lirait
  // la variable trop tot).
  process.env.MYDAY_SEED_CONTEXT = "true";
  const { auth } = await import("../auth");

  const result = await auth.api.signUpEmail({
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME },
  });

  if (!result?.user) {
    console.error("Échec de création de l'admin");
    process.exit(1);
  }

  // signUpEmail ne garantit pas que additionalFields (role) soit pris en
  // compte au premier essai selon le client appelant - on le pose par un
  // UPDATE explicite separe.
  await ensureAdminRole();

  console.log(`✓ Admin cree : ${ADMIN_EMAIL} / role=admin`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
