# Enterprise Portfolio Backend Automation & MCP System — Architecture, Setup & Deployment Guide

This document is the authoritative operations and developer manual for **B. Akash Pandi's Enterprise Portfolio Backend Automation & MCP System**.

It covers the complete TypeScript backend architecture, PostgreSQL/Prisma ORM setup, asynchronous BullMQ/Redis worker processing, dedicated Model Context Protocol (MCP) server integration, and the Obsidian & Crimson Cyber Admin Command Center.

---

## 1. System Architecture Overview

```
                                  +------------------------------------+
                                  |     Visitor (index.html)           |
                                  |     - Honeypot Spam Guard          |
                                  |     - Cloudflare Turnstile         |
                                  |     - Ask Akash AI (Gemini Stream) |
                                  +-----------------+------------------+
                                                    |
                                                    | POST /api/contact (Idempotency-Key)
                                                    v
+-------------------------------------------------------------------------------------------------------+
|                                    EXPRESS TYPESCRIPT BACKEND SERVER                                  |
|                                                                                                       |
|  +-----------------------+   +-----------------------------+   +-----------------------------------+  |
|  |  Security Middleware  |   |    Zod Schema Validation    |   |     Idempotency Controller        |  |
|  |  - Helmet CSP         |-->|    - Strict String Checks   |-->|     - Deterministic Hash Match    |  |
|  |  - Rate Limiter       |   |    - Email Sanitization     |   |     - Deduplicates parallel hits  |  |
|  +-----------------------+   +-----------------------------+   +-----------------+-----------------+  |
|                                                                                  |                    |
|                                               +----------------------------------+                    |
|                                               v                                                       |
|                              +---------------------------------+                                      |
|                              |   Database Persistence Tier     |                                      |
|                              |   - PostgreSQL via Prisma ORM   |                                      |
|                              |   - Auto-categorization         |                                      |
|                              |   - Priority Scoring (URGENT)   |                                      |
|                              |   - Resilient Fallback Engine   |                                      |
|                              +----------------+----------------+                                      |
|                                               |                                                       |
|                                               v                                                       |
|                              +---------------------------------+                                      |
|                              |  Asynchronous Queue Dispatcher  |                                      |
|                              |  - BullMQ & Redis Engine        |                                      |
|                              |  - 5 Parallel Workers           |                                      |
|                              |  - Exponential Backoff Retries  |                                      |
|                              |  - Dead Letter Queue (DLQ)      |                                      |
|                              +----------------+----------------+                                      |
+-----------------------------------------------|-------------------------------------------------------+
                                                |
               +--------------------------------+--------------------------------+
               |                                                                 |
               v                                                                 v
+-------------------------------+                             +-----------------------------------+
|     Resend Email Delivery     |                             |   Compliance Audit Ledger         |
|  - Admin High-Priority Alerts |                             |  - Immutable Security Records     |
|  - Visitor Confirmations      |                             |  - Actor, IP & Change History     |
+-------------------------------+                             +-----------------------------------+
               ^                                                                 ^
               |                                                                 |
+--------------+-----------------------------------------------------------------+----------------------+
|                                    CONTROL & AUTOMATION INTERFACES                                    |
|                                                                                                       |
|  +--------------------------------------------+    +-----------------------------------------------+  |
|  |     Obsidian & Crimson Admin Command       |    |     Official MCP TypeScript Automation Server |  |
|  |     Center (admin.html)                    |    |     (@modelcontextprotocol/sdk)               |  |
|  |     - JWT Bcrypt Authentication            |    |     - Transport: stdio / SSE                  |  |
|  |     - Inquiries Inbox & Priority Editor    |    |     - 8 Specialized Enterprise Tools          |  |
|  |     - BullMQ Queue & Worker Monitor        |    |     - Integrated into Claude, Antigravity,    |  |
|  |     - Audit Trail & CSV Data Exporter      |    |       Cursor, or AI Autonomous Agents         |  |
|  |     - Gemini AI Draft Reply Generator      |    |                                               |  |
|  +--------------------------------------------+    +-----------------------------------------------+  |
+-------------------------------------------------------------------------------------------------------+
```

---

## 2. Core Architectural Pillars

### 2.1 Resilient Dual-Mode Execution Architecture
The backend is designed for high availability and zero-friction deployment:
- **Production Mode**: Connects directly to **PostgreSQL** via **Prisma ORM** (`DATABASE_URL`) and **Redis** via **BullMQ** (`REDIS_URL`).
- **Resilient Fallback Mode**: If PostgreSQL or Redis are not reachable (e.g. during local offline dev or initial testing), the backend automatically and seamlessly initializes an **in-memory thread-safe transactional store and queue worker**. All features (deduplication, priority scoring, worker queues, audit trails, and MCP tools) continue functioning without crashes.

