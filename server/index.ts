import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { closeAllTunnels } from "./tunnel-manager";
import { startPoller, stopPoller } from "./poller";
import { ensureSearchIndexes } from "./db";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Basic auth — only enabled when AUTH_USER and AUTH_PASSWORD are set
const authUser = process.env.AUTH_USER;
const authPassword = process.env.AUTH_PASSWORD;
if (authUser && authPassword) {
  const expected = "Basic " + Buffer.from(`${authUser}:${authPassword}`).toString("base64");
  app.use((req, res, next) => {
    if (req.headers.authorization === expected) {
      return next();
    }
    res.setHeader("WWW-Authenticate", 'Basic realm="n8n Dashboard"');
    res.status(401).send("Unauthorized");
  });
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !path.includes("/detail")) {
        const jsonStr = JSON.stringify(capturedJsonResponse);
        if (jsonStr.length <= 2000) {
          logLine += ` :: ${jsonStr}`;
        } else {
          logLine += ` :: [${jsonStr.length} bytes]`;
        }
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  await startPoller();
  ensureSearchIndexes().catch((err) =>
    console.error("Failed to create search indexes:", err)
  );

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // Graceful shutdown
  const shutdown = () => {
    log("Shutting down, stopping poller and closing SSH tunnels...");
    stopPoller();
    closeAllTunnels();
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
