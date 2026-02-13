# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

n8n Execution Dashboard UI — a full-stack observability dashboard for monitoring n8n workflow executions. It connects to remote PostgreSQL databases over SSH tunnels to read `n8n_execution_logs` data populated by n8n hooks (configured in a separate companion repo: `avanaihq/n8n-dashboard-analytics`).

Supports **multiple n8n instances** — users can CRUD instance configs and switch between them in the UI.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite HMR) on port 5000 |
| `npm run build` | Production build (Vite for client → `dist/public/`, esbuild for server → `dist/index.cjs`) |
| `npm run start` | Run production build |
| `npm run check` | TypeScript type checking (`tsc`) |
| `npm run db:push` | Push Drizzle schema to local PostgreSQL (creates `n8n_instances` table) |

## Architecture

```
client/          → React 18 + TypeScript frontend (Vite)
server/          → Express 5 backend (TypeScript, runs with tsx)
shared/          → Shared TypeScript types and Drizzle schema
script/          → Build script (esbuild + vite orchestration)
```

### Data flow

n8n instance (hooks) → Remote PostgreSQL `n8n_execution_logs` table → SSH tunnel → Express API → React dashboard

Instance configs stored in a local PostgreSQL database via Drizzle ORM.

### Backend (`server/`)

- **`index.ts`** — Express setup, middleware, logging, Vite dev server integration, graceful shutdown
- **`db.ts`** — Drizzle ORM connection to local config PostgreSQL (`DATABASE_URL`)
- **`instance-store.ts`** — CRUD functions for n8n instance configs (public variants strip sensitive fields)
- **`tunnel-manager.ts`** — SSH tunnel lifecycle: creates SSH connections, local TCP proxies, and pg.Pool per instance with 10-min idle auto-cleanup
- **`routes.ts`** — API endpoints:
  - Instance CRUD: `GET/POST /api/instances`, `GET/PUT/DELETE /api/instances/:id`, `POST /api/instances/:id/test-connection`
  - Execution data (all require `?instanceId=xxx`): `GET /api/executions`, `GET /api/executions/stats`, `GET /api/executions/daily`, `GET /api/executions/workflows`

### Frontend (`client/src/`)

- **Routing**: Wouter (lightweight, single-page)
- **State/Data fetching**: TanStack Query (React Query)
- **UI layer**: shadcn/ui (new-york style) + Radix UI primitives + Tailwind CSS
- **Charts**: Recharts (area chart for trends, pie chart for status distribution)
- **Data table**: AG Grid Community with custom cell renderers
- **Theming**: Dark/light mode via CSS class strategy with context provider (`theme-provider.tsx`), persisted in localStorage
- **Instance management**: `instance-context.tsx` (React context for selected instance), `instance-selector.tsx` (header dropdown), `instance-manage-dialog.tsx` (list/delete/test), `instance-form-dialog.tsx` (create/edit form)

Key pages: `pages/dashboard.tsx` is the main (and only real) page.

### Shared types (`shared/schema.ts`)

Defines `n8nInstances` Drizzle table, `N8nInstance`/`N8nInstancePublic` types, `ExecutionLog`, `ExecutionStats`, `DailyStats`, `WorkflowStats` interfaces, plus Drizzle table definitions for `users`.

## Path Aliases

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

Configured in both `tsconfig.json` and `vite.config.ts`.

## Environment Variables

```
DATABASE_URL=postgresql://...   # Local PostgreSQL for instance configs + drizzle-kit
```

No Supabase credentials needed. Each n8n instance's SSH and DB credentials are stored in the local database.

## Key Conventions

- shadcn/ui components live in `client/src/components/ui/` — add new ones via shadcn CLI conventions
- Tailwind theme uses HSL CSS variables defined in `client/src/index.css`
- AG Grid themes switch between `themeQuartz` and `themeQuartzDark` based on the app's theme context
- The execution table links to n8n using the instance's configured `n8nBaseUrl`: `{n8nBaseUrl}/workflow/{workflow_id}/executions/{execution_id}`
- Server serves both API and static frontend on port 5000
- SSH tunnels use key-based auth only (no password auth)
