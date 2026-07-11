// Applique les migrations Drizzle generees dans ./drizzle
// Verrouille via un advisory lock Postgres pour eviter les migrations
// concurrentes (plusieurs replicas demarres en meme temps au boot).
// Usage : npm run db:migrate

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Cle arbitraire fixe pour l'advisory lock des migrations MyDay (session-level,
// doit rester la meme connexion du debut a la fin - voir doc pg_advisory_lock).
const MIGRATE_LOCK_KEY = 84_952_001;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL manquante. Copie .env.local.example vers .env.local.",
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  // Une connexion dediee : les advisory locks sont lies a la session, pas au pool.
  const client = await pool.connect();

  try {
    console.log("Attente du verrou de migration...");
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATE_LOCK_KEY]);
    console.log("✓ Verrou acquis, application des migrations...");

    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✓ Migrations appliquees");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATE_LOCK_KEY]);
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
