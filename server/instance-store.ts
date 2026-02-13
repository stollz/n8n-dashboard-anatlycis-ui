import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { n8nInstances, type N8nInstance, type N8nInstancePublic, type InsertInstance } from "@shared/schema";

function stripSensitive(instance: N8nInstance): N8nInstancePublic {
  const { dbPassword, sshPrivateKeyPath, ...pub } = instance;
  return pub;
}

export async function listInstances(): Promise<N8nInstancePublic[]> {
  const rows = await db.select().from(n8nInstances).orderBy(n8nInstances.createdAt);
  return rows.map(stripSensitive);
}

export async function getInstance(id: string): Promise<N8nInstance | null> {
  const rows = await db.select().from(n8nInstances).where(eq(n8nInstances.id, id));
  return rows[0] ?? null;
}

export async function getInstancePublic(id: string): Promise<N8nInstancePublic | null> {
  const inst = await getInstance(id);
  return inst ? stripSensitive(inst) : null;
}

export async function createInstance(data: InsertInstance): Promise<N8nInstancePublic> {
  const rows = await db.insert(n8nInstances).values(data).returning();
  return stripSensitive(rows[0]);
}

export async function updateInstance(id: string, data: Partial<InsertInstance>): Promise<N8nInstancePublic | null> {
  const rows = await db
    .update(n8nInstances)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(n8nInstances.id, id))
    .returning();
  return rows[0] ? stripSensitive(rows[0]) : null;
}

export async function deleteInstance(id: string): Promise<boolean> {
  const rows = await db.delete(n8nInstances).where(eq(n8nInstances.id, id)).returning();
  return rows.length > 0;
}
