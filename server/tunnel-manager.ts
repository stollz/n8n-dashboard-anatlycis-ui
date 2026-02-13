import { Client as SSHClient } from "ssh2";
import net from "net";
import pg from "pg";
import fs from "fs";
import type { N8nInstance } from "@shared/schema";

interface TunnelEntry {
  pool: pg.Pool;
  sshClient: SSHClient;
  localServer: net.Server;
  localPort: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  lastUsed: number;
}

const tunnels = new Map<string, TunnelEntry>();
const pendingTunnels = new Map<string, Promise<TunnelEntry>>();
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function resetIdleTimer(id: string) {
  const entry = tunnels.get(id);
  if (!entry) return;
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.lastUsed = Date.now();
  entry.idleTimer = setTimeout(() => {
    console.log(`[tunnel-manager] Idle timeout for instance ${id}, closing tunnel`);
    closeTunnel(id);
  }, IDLE_TIMEOUT_MS);
}

function createTunnel(instance: N8nInstance): Promise<TunnelEntry> {
  return new Promise((resolve, reject) => {
    const sshClient = new SSHClient();
    let privateKey: string;

    try {
      privateKey = fs.readFileSync(instance.sshPrivateKeyPath, "utf-8");
    } catch (err) {
      return reject(new Error(`Failed to read SSH private key at ${instance.sshPrivateKeyPath}: ${err}`));
    }

    sshClient.on("ready", () => {
      // Create a local TCP server that forwards connections through the SSH tunnel
      const localServer = net.createServer((socket) => {
        sshClient.forwardOut(
          "127.0.0.1",
          0,
          instance.dbHost,
          instance.dbPort,
          (err, stream) => {
            if (err) {
              console.error(`[tunnel-manager] Forward error for instance ${instance.id}:`, err);
              socket.destroy();
              return;
            }
            socket.pipe(stream).pipe(socket);
          }
        );
      });

      localServer.listen(0, "127.0.0.1", () => {
        const addr = localServer.address() as net.AddressInfo;
        const localPort = addr.port;

        const pool = new pg.Pool({
          host: "127.0.0.1",
          port: localPort,
          database: instance.dbName,
          user: instance.dbUser,
          password: instance.dbPassword,
          max: 5,
          idleTimeoutMillis: 30000,
        });

        const entry: TunnelEntry = {
          pool,
          sshClient,
          localServer,
          localPort,
          idleTimer: null,
          lastUsed: Date.now(),
        };

        resolve(entry);
      });

      localServer.on("error", (err) => {
        console.error(`[tunnel-manager] Local server error for instance ${instance.id}:`, err);
        reject(err);
      });
    });

    sshClient.on("error", (err) => {
      console.error(`[tunnel-manager] SSH error for instance ${instance.id}:`, err);
      closeTunnel(instance.id);
      reject(err);
    });

    sshClient.on("close", () => {
      console.log(`[tunnel-manager] SSH connection closed for instance ${instance.id}`);
      closeTunnel(instance.id);
    });

    sshClient.connect({
      host: instance.sshHost,
      port: instance.sshPort,
      username: instance.sshUser,
      privateKey,
      readyTimeout: 30000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 3,
    });
  });
}

export async function getPoolForInstance(instance: N8nInstance): Promise<pg.Pool> {
  const existing = tunnels.get(instance.id);
  if (existing) {
    resetIdleTimer(instance.id);
    return existing.pool;
  }

  // Deduplicate concurrent tunnel creation for the same instance
  const pending = pendingTunnels.get(instance.id);
  if (pending) {
    const entry = await pending;
    resetIdleTimer(instance.id);
    return entry.pool;
  }

  const promise = createTunnel(instance).then((entry) => {
    tunnels.set(instance.id, entry);
    pendingTunnels.delete(instance.id);
    resetIdleTimer(instance.id);
    return entry;
  }).catch((err) => {
    pendingTunnels.delete(instance.id);
    throw err;
  });

  pendingTunnels.set(instance.id, promise);
  const entry = await promise;
  return entry.pool;
}

export function closeTunnel(id: string): void {
  const entry = tunnels.get(id);
  if (!entry) return;

  if (entry.idleTimer) clearTimeout(entry.idleTimer);

  try { entry.pool.end().catch(() => {}); } catch {}
  try { entry.localServer.close(); } catch {}
  try { entry.sshClient.end(); } catch {}

  tunnels.delete(id);
  console.log(`[tunnel-manager] Tunnel closed for instance ${id}`);
}

export function closeAllTunnels(): void {
  const ids = Array.from(tunnels.keys());
  for (const id of ids) {
    closeTunnel(id);
  }
}

export async function testConnection(instance: N8nInstance): Promise<{ success: boolean; error?: string }> {
  const resources: { pool?: pg.Pool; server?: net.Server; ssh?: SSHClient } = {};

  try {
    const privateKey = fs.readFileSync(instance.sshPrivateKeyPath, "utf-8");

    const { pool, sshClient, localServer } = await new Promise<{
      pool: pg.Pool;
      sshClient: SSHClient;
      localServer: net.Server;
    }>((resolve, reject) => {
      const ssh = new SSHClient();
      resources.ssh = ssh;

      ssh.on("ready", () => {
        const server = net.createServer((socket) => {
          ssh.forwardOut("127.0.0.1", 0, instance.dbHost, instance.dbPort, (err, stream) => {
            if (err) { socket.destroy(); return; }
            socket.pipe(stream).pipe(socket);
          });
        });

        resources.server = server;
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address() as net.AddressInfo;
          const p = new pg.Pool({
            host: "127.0.0.1",
            port: addr.port,
            database: instance.dbName,
            user: instance.dbUser,
            password: instance.dbPassword,
            max: 1,
            connectionTimeoutMillis: 10000,
          });
          resources.pool = p;
          resolve({ pool: p, sshClient: ssh, localServer: server });
        });
      });

      ssh.on("error", (err) => reject(err));

      setTimeout(() => reject(new Error("SSH connection timeout")), 30000);

      ssh.connect({
        host: instance.sshHost,
        port: instance.sshPort,
        username: instance.sshUser,
        privateKey,
        readyTimeout: 30000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 3,
      });
    });

    // Test the actual DB query
    const result = await pool.query("SELECT 1 AS ok");
    if (result.rows[0]?.ok !== 1) {
      throw new Error("Unexpected query result");
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try { resources.pool?.end().catch(() => {}); } catch {}
    try { resources.server?.close(); } catch {}
    try { resources.ssh?.end(); } catch {}
  }
}
