import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { n8nInstances, executionLogs, syncStatus, normalizeStatus } from "@shared/schema";
import { getPoolForInstance } from "./tunnel-manager";

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [poller] ${message}`);
}

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const INITIAL_LOOKBACK_DAYS = 30;
const CLOCK_SKEW_MINUTES = 5;
const BATCH_SIZE = 500;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

// Track per-instance manual sync promises so callers can await them
const pendingSyncs = new Map<string, Promise<void>>();

export async function startPoller(): Promise<void> {
  log("Starting background poller (60s interval)");
  // Run first sync immediately
  await pollAllInstances();
  pollTimer = setInterval(pollAllInstances, POLL_INTERVAL_MS);
}

export function stopPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  log("Poller stopped");
}

async function pollAllInstances(): Promise<void> {
  if (isPolling) {
    log("Poll cycle already in progress, skipping");
    return;
  }

  isPolling = true;
  try {
    const instances = await db.select().from(n8nInstances);
    for (const instance of instances) {
      try {
        await pollInstance(instance);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`Sync failed for "${instance.name}" (${instance.id}): ${msg}`);
        // Write failure to sync_status
        await db
          .insert(syncStatus)
          .values({
            instanceId: instance.id,
            lastSyncSuccess: false,
            lastSyncError: msg,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: syncStatus.instanceId,
            set: {
              lastSyncSuccess: false,
              lastSyncError: msg,
              updatedAt: new Date(),
            },
          });
      }
    }
  } finally {
    isPolling = false;
  }
}

async function pollInstance(instance: typeof n8nInstances.$inferSelect): Promise<void> {
  const pool = await getPoolForInstance(instance);

  // Read last sync timestamp
  const syncRows = await db
    .select()
    .from(syncStatus)
    .where(eq(syncStatus.instanceId, instance.id));

  const lastSyncedAt = syncRows[0]?.lastSyncedAt;

  // Build the WHERE clause for incremental sync
  let whereClause: string;
  let queryParams: (string | number)[];

  if (!lastSyncedAt) {
    // Initial sync: last N days
    whereClause = `WHERE created_at >= NOW() - INTERVAL '${INITIAL_LOOKBACK_DAYS} days'`;
    queryParams = [];
  } else {
    // Incremental: fetch from lastSyncedAt minus safety margin
    const since = new Date(lastSyncedAt.getTime() - CLOCK_SKEW_MINUTES * 60 * 1000);
    whereClause = `WHERE created_at >= $1`;
    queryParams = [since.toISOString()];
  }

  const result = await pool.query(
    `SELECT * FROM n8n_execution_logs ${whereClause} ORDER BY created_at ASC`,
    queryParams
  );

  const rows = result.rows;
  let upsertedCount = 0;

  // Batch upsert
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const values = batch.map((row: Record<string, unknown>) => ({
      instanceId: instance.id,
      executionId: String(row.execution_id),
      workflowId: String(row.workflow_id),
      workflowName: String(row.workflow_name),
      status: normalizeStatus(String(row.status)),
      finished: Boolean(row.finished),
      startedAt: row.started_at ? new Date(row.started_at as string) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at as string) : null,
      durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
      mode: row.mode != null ? String(row.mode) : null,
      nodeCount: row.node_count != null ? Number(row.node_count) : null,
      errorMessage: row.error_message != null ? String(row.error_message) : null,
      executionData: row.execution_data ?? null,
      workflowData: row.workflow_data ?? null,
      createdAt: new Date(row.created_at as string),
    }));

    await db
      .insert(executionLogs)
      .values(values)
      .onConflictDoUpdate({
        target: [executionLogs.instanceId, executionLogs.executionId],
        set: {
          status: sql`excluded.status`,
          finished: sql`excluded.finished`,
          finishedAt: sql`excluded.finished_at`,
          durationMs: sql`excluded.duration_ms`,
          errorMessage: sql`excluded.error_message`,
          executionData: sql`excluded.execution_data`,
          workflowData: sql`excluded.workflow_data`,
        },
      });

    upsertedCount += batch.length;
  }

  // Update sync_status
  await db
    .insert(syncStatus)
    .values({
      instanceId: instance.id,
      lastSyncedAt: new Date(),
      lastSyncSuccess: true,
      lastSyncError: null,
      lastSyncRecordCount: upsertedCount,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: syncStatus.instanceId,
      set: {
        lastSyncedAt: new Date(),
        lastSyncSuccess: true,
        lastSyncError: null,
        lastSyncRecordCount: upsertedCount,
        updatedAt: new Date(),
      },
    });

  log(`Synced ${upsertedCount} records for "${instance.name}"`);
}

export async function triggerSyncForInstance(instanceId: string): Promise<void> {
  // Deduplicate concurrent manual syncs for the same instance
  const existing = pendingSyncs.get(instanceId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const instances = await db
        .select()
        .from(n8nInstances)
        .where(eq(n8nInstances.id, instanceId));

      if (instances.length === 0) {
        throw new Error("Instance not found");
      }

      await pollInstance(instances[0]);
    } finally {
      pendingSyncs.delete(instanceId);
    }
  })();

  pendingSyncs.set(instanceId, promise);
  return promise;
}