### 2.2 Concurrency & Idempotency Safeguards
- **Idempotency Hashing**: When clients pass an `Idempotency-Key` HTTP header, or submit identical message payloads within a rapid window, the backend generates a deterministic SHA-256 hash. If 10 identical requests fire concurrently, **only 1 database record and queue job are created**; the other 9 return the existing record with `{ isDuplicate: true }`.
- **Worker Concurrency**: Worker concurrency is configurable (default: 5 parallel workers). Jobs are processed with **5 automatic retry attempts using exponential backoff** (2s, 4s, 8s, 16s, 32s). Unresolvable jobs are parked in a Dead-Letter Queue (DLQ) for inspection and manual re-triggering.

---

## 3. Dedicated Model Context Protocol (MCP) Server

The system features a dedicated Model Context Protocol (MCP) server built with the official `@modelcontextprotocol/sdk`. It provides external LLMs and AI Agents (Claude Desktop, Google Antigravity, Cursor, etc.) safe, structured access to portfolio enquiry workflows.

### 3.1 Registered MCP Tools

| Tool Name | Parameters | Purpose |
|---|---|---|
| `retrieve_enquiries` | `status`, `category`, `priority`, `page`, `limit` | Paginated retrieval and filtering of all incoming visitor enquiries. |
| `search_requests` | `query`, `limit` | Full-text search across visitor names, email addresses, and message contents. |
| `view_request_details` | `id` (UUID) | View complete metadata, BullMQ delivery traces, and immutable audit logs for a single enquiry. |
| `update_request_status` | `id`, `status` (`NEW`, `IN_REVIEW`, `READ`, `REPLIED`, `ARCHIVED`), `replyNotes` | Transition enquiry status through the state machine and log audit event. |
| `view_analytics` | *(none)* | Fetch overview metrics: counts by category, priority, status, and response rate. |
| `monitor_queue_health` | *(none)* | Real-time queue telemetry: active workers, queued jobs, latency, delayed retries, and failed jobs. |
| `retry_failed_jobs` | *(none)* | Drain Dead-Letter Queue (DLQ) and re-queue failed background notification jobs. |
| `export_enquiry_data` | `format` (`json` or `csv`) | Export authorized enquiry datasets for downstream reporting or CRM synchronization. |

### 3.2 Connecting MCP to AI Applications

#### A. Claude Desktop Configuration (`claude_desktop_config.json`)
On Windows: `%APPDATA%\Claude\claude_desktop_config.json`
On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "akash-portfolio-backend": {
      "command": "node",
      "args": [
        "D:\\Downloads\\akash_pandi_portfolio_code\\dist\\mcp\\index.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "DATABASE_URL": "postgresql://postgres:password@localhost:5432/portfolio",
        "REDIS_URL": "redis://127.0.0.1:6379"
      }
    }
  }
}
```

#### B. Antigravity MCP Configuration (`mcp.json`)
```json
{
  "servers": {
    "portfolio-backend": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "D:\\Downloads\\akash_pandi_portfolio_code"
    }
  }
}
```

#### C. Cursor IDE Configuration
1. Open Cursor Settings -> **Features** -> **MCP**.
2. Click **Add New MCP Server**:
   - **Name**: `portfolio-backend`
   - **Type**: `command`
   - **Command**: `npm run mcp`

---

## 4. Environment Variables Reference (`.env`)

```env
# ============================================================================
# SERVER CONFIGURATION
# ============================================================================
PORT=3000
NODE_ENV=development
API_BASE_URL=http://localhost:3000

# ============================================================================
# DATABASE CONFIGURATION (PostgreSQL & Prisma)
# ============================================================================
# If unconfigured, the system runs with the resilient In-Memory repository.
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/portfolio_db?schema=public"

# ============================================================================
# ASYNCHRONOUS QUEUE (BullMQ & Redis)
# ============================================================================
# If unconfigured, the system runs with the resilient In-Memory worker queue.
REDIS_URL="redis://127.0.0.1:6379"
WORKER_CONCURRENCY=5

# ============================================================================
# AUTHENTICATION & JWT SECURITY
# ============================================================================
JWT_SECRET="your-super-secure-256-bit-jwt-secret-key-change-in-production"
ADMIN_EMAIL="akashpandi506@gmail.com"
ADMIN_DEFAULT_PASSWORD="ChangeMe123!"

# ============================================================================
# GOOGLE GEMINI AI (Interactions API & Portfolio Assistant)
# ============================================================================
GEMINI_API_KEY="AIzaSy..."

# ============================================================================
# EMAIL DISPATCH (Resend API)
# ============================================================================
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="onboarding@resend.dev"
ADMIN_NOTIFICATION_EMAIL="akashpandi506@gmail.com"

# ============================================================================
# ANTI-BOT PROTECTION (Cloudflare Turnstile)
# ============================================================================
CLOUDFLARE_TURNSTILE_SECRET_KEY="0x4AAAAAA..."
TURNSTILE_SITE_KEY="0x4AAAAAA..."
```

---

## 5. Development & Build Lifecycle

### Step 1: Install Dependencies
```powershell
npm.cmd install
```

### Step 2: Database Schema & Client Generation
When connecting to PostgreSQL:
```powershell
# Generate Prisma Client
npx.cmd prisma generate

