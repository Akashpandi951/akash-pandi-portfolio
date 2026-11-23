# ⚡ B. Akash Pandi — Enterprise Full-Stack Portfolio & MCP Automation System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Queue-FF4500?logo=redis&logoColor=white)](https://bullmq.io/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Official%20SDK-7023EC?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![Security](https://img.shields.io/badge/Security-Helmet%20%7C%20RBAC%20%7C%20Turnstile-success)](https://helmetjs.github.io/)

A production-grade, full-stack personal portfolio and enterprise automation ecosystem designed for high-traffic scalability, autonomous AI agent interactions, and secure administrative management.

---

## 🌟 Key Features & Architecture

### 1. Portfolio Frontend (`http://localhost:3000/`)
- **Interactive 3D Neon Tubes Background**: Powered by WebGL (`threejs-components`), offering responsive cursor tracking physics, ambient undulation waves, and instantaneous palette randomizer (`[T]` or click).
- **Stacking Cards Milestone Deck (`#projects`)**: Sticky stacking card physics with scale compaction (`1.00x → 0.94x`) and depth dimming (`1.00 → 0.78`).
- **Exploded View Assembly (`#architecture`)**: 3-phase scroll-driven product deconstruction that separates into layered 3D components and locks back into a synchronized modular grid.
- **The Convergence Nexus (`#nexus`)**: Central Intelligence Core that dynamically expands on scroll (`0.88x → 1.60x`), shooting neon laser conduits to 8 surrounding satellite skill nodes.
- **macOS MagnificationDock**: Spring-physics docked navigation bar with dynamic icon scaling, tooltip labels, active section trackers, and mobile responsiveness.
- **Spotlight Command Palette**: Keyboard-accessible (`⌘K` / `Ctrl+K`) omnibox for lightning-fast navigation, project lookups, and real-time color theme switching (Crimson, Titanium, Obsidian, Emerald, Amber).
- **Interactive AI Assistant**: Real-time floating conversational chatbot powered by Google Gemini AI.

### 2. Admin Command Center (`http://localhost:3000/admin`)
- **JWT & Bcrypt Security**: Multi-factor authentication with encrypted sessions, token expiration, and Role-Based Access Control (RBAC).
- **Real-Time Enquiry Inbox**: Filter by status (`new`, `in_review`, `replied`, `archived`) and priority (`urgent`, `high`, `normal`, `low`).
- **Gemini AI Email Reply Assistant**: Automatically synthesizes contextually aware, professional email drafts with one click.
- **Queue & Worker Telemetry**: Live metrics on waiting, active, completed, and failed jobs.
- **Compliance Audit Ledger**: Tamper-evident logging of every admin login, status mutation, and export event.
- **Export Engine**: One-click streaming export of enquiry records in CSV or JSON.

### 3. Model Context Protocol (MCP) Server (`npm run mcp`)
Dedicated MCP server built with the official `@modelcontextprotocol/sdk`, enabling Claude Desktop, Cursor, Antigravity, or any LLM agent to interact with the backend via 8 secure tools:
1. `list_enquiries` — Paginated query of incoming contact requests.
2. `search_enquiries` — Full-text search across names, emails, companies, and messages.
3. `get_enquiry_details` — Retrieve full conversation and metadata by ID.
4. `update_request_status` — Transition workflow statuses (`new`, `in_review`, `replied`, `archived`).
5. `view_analytics` — Aggregate KPI reports, category distributions, and conversion rates.
6. `monitor_queue_health` — Real-time telemetry on BullMQ / in-memory queues and workers.
7. `retry_failed_jobs` — Re-dispatch failed asynchronous notification tasks.
8. `export_enquiry_data` — Export authorized data as structured JSON or CSV.

### 4. Resilient Backend Architecture
- **Dual-Mode Persistence**: Primary PostgreSQL storage via Prisma ORM with an automatic fallback to an in-memory repository for instant zero-dependency local development.
- **Dual-Mode Asynchronous Queue**: BullMQ & Redis worker queue with configurable concurrency (`WORKER_CONCURRENCY=5`) and automatic fallback to an in-memory priority queue with exponential backoff retries.
- **Idempotency Protection**: SHA-256 fingerprinting and deterministic deduplication to eliminate race conditions and repeated submissions under heavy load.
- **Comprehensive Security Suite**: Helmet CSP, CORS allowlisting, rate limiting (100 req/15min), Cloudflare Turnstile bot verification, and XSS sanitization.

---

## 📁 Repository Structure

