// Seed de l'utilisateur admin par defaut : admin@admin.com / password
// Usage : npm run db:seed

import { eq } from "drizzle-orm";
import { db } from "./index";
import { user } from "./schema";
import { auth } from "../auth";

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "password";
const ADMIN_NAME = "Admin";

async function main() {
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, ADMIN_EMAIL));
  if (existing.length > 0) {
    console.log(`✓ Admin deja existant (${ADMIN_EMAIL})`);
    return;
  }

  const result = await auth.api.signUpEmail({
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME },
  });

  if (!result?.user) {
    console.error("Echec de creation de l'admin");
    process.exit(1);
  }

  console.log(`✓ Admin cree : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
