import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// n8n Instances table — stored in local PostgreSQL
export const n8nInstances = pgTable("n8n_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sshHost: text("ssh_host").notNull(),
  sshPort: integer("ssh_port").notNull().default(22),
  sshUser: text("ssh_user").notNull(),
  sshPrivateKeyPath: text("ssh_private_key_path").notNull(),
  dbHost: text("db_host").notNull().default("127.0.0.1"),
  dbPort: integer("db_port").notNull().default(5432),
  dbName: text("db_name").notNull(),
  dbUser: text("db_user").notNull(),
  dbPassword: text("db_password").notNull(),
  n8nBaseUrl: text("n8n_base_url").notNull().default("http://localhost:5678"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInstanceSchema = createInsertSchema(n8nInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type N8nInstance = typeof n8nInstances.$inferSelect;
export type InsertInstance = z.infer<typeof insertInstanceSchema>;

// Public type that strips sensitive fields
export type N8nInstancePublic = Omit<N8nInstance, "dbPassword" | "sshPrivateKeyPath">;

// n8n Execution Logs Types (matching remote DB schema)
export type ExecutionStatus = 'success' | 'error' | 'running' | 'waiting' | 'canceled';

export interface ExecutionLog {
  id: string;
  execution_id: string;
  workflow_id: string;
  workflow_name: string;
  status: ExecutionStatus;
  finished: boolean;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  mode: string | null;
  node_count: number | null;
  error_message: string | null;
  execution_data: Record<string, unknown> | null;
  workflow_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ExecutionStats {
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  runningCount: number;
  waitingCount: number;
  canceledCount: number;
  avgDurationMs: number;
  successRate: number;
}

export interface WorkflowStats {
  workflow_name: string;
  total_executions: number;
  successful: number;
  failed: number;
  avg_duration_ms: number;
}

export interface DailyStats {
  date: string;
  total: number;
  success: number;
  error: number;
}
