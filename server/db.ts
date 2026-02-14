import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the local config database");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

/** Create GIN trigram indexes on JSONB text casts for fulltext search */
export async function ensureSearchIndexes(): Promise<void> {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_exec_data_trgm ON execution_logs USING gin ((execution_data::text) gin_trgm_ops)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_wf_data_trgm ON execution_logs USING gin ((workflow_data::text) gin_trgm_ops)`
  );
}