# Run migrations to initialize schema
npx.cmd prisma migrate dev --name init_enterprise_schema
```

### Step 3: TypeScript Build
```powershell
npm.cmd run build
```

### Step 4: Run the Server
```powershell
# Start production compiled server
npm.cmd start

# Or run with live TypeScript execution (dev)
npm.cmd run dev
```

### Step 5: Start the MCP Server
```powershell
npm.cmd run mcp
```

---

## 6. Admin Command Center (`/admin`)

The Admin Dashboard provides full management matching the portfolio's Obsidian and Crimson Cyber theme:

1. **Authentication**: Sign in at `http://localhost:3000/admin` using your configured `ADMIN_EMAIL` (`akashpandi506@gmail.com`) and password.
2. **Tab 1: Enquiries Inbox**:
   - Live Bento metric cards: Total Inquiries, New/Unread, Read/Viewed, Replied.
   - Real-time search across visitor names, email, and keywords.
   - Status filters (`All`, `New`, `Read`, `Replied`).
   - Priority badges (`URGENT`, `HIGH`, `MEDIUM`, `LOW`) and Category tags (`HIRING`, `PROJECT`, `COLLABORATION`, `GENERAL`).
   - Message modal with in-app email reply (via Resend) and Gemini AI draft generation.
3. **Tab 2: BullMQ Queue Monitor**:
   - Real-time telemetry: Active Workers, Waiting/Queued, Delayed (Backoff), Completed, and Failed (DLQ).
   - "Retry Failed Jobs" button to safely drain the DLQ.
4. **Tab 3: Enterprise Audit Ledger**:
   - Immutable security log showing Action (`ADMIN_LOGIN`, `STATUS_UPDATED`, `PRIORITY_UPDATED`), Actor, IP address, timestamp, and details payload.
5. **CSV Exporter**:
   - Click "Export CSV" in the top bar to download the complete enquiry ledger.

---

## 7. Verification & Automated Testing

The repository includes a comprehensive 10-suite automated verification script (`tests/test-enterprise-system.js`):

```powershell
node tests/test-enterprise-system.js
```

### Test Suite Coverage:
- **Test 1**: Health Endpoint & Diagnostics verification.
- **Test 2**: Zod input validation & malicious script stripping.
- **Test 3**: Concurrency & Idempotency test (10 parallel simultaneous submissions; verifies exactly 1 enquiry created and 9 deduplicated).
- **Test 4**: Admin Authentication & RBAC (verifies 401 on unauthorized access, 401 on bad password, 200 and JWT on valid login).
- **Test 5**: Enquiry State Machine & Priority updates (`NEW` -> `READ` -> `HIGH`).
- **Test 6**: BullMQ queue health telemetry & DLQ retry endpoint.
- **Test 7**: Compliance Audit Ledger persistence and querying.
- **Test 8**: CSV data export with correct Content-Type and data rows.
- **Test 9**: Direct execution of all 8 MCP tools (`retrieve_enquiries`, `search_requests`, `view_request_details`, `update_request_status`, `view_analytics`, `monitor_queue_health`, `retry_failed_jobs`, `export_enquiry_data`).
- **Test 10**: Google Gemini AI Interactions API preservation (`/api/ai/draft-reply`).

---

## 8. Production Deployment Guide

### Option 1: Docker / Container Deployment
A standard multi-stage Docker build:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/
RUN npm ci
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate
COPY --from=builder /app/dist ./dist
COPY public ./public
COPY *.html ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Option 2: Render / Railway / Fly.io
1. Connect your GitHub repository.
2. Set Environment: **Node**.
3. Build Command: `npm install && npx prisma generate && npm run build`
4. Start Command: `node dist/server.js`
5. Configure Environment Variables (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `RESEND_API_KEY`).
6. Attach a managed PostgreSQL database and Redis instance.

---

## 9. Final Verification Checklist

- [x] **Backend Framework**: Built with TypeScript, Express, Helmet, CORS, and Pino structured logging.
- [x] **Database & ORM**: PostgreSQL database schema defined via Prisma ORM (`prisma/schema.prisma`).
- [x] **Asynchronous Processing**: Redis and BullMQ queues configured with 5 worker concurrency and exponential backoff retry.
- [x] **Dual-Mode Resilience**: Automatic in-memory fallback for database and queue when external URLs are unconfigured.
- [x] **Idempotency & Concurrency**: SHA-256 deterministic idempotency deduplication proven with 10 concurrent requests.
- [x] **MCP Server**: Official `@modelcontextprotocol/sdk` implementation providing all 8 enterprise tools.
- [x] **Admin Dashboard**: Enhanced `admin.html` with Inbox, BullMQ Queue Monitor, Audit Ledger, Priority selector, Notification Traces, and CSV export.
- [x] **Security & RBAC**: Zod validation, JWT authentication, bcrypt hashing, least-privilege role validation, and immutable audit logging.
- [x] **Preservation of Existing Features**: Existing portfolio (`index.html`), contact form, and Gemini AI endpoints (`/api/ai/chat`) fully operational.
