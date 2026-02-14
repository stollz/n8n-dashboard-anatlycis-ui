import type { Express } from "express";
import type { Server } from "http";
import { eq, desc, and, or, ilike, gte, lte, sql } from "drizzle-orm";
import { insertInstanceSchema, executionLogs, syncStatus } from "@shared/schema";
import { db } from "./db";
import {
  listInstances,
  getInstance,
  getInstancePublic,
  createInstance,
  updateInstance,
  deleteInstance,
} from "./instance-store";
import { closeTunnel, testConnection } from "./tunnel-manager";
import { triggerSyncForInstance } from "./poller";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ─── Instance CRUD ────────────────────────────────────────────

  app.get("/api/instances", async (_req, res) => {
    try {
      const instances = await listInstances();
      res.json(instances);
    } catch (error) {
      console.error("Error listing instances:", error);
      res.status(500).json({ error: "Failed to list instances" });
    }
  });

  app.get("/api/instances/:id", async (req, res) => {
    try {
      const inst = await getInstancePublic(req.params.id);
      if (!inst) return res.status(404).json({ error: "Instance not found" });
      res.json(inst);
    } catch (error) {
      console.error("Error getting instance:", error);
      res.status(500).json({ error: "Failed to get instance" });
    }
  });

  app.post("/api/instances", async (req, res) => {
    try {
      const parsed = insertInstanceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const inst = await createInstance(parsed.data);
      res.status(201).json(inst);
    } catch (error) {
      console.error("Error creating instance:", error);
      res.status(500).json({ error: "Failed to create instance" });
    }
  });

  app.put("/api/instances/:id", async (req, res) => {
    try {
      const inst = await updateInstance(req.params.id, req.body);
      if (!inst) return res.status(404).json({ error: "Instance not found" });
      closeTunnel(req.params.id);
      res.json(inst);
    } catch (error) {
      console.error("Error updating instance:", error);
      res.status(500).json({ error: "Failed to update instance" });
    }
  });

  app.delete("/api/instances/:id", async (req, res) => {
    try {
      const deleted = await deleteInstance(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Instance not found" });
      closeTunnel(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting instance:", error);
      res.status(500).json({ error: "Failed to delete instance" });
    }
  });

  app.post("/api/instances/:id/test-connection", async (req, res) => {
    try {
      const inst = await getInstance(req.params.id);
      if (!inst) return res.status(404).json({ error: "Instance not found" });
      const result = await testConnection(inst);
      res.json(result);
    } catch (error) {
      console.error("Error testing connection:", error);
      res.status(500).json({ error: "Failed to test connection" });
    }
  });

  // ─── Sync endpoints ───────────────────────────────────────────

  app.get("/api/sync-status", async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string;
      if (!instanceId) {
        return res.status(400).json({ error: "instanceId query parameter is required" });
      }
      const rows = await db
        .select()
        .from(syncStatus)
        .where(eq(syncStatus.instanceId, instanceId));

      if (rows.length === 0) {
        return res.json(null);
      }

      const row = rows[0];
      res.json({
        instanceId: row.instanceId,
        lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
        lastSyncSuccess: row.lastSyncSuccess,
        lastSyncError: row.lastSyncError,
        lastSyncRecordCount: row.lastSyncRecordCount,
        updatedAt: row.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ error: "Failed to fetch sync status" });
    }
  });

  app.post("/api/instances/:id/sync", async (req, res) => {
    try {
      await triggerSyncForInstance(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error triggering sync:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to trigger sync",
      });
    }
  });

  // ─── Execution endpoints (query local cache) ──────────────────

  app.get("/api/executions", async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string;
      if (!instanceId) {
        return res.status(400).json({ error: "instanceId query parameter is required" });
      }

      const limit = parseInt(req.query.limit as string) || 500;
      const search = (req.query.search as string)?.trim();
      const workflowName = (req.query.workflowName as string)?.trim();
      const status = (req.query.status as string)?.trim();
      const startDate = (req.query.startDate as string)?.trim();
      const endDate = (req.query.endDate as string)?.trim();

      const conditions = [eq(executionLogs.instanceId, instanceId)];

      if (workflowName) {
        conditions.push(eq(executionLogs.workflowName, workflowName));
      }

      if (status) {
        conditions.push(eq(executionLogs.status, status));
      }

      if (startDate) {
        conditions.push(gte(executionLogs.createdAt, new Date(startDate)));
      }

      if (endDate) {
        conditions.push(lte(executionLogs.createdAt, new Date(endDate)));
      }

      let whereCondition = and(...conditions)!;

      if (search) {
        const pattern = `%${search}%`;
        const searchCondition = or(
          ilike(executionLogs.workflowName, pattern),
          ilike(executionLogs.errorMessage, pattern),
        );
        whereCondition = and(whereCondition, searchCondition)!;
      }

      // Select only lightweight columns — exclude heavy JSONB blobs
      const rows = await db
        .select({
          id: executionLogs.id,
          instanceId: executionLogs.instanceId,
          executionId: executionLogs.executionId,
          workflowId: executionLogs.workflowId,
          workflowName: executionLogs.workflowName,
          status: executionLogs.status,
          finished: executionLogs.finished,
          startedAt: executionLogs.startedAt,
          finishedAt: executionLogs.finishedAt,
          durationMs: executionLogs.durationMs,
          mode: executionLogs.mode,
          nodeCount: executionLogs.nodeCount,
          errorMessage: executionLogs.errorMessage,
          lastNodeExecuted: sql<string | null>`${executionLogs.executionData}->>'lastNodeExecuted'`.as("last_node_executed"),
          createdAt: executionLogs.createdAt,
        })
        .from(executionLogs)
        .where(whereCondition)
        .orderBy(desc(executionLogs.createdAt))
        .limit(limit);

      // Map to snake_case ExecutionLog shape the frontend expects
      const result = rows.map((r) => ({
        id: r.id,
        execution_id: r.executionId,
        workflow_id: r.workflowId,
        workflow_name: r.workflowName,
        status: r.status,
        finished: r.finished,
        started_at: r.startedAt?.toISOString() ?? null,
        finished_at: r.finishedAt?.toISOString() ?? null,
        duration_ms: r.durationMs,
        mode: r.mode,
        node_count: r.nodeCount,
        error_message: r.errorMessage,
        last_node_executed: r.lastNodeExecuted ?? null,
        execution_data: null,
        workflow_data: null,
        created_at: r.createdAt.toISOString(),
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching executions:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch executions",
      });
    }
  });

  app.get("/api/executions/:id/detail", async (req, res) => {
    try {
      const executionId = req.params.id;
      const instanceId = req.query.instanceId as string;
      if (!instanceId) {
        return res.status(400).json({ error: "instanceId query parameter is required" });
      }

      const rows = await db
        .select()
        .from(executionLogs)
        .where(and(
          eq(executionLogs.id, executionId),
          eq(executionLogs.instanceId, instanceId),
        ));

      if (rows.length === 0) {
        return res.status(404).json({ error: "Execution not found" });
      }

      const r = rows[0];
      res.json({
        id: r.id,
        execution_id: r.executionId,
        workflow_id: r.workflowId,
        workflow_name: r.workflowName,
        status: r.status,
        finished: r.finished,
        started_at: r.startedAt?.toISOString() ?? null,
        finished_at: r.finishedAt?.toISOString() ?? null,
        duration_ms: r.durationMs,
        mode: r.mode,
        node_count: r.nodeCount,
        error_message: r.errorMessage,
        execution_data: r.executionData,
        workflow_data: r.workflowData,
        created_at: r.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching execution detail:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch execution detail",
      });
    }
  });

  app.get("/api/executions/stats", async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string;
      if (!instanceId) {
        return res.status(400).json({ error: "instanceId query parameter is required" });
      }

      const result = await db.execute(sql`
        SELECT
          COUNT(*)::int AS "totalExecutions",
          COUNT(*) FILTER (WHERE status = 'success')::int AS "successCount",
          COUNT(*) FILTER (WHERE status = 'error')::int AS "errorCount",
          COUNT(*) FILTER (WHERE status = 'running')::int AS "runningCount",
          COUNT(*) FILTER (WHERE status = 'waiting')::int AS "waitingCount",
          COUNT(*) FILTER (WHERE status = 'canceled')::int AS "canceledCount",
          COALESCE(ROUND(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL)), 0)::int AS "avgDurationMs",
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE status = 'success')::numeric / COUNT(*)::numeric * 100, 1)
            ELSE 0
          END AS "successRate",
          MIN(created_at) AS "firstExecutionAt"
        FROM execution_logs
        WHERE instance_id = ${instanceId}
      `);

      const row = result.rows[0] as Record<string, unknown>;
      res.json({
        totalExecutions: row.totalExecutions,
        successCount: row.successCount,
        errorCount: row.errorCount,
        runningCount: row.runningCount,
        waitingCount: row.waitingCount,
        canceledCount: row.canceledCount,
        avgDurationMs: row.avgDurationMs,
        successRate: parseFloat(String(row.successRate)),
        firstExecutionAt: row.firstExecutionAt ?? null,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch statistics",
      });
    }
  });

  app.get("/api/executions/daily", async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string;
      if (!instanceId) {
        return res.status(400).json({ error: "instanceId query parameter is required" });
      }

      const days = parseInt(req.query.days as string) || 14;

      const result = await db.execute(sql`
        SELECT
          TO_CHAR(created_at::date, 'Mon DD') AS date,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'success')::int AS success,
          COUNT(*) FILTER (WHERE status = 'error')::int AS error
        FROM execution_logs
        WHERE instance_id = ${instanceId}
          AND created_at >= NOW() - MAKE_INTERVAL(days => ${days})
        GROUP BY created_at::date
        ORDER BY created_at::date
      `);

      // Fill in missing dates
      const dailyMap = new Map<string, { total: number; success: number; error: number }>();

      for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dailyMap.set(dateStr, { total: 0, success: 0, error: 0 });
      }

      for (const row of result.rows as Array<Record<string, unknown>>) {
        const trimmed = (row.date as string).replace(/\s+0?/, " ").trim();
        for (const [key] of Array.from(dailyMap.entries())) {
          if (key === trimmed || key.replace(",", "") === trimmed) {
            dailyMap.set(key, {
              total: row.total as number,
              success: row.success as number,
              error: row.error as number,
            });
            break;
          }
        }
      }

      const dailyStats = Array.from(dailyMap.entries()).map(([date, stats]) => ({
        date,
        ...stats,
      }));

      res.json(dailyStats);
    } catch (error) {
      console.error("Error fetching daily stats:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch daily statistics",
      });
    }
  });

  app.get("/api/executions/workflows", async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string;
      if (!instanceId) {
        return res.status(400).json({ error: "instanceId query parameter is required" });
      }

      const result = await db.execute(sql`
        SELECT
          workflow_name,
          COUNT(*)::int AS total_executions,
          COUNT(*) FILTER (WHERE status = 'success')::int AS successful,
          COUNT(*) FILTER (WHERE status = 'error')::int AS failed,
          COALESCE(ROUND(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL)), 0)::int AS avg_duration_ms
        FROM execution_logs
        WHERE instance_id = ${instanceId}
        GROUP BY workflow_name
        ORDER BY total_executions DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching workflow stats:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch workflow statistics",
      });
    }
  });

  app.get("/api/workflow-names", async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string;
      if (!instanceId) {
        return res.status(400).json({ error: "instanceId query parameter is required" });
      }

      const rows = await db
        .selectDistinct({ name: executionLogs.workflowName })
        .from(executionLogs)
        .where(eq(executionLogs.instanceId, instanceId))
        .orderBy(executionLogs.workflowName);

      res.json(rows.map((r) => r.name));
    } catch (error) {
      console.error("Error fetching workflow names:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch workflow names",
      });
    }
  });

  return httpServer;
}
