/**
 * src/server.ts
 * Enterprise Portfolio Automation Backend Server
 */

import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { config, logger } from './config';
import { verifyDatabaseConnection, prisma } from './db/client';
import { initializeQueueSystem, getQueueHealth } from './queue';
import contactRouter from './api/routes/contact';
import adminRouter from './api/routes/admin';
import aiRouter from './api/routes/ai';

const app = express();

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.tailwindcss.com",
          "https://unpkg.com",
          "https://challenges.cloudflare.com",
          "https://cdn.jsdelivr.net"
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: [
          "'self'",
          "https://challenges.cloudflare.com",
          "https://generativelanguage.googleapis.com",
          "https://*.supabase.co",
          "wss://*.supabase.co",
          "http://localhost:3000",
          "http://127.0.0.1:3000"
        ],
        frameSrc: ["https://challenges.cloudflare.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.env === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // In development or if origin is null (same-origin / curl / test), allow
      if (!origin || config.env === 'development') {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
  })
);

// 3. Body Parsers with Payload Safeguards
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// 4. API Endpoints
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  const queueHealth = await getQueueHealth();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Akash Pandi Enterprise Portfolio Backend & Automation System',
    version: '2.0.0',
    mode: config.env,
    database: Boolean(config.databaseUrl && !config.databaseUrl.includes('placeholder')),
    queue: queueHealth,
    geminiConfigured: Boolean(config.geminiApiKey && !config.geminiApiKey.includes('placeholder')),
    resendConfigured: Boolean(config.resendApiKey && !config.resendApiKey.startsWith('re_123456')),
    turnstileConfigured: Boolean(config.turnstileSecretKey && !config.turnstileSecretKey.startsWith('0x4AAAA')),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Explicit Admin Route
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// 5. Static File Hosting (Serves index.html, admin.html, assets)
app.use(express.static(path.join(__dirname, '..'), {
  extensions: ['html'],
  maxAge: config.env === 'production' ? '1d' : 0
}));

// Fallback to index.html for root navigation
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 6. Global Safe Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, '[Server Error] Unhandled internal error');
  res.status(500).json({
    success: false,
    error: 'An internal server error occurred.'
  });
});

// 7. Server Initialization
export async function startServer(port: number = config.port) {
  await verifyDatabaseConnection();
  await initializeQueueSystem();

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info(`=======================================================`);
      logger.info(`⚡ Enterprise Portfolio Backend running on http://localhost:${port}`);
      logger.info(`📋 Admin Command Center: http://localhost:${port}/admin`);
      logger.info(`🤖 MCP Automation Server: npm run mcp`);
      logger.info(`🛡️  Security: Helmet CSP, RBAC, Turnstile & Idempotency Active`);
      logger.info(`=======================================================`);
      resolve(server);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        const nextPort = port + 1;
        logger.warn(`[Port ${port} in use] Falling back to port ${nextPort}...`);
        resolve(startServer(nextPort));
      } else {
        logger.error({ err: err.message }, 'Server listen error');
      }
    });
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Gracefully shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Gracefully shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

export default app;
