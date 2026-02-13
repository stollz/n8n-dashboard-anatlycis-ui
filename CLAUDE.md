# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

n8n Execution Dashboard UI — a full-stack observability dashboard for monitoring n8n workflow executions. It reads execution data from a Supabase (PostgreSQL) database that is populated by n8n hooks (configured in a separate companion repo: `avanaihq/n8n-dashboard-analytics`).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite HMR) on port 5000 |
| `npm run build` | Production build (Vite for client → `dist/public/`, esbuild for server → `dist/index.cjs`) |
| `npm run start` | Run production build |
| `npm run check` | TypeScript type checking (`tsc`) |
| `npm run db:push` | Push Drizzle schema to database |

## Architecture

```
client/          → React 18 + TypeScript frontend (Vite)
server/          → Express 5 backend (TypeScript, runs with tsx)
shared/          → Shared TypeScript types and Drizzle schema
script/          → Build script (esbuild + vite orchestration)
```

### Data flow

n8n instance (hooks) → Supabase `n8n_execution_logs` table → Express API → React dashboard

### Backend (`server/`)

- **`index.ts`** — Express setup, middleware, logging, Vite dev server integration
- **`routes.ts`** — Four API endpoints, all reading from Supabase:
  - `GET /api/executions` — Paginated execution logs (default limit: 100)
  - `GET /api/executions/stats` — Aggregated counts and rates
  - `GET /api/executions/daily?days=14` — Daily success/error counts for charts
  - `GET /api/executions/workflows` — Per-workflow statistics
- **`supabase.ts`** — Supabase client init (requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` env vars)

### Frontend (`client/src/`)

- **Routing**: Wouter (lightweight, single-page)
- **State/Data fetching**: TanStack Query (React Query)
- **UI layer**: shadcn/ui (new-york style) + Radix UI primitives + Tailwind CSS
- **Charts**: Recharts (area chart for trends, pie chart for status distribution)
- **Data table**: AG Grid Community with custom cell renderers
- **Theming**: Dark/light mode via CSS class strategy with context provider (`theme-provider.tsx`), persisted in localStorage

Key pages: `pages/dashboard.tsx` is the main (and only real) page.

### Shared types (`shared/schema.ts`)

Defines `ExecutionLog`, `ExecutionStats`, `DailyStats`, `WorkflowStats` interfaces plus Drizzle table definitions for `users`.

## Path Aliases

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

Configured in both `tsconfig.json` and `vite.config.ts`.

## Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
DATABASE_URL=postgresql://...   # only needed for drizzle-kit migrations
```

The service role key (not anon key) is required for the Supabase client.

## Key Conventions

- shadcn/ui components live in `client/src/components/ui/` — add new ones via shadcn CLI conventions
- Tailwind theme uses HSL CSS variables defined in `client/src/index.css`
- AG Grid themes switch between `themeQuartz` and `themeQuartzDark` based on the app's theme context
- The execution table links to n8n at `http://localhost:5678/workflow/{workflow_id}/executions/{execution_id}`
- Server serves both API and static frontend on port 5000