```
akash-pandi-portfolio/
├── .agent/                             # Agent configuration & Impeccable UI skill
├── .env.example                        # Safe environment configuration template
├── .gitignore                          # Strict gitignore covering secrets, certs, logs
├── admin.html                          # Admin Command Center interface
├── api/                                # Standalone / legacy Express serverless modules
│   ├── admin.js                        # Admin endpoints
│   ├── ai.js                           # Gemini AI drafting
│   ├── contact.js                      # Contact ingestion
│   ├── devStore.js                     # Local store fallback
│   ├── email.js                        # Resend notification dispatcher
│   └── middleware.js                   # Auth & rate limit handlers
├── assets/                             # Static visual assets
│   ├── akash_portrait.jpg              # High-resolution optimized portrait
│   └── project_preview.jpg             # Project preview mockup
├── dist/                               # Production-compiled TypeScript artifacts
├── index.html                          # Main Portfolio Home Page
├── index_single_file_preview.html      # Self-contained offline preview version
├── package.json                        # Dependencies, scripts, and package metadata
├── prisma/                             # Database schema & migrations
│   └── schema.prisma                   # PostgreSQL Prisma schema definition
├── src/                                # Modular TypeScript Source Code
│   ├── api/
│   │   ├── middleware/                 # Auth & Zod validation middleware
│   │   └── routes/                     # /api/contact, /api/admin, /api/ai routes
│   ├── config/                         # Environment config & Pino logger
│   ├── db/                             # Prisma client & resilient fallback store
│   ├── mcp/                            # Model Context Protocol (MCP) server
│   ├── queue/                          # BullMQ & In-Memory queue dispatcher
│   ├── services/                       # Enquiry, Auth, and Audit domain services
│   └── server.ts                       # Express application bootstrap
├── supabase/                           # Supabase SQL migrations & seed data
│   └── migrations/
│       ├── 001_create_contact_messages.sql
│       └── 002_seed_demo_data.sql
├── tests/                              # Automated test suites
│   └── test-enterprise-system.js      # 10 comprehensive E2E integration suites
├── tsconfig.json                       # TypeScript compiler configuration
└── SETUP_GUIDE.md                      # Comprehensive operations and setup manual
```

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [npm](https://www.npmjs.com/) v9.0.0 or higher
- *(Optional)* PostgreSQL & Redis for full production clustering

### 1. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/Akashpandi951/akash-pandi-portfolio.git
cd akash-pandi-portfolio
npm install
```

### 2. Environment Configuration
Create your local environment file from the template:
```bash
cp .env.example .env
```
*(The system automatically runs with resilient in-memory stores if PostgreSQL or Redis are not configured, so you can start developing immediately!)*

### 3. Build & Run
Compile the TypeScript sources:
```bash
npm run build
```

Start the local server:
```bash
npm run start:prod
# Or for live hot-reloading development:
# npm run dev
```

Visit the running services:
- **Portfolio Home**: [http://localhost:3000](http://localhost:3000)
- **Admin Command Center**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **System Health API**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 🤖 MCP Server Setup

To connect the portfolio automation tools to Claude Desktop, Cursor, or Antigravity, add this configuration:

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "akash-portfolio": {
      "command": "node",
      "args": ["<ABSOLUTE_PATH_TO_REPO>/dist/mcp/server.js"],
      "env": {
        "PORT": "3000",
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

## 🧪 Testing & Verification

Run the comprehensive 10-suite automated test:
```bash
npm test
```

### Verified Test Matrix:
- ✓ **Test 1**: Health & System Diagnostics
- ✓ **Test 2**: Contact Form Validation & Zod Schema Enforcement
- ✓ **Test 3**: Concurrent Ingestion & Idempotency Deduplication (10 concurrent hits)
- ✓ **Test 4**: Asynchronous Queue & Exponential Backoff Retries
- ✓ **Test 5**: Admin Authentication & RBAC Access Controls
- ✓ **Test 6**: Workflow Status & Priority Mutations
- ✓ **Test 7**: Compliance Audit Logging & Tamper-Evident Records
- ✓ **Test 8**: Streaming Data Export (CSV & JSON)
- ✓ **Test 9**: MCP Server Tool Execution (all 8 registered tools)
- ✓ **Test 10**: Google Gemini AI Endpoint Preservation

---

## 🔒 Security Best Practices

1. **Environment Secrets**: Never commit `.env` or files containing real API keys or database connection strings.
2. **Admin Password**: Set strong credentials in `.env` using `ADMIN_DEFAULT_PASSWORD`.
3. **Database Security**: When using PostgreSQL, enable Row-Level Security (RLS) as configured in `supabase/migrations/001_create_contact_messages.sql`.

---

## 📄 License & Author

- **Author**: B. Akash Pandi ([akashpandi506@gmail.com](mailto:akashpandi506@gmail.com))
- **License**: ISC License
