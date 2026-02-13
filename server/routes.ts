import type { Express } from "express";
import type { Server } from "http";
import { insertInstanceSchema } from "@shared/schema";
import {
  listInstances,
  getInstance,
  getInstancePublic,
  createInstance,
  updateInstance,
  deleteInstance,
} from "./instance-store";
import {
  getPoolForInstance,
  closeTunnel,
  testConnection,
} from "./tunnel-manager";

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

  // ─── Execution endpoints (parameterized by instanceId) ────────

  async function getInstancePool(instanceId: string | undefined, res: any) {
    if (!instanceId) {
      res.status(400).json({ error: "instanceId query parameter is required" });
      return null;
    }
    const inst = await getInstance(instanceId);
    if (!inst) {
      res.status(404).json({ error: "Instance not found" });
      return null;
    }
    try {
      return await getPoolForInstance(inst);
    } catch (err) {
      console.error("Error getting pool for instance:", err);
      res.status(502).json({
        error: `Failed to connect to instance: ${err instanceof Error ? err.message : String(err)}`,
      });
      return null;
    }
  }

  app.get("/api/executions", async (req, res) => {
    try {
      const pool = await getInstancePool(req.query.instanceId as string, res);
      if (!pool) return;

      const limit = parseInt(req.query.limit as string) || 100;

      const result = await pool.query(
        `SELECT * FROM n8n_execution_logs ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching executions:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch executions",
      });
    }
  });

  app.get("/api/executions/stats", async (req, res) => {
    try {
      const pool = await getInstancePool(req.query.instanceId as string, res);
      if (!pool) return;

      const result = await pool.query(`
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
          END AS "successRate"
        FROM n8n_execution_logs
      `);

      const row = result.rows[0];
      res.json({
        totalExecutions: row.totalExecutions,
        successCount: row.successCount,
        errorCount: row.errorCount,
        runningCount: row.runningCount,
        waitingCount: row.waitingCount,
        canceledCount: row.canceledCount,
        avgDurationMs: row.avgDurationMs,
        successRate: parseFloat(row.successRate),
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
      const pool = await getInstancePool(req.query.instanceId as string, res);
      if (!pool) return;

      const days = parseInt(req.query.days as string) || 14;

      const result = await pool.query(
        `
        SELECT
          TO_CHAR(created_at::date, 'Mon DD') AS date,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'success')::int AS success,
          COUNT(*) FILTER (WHERE status = 'error')::int AS error
        FROM n8n_execution_logs
        WHERE created_at >= NOW() - MAKE_INTERVAL(days => $1)
        GROUP BY created_at::date
        ORDER BY created_at::date
        `,
        [days]
      );

      // Fill in missing dates
      const dailyMap = new Map<string, { total: number; success: number; error: number }>();

      for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dailyMap.set(dateStr, { total: 0, success: 0, error: 0 });
      }

      for (const row of result.rows) {
        // Normalize "Mon DD" → "Mon D" format from Postgres TO_CHAR to match JS toLocaleDateString
        const trimmed = row.date.replace(/\s+0?/, " ").trim();
        // Try to find a matching key
        for (const [key] of Array.from(dailyMap.entries())) {
          if (key === trimmed || key.replace(",", "") === trimmed) {
            dailyMap.set(key, {
              total: row.total,
              success: row.success,
              error: row.error,
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
      const pool = await getInstancePool(req.query.instanceId as string, res);
      if (!pool) return;

      const result = await pool.query(`
        SELECT
          workflow_name,
          COUNT(*)::int AS total_executions,
          COUNT(*) FILTER (WHERE status = 'success')::int AS successful,
          COUNT(*) FILTER (WHERE status = 'error')::int AS failed,
          COALESCE(ROUND(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL)), 0)::int AS avg_duration_ms
        FROM n8n_execution_logs
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

  return httpServer;
}
