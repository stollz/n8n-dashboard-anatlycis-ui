# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

n8n Execution Dashboard UI — a full-stack observability dashboard for monitoring n8n workflow executions. Connects to remote PostgreSQL databases over SSH tunnels, syncs execution data to a local cache, and serves it via Express API to a React frontend.

Supports **multiple n8n instances** — users can CRUD instance configs and switch between them in the UI.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite HMR) on port 5000 |
| `npm run build` | Production build (Vite → `dist/public/`, esbuild → `dist/index.cjs`) |
| `npm run start` | Run production build |
| `npm run check` | TypeScript type checking — the only quality gate (no linter or tests) |
| `npm run db:push` | Push Drizzle schema to local PostgreSQL |

Production process management: `server.sh start|stop|restart [dev|prod]` or `ecosystem.config.cjs` (PM2).

## Architecture

```
client/          → React 18 + TypeScript frontend (Vite)
server/          → Express 5 backend (TypeScript, runs with tsx)
shared/          → Shared types and Drizzle schema (single source of truth)
script/          → Build script (esbuild + vite orchestration)
```

### Data flow

The app uses a **local cache + poller** pattern — the frontend never queries remote databases directly:

```
Remote n8n PostgreSQL (per-instance, via SSH tunnel)
  → poller.ts (every 60s, batch upsert to local cache)
    → Local PostgreSQL (execution_logs table)
      → Express API (reads from local cache only)
        → React frontend (TanStack Query)
```

Instance configs are stored in the local PostgreSQL database via Drizzle ORM.

### Backend (`server/`)

- **`index.ts`** — Express setup, optional basic auth (enabled when `AUTH_USER`/`AUTH_PASSWORD` env vars are set), request logging, startup sequence: `registerRoutes` → `normalizeExistingStatuses` → `startPoller` → `ensureSearchIndexes`
- **`routes.ts`** — API endpoints (all execution queries read from local cache, not SSH tunnels):
  - Instance CRUD: `GET/POST /api/instances`, `GET/PUT/DELETE /api/instances/:id`, `POST /api/instances/:id/test-connection`
  - Sync: `GET /api/sync-status`, `POST /api/instances/:id/sync`
  - Execution data (all require `?instanceId=`): `GET /api/executions`, `GET /api/executions/:id/detail`, `GET /api/executions/stats`, `GET /api/executions/daily`, `GET /api/executions/workflows`, `GET /api/workflow-names`
- **`poller.ts`** — Background sync engine: polls all instances every 60s, incremental sync with 5-min clock skew buffer, batch upserts (500 rows), normalizes statuses, tracks sync state in `syncStatus` table
- **`tunnel-manager.ts`** — SSH tunnel lifecycle: creates SSH connections + local TCP proxies + pg.Pool per instance, deduplicates concurrent tunnel requests via `pendingTunnels` Map, 10-min idle auto-cleanup
- **`db.ts`** — Drizzle ORM connection to local PostgreSQL. Contains `normalizeExistingStatuses()` (startup fix for non-canonical status values) and `ensureSearchIndexes()` (idempotent tsvector + GIN index setup for fulltext search)
- **`instance-store.ts`** — CRUD for instance configs. `stripSensitive()` removes `dbPassword`/`sshPrivateKeyPath` for all public API responses
- **`storage.ts`** — Vestigial `MemStorage` class for users (unused, leftover from template)

### Frontend (`client/src/`)

- **Routing**: Wouter — single page app, `pages/dashboard.tsx` is the only real page
- **State/Data**: TanStack Query with query keys as literal URL strings (e.g. `"/api/executions?instanceId=xxx"`)
- **UI**: shadcn/ui (new-york style) + Radix UI + Tailwind CSS
- **Charts**: Recharts (area chart for daily trends, donut chart for status distribution)
- **Data table**: AG Grid Community with custom cell renderers, parameterized themes (not CSS class switching)
- **Theming**: Dark/light via CSS class on `<html>`, persisted in localStorage
- **Instance context**: `lib/instance-context.tsx` — React context for selected instance, persisted to localStorage

Key component: `components/execution-table.tsx` contains both the AG Grid list view and `ExecutionDetailModal` (lazy-loads full JSONB data, renders node execution timeline with `json-tree.tsx` for recursive JSON viewing).

### Shared types (`shared/schema.ts`)

Drizzle tables:
- `n8nInstances` — per-instance SSH/DB/n8n credentials
- `executionLogs` — local cache of synced executions (7 composite indexes, `search_tsv` tsvector column, unique constraint on `(instanceId, executionId)` for upserts)
- `syncStatus` — one row per instance tracking last sync state
- `users` — vestigial, unused

Key exports: `normalizeStatus()` function, `ExecutionStatus` type (`'success' | 'error' | 'running' | 'waiting' | 'canceled'`), `N8nInstancePublic` (strips sensitive fields), `insertInstanceSchema` (Zod validation).

## Path Aliases

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

Configured in both `tsconfig.json` and `vite.config.ts`.

## Environment Variables

```
DATABASE_URL=postgresql://...      # Local PostgreSQL for instance configs + execution cache
AUTH_USER=...                      # Optional: enables basic auth when both are set
AUTH_PASSWORD=...                  # Optional: enables basic auth when both are set
```

Each n8n instance's SSH and DB credentials are stored in the local database, not in env vars.

## Key Conventions

- **snake_case boundary**: DB uses snake_case, Drizzle returns camelCase, but routes manually map back to snake_case for API responses (frontend `ExecutionLog` interface uses snake_case field names)
- **Security**: `N8nInstancePublic` type + `stripSensitive()` ensure passwords/key paths never leave the server. SSH uses key-based auth only.
- **Heavy JSONB excluded from list queries**: `execution_data` and `workflow_data` are only fetched on the detail endpoint (`/api/executions/:id/detail`)
- **Detail endpoint uses `res.send(JSON.stringify(...))`** instead of `res.json()` to avoid double-serialization (the logging middleware patches `res.json`)
- shadcn/ui components live in `client/src/components/ui/`
- Tailwind theme uses HSL CSS variables in `client/src/index.css` with custom `status.*` color tokens
- AG Grid themes use `themeQuartz.withParams()` parameterized approach
- Execution table links to n8n via `{n8nBaseUrl}/workflow/{workflow_id}/executions/{execution_id}`
- Server serves both API and static frontend on port 5000
- Fulltext search uses tsvector GIN index over workflow names, error messages, and JSONB data
