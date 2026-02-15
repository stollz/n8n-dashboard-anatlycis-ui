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

/** Normalize any non-canonical status values in existing rows.
 *  Runs once at startup to fix data ingested before normalizeStatus() was added. */
export async function normalizeExistingStatuses(): Promise<void> {
  const result = await pool.query(`
    UPDATE execution_logs
    SET status = CASE LOWER(TRIM(status))
      WHEN 'success' THEN 'success'
      WHEN 'error'   THEN 'error'
      WHEN 'crashed'  THEN 'error'
      WHEN 'failed'   THEN 'error'
      WHEN 'unknown'  THEN 'error'
      WHEN 'running'  THEN 'running'
      WHEN 'new'      THEN 'running'
      WHEN 'waiting'  THEN 'waiting'
      WHEN 'canceled'  THEN 'canceled'
      WHEN 'cancelled' THEN 'canceled'
      ELSE 'error'
    END
    WHERE status NOT IN ('success', 'error', 'running', 'waiting', 'canceled')
  `);
  if (result.rowCount && result.rowCount > 0) {
    console.log(`[db] Normalized ${result.rowCount} rows with non-canonical status values`);
  }
}

/** tsvector column + GIN index for fast fulltext search across all fields.
 *  Unlike trigram ILIKE, the @@ operator resolves from the compact GIN index
 *  without decompressing large TOAST JSONB blobs at query time. */
export async function ensureSearchIndexes(): Promise<void> {
  // Drop legacy artifacts from earlier approaches
  await pool.query(`DROP INDEX IF EXISTS idx_search_text_trgm`);
  await pool.query(`DROP INDEX IF EXISTS idx_exec_data_trgm`);
  await pool.query(`DROP INDEX IF EXISTS idx_wf_data_trgm`);
  await pool.query(`ALTER TABLE execution_logs DROP COLUMN IF EXISTS search_text`);

  // Add tsvector column
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE execution_logs ADD COLUMN search_tsv tsvector;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);

  // Trigger to auto-populate search_tsv on INSERT/UPDATE
  await pool.query(`
    CREATE OR REPLACE FUNCTION execution_logs_search_tsv_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_tsv := to_tsvector('simple',
        COALESCE(NEW.workflow_name, '') || ' ' ||
        COALESCE(NEW.error_message, '') || ' ' ||
        COALESCE(NEW.execution_data::text, '') || ' ' ||
        COALESCE(NEW.workflow_data::text, '')
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS trg_search_tsv ON execution_logs;
    CREATE TRIGGER trg_search_tsv
      BEFORE INSERT OR UPDATE ON execution_logs
      FOR EACH ROW EXECUTE FUNCTION execution_logs_search_tsv_update()
  `);

  // GIN index on the tsvector
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_search_tsv ON execution_logs USING gin (search_tsv)`
  );

  // Backfill rows that don't have search_tsv yet (runs in background)
  pool.query(`
    UPDATE execution_logs SET search_tsv = to_tsvector('simple',
      COALESCE(workflow_name, '') || ' ' ||
      COALESCE(error_message, '') || ' ' ||
      COALESCE(execution_data::text, '') || ' ' ||
      COALESCE(workflow_data::text, '')
    ) WHERE search_tsv IS NULL
  `).catch((err) => console.error("Backfill search_tsv failed:", err));
}
