import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForPool = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPool.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
