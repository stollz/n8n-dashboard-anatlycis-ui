# n8n Execution Dashboard UI

An enterprise-grade observability dashboard for monitoring n8n workflow executions. This beautiful, real-time analytics UI visualizes all your n8n workflow runs, providing insights into successful executions, failures, average durations, and detailed execution logs.

![Dashboard Preview](attached_assets/preview.png)

## 🎬 About This Project

This project was built as part of a technical deep-dive podcast featuring **[Aemal Sayer](https://aemalsayer.com)** (CTO & Co-Founder of [Avanai](https://avanai.io), n8n Ambassador) and **[Dylan Watkins](https://www.linkedin.com/in/dylanjwatkins/)**. The goal was to demonstrate how to build enterprise-level observability for n8n workflows.

> *"Everyone is asking about observability. What we are going to build is a locally hosted n8n instance running in a Docker container... and then we're going to build this amazing dashboard that shows all the executions, the ones that were successful, the failed ones, the average duration, some diagrams, and important - the whole data of that, like the details, and also a link that you can open and then go directly to that particular workflow that failed with the error."* — Aemal Sayer

### ⚡ Built with Replit

This entire dashboard UI was built using **[Replit](https://replit.com)**, showcasing how the AI coding industry is shifting towards **super-fast, 10x developer experiences**. With AI-assisted development tools, what would traditionally take days or weeks can now be accomplished in hours - enabling rapid prototyping, iteration, and deployment of production-ready applications.

## 🏗️ Architecture

The system works by leveraging n8n's **hooks** feature (not webhooks!) to capture workflow execution events:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   n8n Instance  │────▶│    Supabase     │────▶│  Dashboard UI   │
│   (with hooks)  │     │    Database     │     │   (this repo)   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Hooks capture          Stores all           Visualizes
     post-execution        execution data         analytics
```

**How it works:**
1. Your n8n instance is configured with hooks that trigger after every workflow execution
2. The hook sends execution data (status, duration, errors, etc.) to a Supabase database
3. This dashboard UI reads from Supabase and displays beautiful, real-time analytics

## 🔗 Companion Repository

**The n8n instance with hooks configuration lives in a separate repository:**

### 👉 [n8n-dashboard-analytics](https://github.com/avanaihq/n8n-dashboard-analytics)

That repository contains:
- Docker Compose setup for running n8n locally
- **Hooks configuration** that captures all workflow execution data
- Schema files for the Supabase database

## ✨ Features

- **📊 Real-time Statistics** - Total executions, success rate, failure count, and average duration
- **📈 Execution Trends Chart** - Visual timeline of successful vs failed executions
- **🥧 Status Distribution** - Pie chart showing the breakdown of execution statuses
- **📋 Detailed Execution Logs** - AG Grid-powered table with:
  - Workflow name, status, timestamps, duration, mode, node count
  - Error messages for failed executions
  - **Direct links** to open the specific execution in your n8n instance
- **🌓 Dark/Light Mode** - Beautiful themed UI that adapts to your preference
- **🔄 Real-time Refresh** - Manually refresh data or configure auto-refresh

## 🛠️ Tech Stack

- **Development Platform**: [Replit](https://replit.com) (AI-assisted development)
- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: Hero UI, Tailwind CSS
- **Data Grid**: AG Grid Community
- **Charts**: Recharts
- **Backend**: Next.js
- **Database**: Supabase (PostgreSQL)
- **State Management**: TanStack Query (React Query)

## 📋 Prerequisites

1. **Supabase Account** - Create a free account at [supabase.com](https://supabase.com)
2. **n8n Instance** - Set up using the [companion repository](https://github.com/avanaihq/n8n-dashboard-analytics)
3. **Node.js** - Version 18+ recommended

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone git@github.com:avanaihq/n8n-dashboard-analytics.git
cd n8n-dashboard-anatlycis-ui
```

### 2. Set Up Supabase Database

Run the following SQL in your Supabase SQL Editor to create the required table:

```sql
CREATE TABLE n8n_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core execution info
  execution_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  
  -- Execution status
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running', 'waiting', 'canceled')),
  finished BOOLEAN DEFAULT false,
  
  -- Timing
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Execution mode (manual, trigger, webhook, etc.)
  mode TEXT,
  
  -- Summary metadata (quick lookups)
  node_count INTEGER,
  error_message TEXT,
  
  -- Detailed execution data (JSONB for flexibility)
  execution_data JSONB,  -- Full run data, node outputs, etc.
  workflow_data JSONB,   -- Workflow definition/structure
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint on execution_id
  CONSTRAINT unique_execution UNIQUE (execution_id)
);

-- ============================================
-- Indexes for performance
-- ============================================

CREATE INDEX idx_execution_logs_workflow_id ON n8n_execution_logs(workflow_id);
CREATE INDEX idx_execution_logs_workflow_name ON n8n_execution_logs(workflow_name);
CREATE INDEX idx_execution_logs_status ON n8n_execution_logs(status);
CREATE INDEX idx_execution_logs_created_at ON n8n_execution_logs(created_at DESC);
CREATE INDEX idx_execution_logs_finished_at ON n8n_execution_logs(finished_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_execution_logs_execution_data ON n8n_execution_logs USING GIN (execution_data);
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

> ⚠️ Use the **Service Role Key** (not the anon key) 

### 4. Install Dependencies & Run

```bash
npm install
npm run dev
```

The dashboard will be available at `http://localhost:5000` (or the port shown in your terminal).

## 📦 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run check` | TypeScript type checking |

## 🧩 Understanding n8n Hooks

Hooks in n8n are **not webhooks**. They are internal event callbacks that fire when specific events occur in your n8n instance. For this dashboard, we use the `workflow.postExecute` hook which fires after every workflow execution completes.

The hook captures:
- Execution ID and Workflow ID
- Workflow name
- Execution status (success/error/running/waiting/canceled)
- Start and finish timestamps
- Duration in milliseconds
- Execution mode (manual, trigger, webhook, etc.)
- Node count
- Error messages (if any)
- Full execution data (optional, stored as JSONB)

Learn more about setting up hooks in the [companion repository](https://github.com/avanaihq/n8n-dashboard-analytics).


## Related Resources

- [n8n Documentation](https://docs.n8n.io/)
- [Supabase Documentation](https://supabase.com/docs)
- [n8n Dashboard Analytics Repository](https://github.com/avanaihq/n8n-dashboard-anatlycis)

## Credits

Built by **[Avanai](https://avanai.io)**

**[Aemal Sayer](https://aemalsayer.com)** - CTO & Co-Founder of Avanai | n8n Ambassador

---

### Need Help with n8n or AI Agents?

If you are looking for experts in building n8n workflows and AI agents for enterprises, contact us at **[Avanai.io](https://avanai.io)**
