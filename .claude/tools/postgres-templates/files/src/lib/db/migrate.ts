// Applique les migrations Drizzle generees dans ./drizzle
// Usage : npm run db:migrate

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL manquante. Copie .env.local.example vers .env.local.",
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log("Application des migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations appliquees");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
