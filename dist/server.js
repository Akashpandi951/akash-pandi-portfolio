"use strict";
/**
 * src/server.ts
 * Enterprise Portfolio Automation Backend Server
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const client_1 = require("./db/client");
const queue_1 = require("./queue");
const contact_1 = __importDefault(require("./api/routes/contact"));
const admin_1 = __importDefault(require("./api/routes/admin"));
const ai_1 = __importDefault(require("./api/routes/ai"));
const app = (0, express_1.default)();
// 1. Security Headers via Helmet
app.use((0, helmet_1.default)({
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
            upgradeInsecureRequests: config_1.config.env === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false
}));
// 2. CORS configuration
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // In development or if origin is null (same-origin / curl / test), allow
        if (!origin || config_1.config.env === 'development') {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
}));
// 3. Body Parsers with Payload Safeguards
app.use(express_1.default.json({ limit: '50kb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50kb' }));
// 4. API Endpoints
app.use('/api/contact', contact_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/ai', ai_1.default);
// Health check endpoint
app.get('/api/health', async (_req, res) => {
    const queueHealth = await (0, queue_1.getQueueHealth)();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Akash Pandi Enterprise Portfolio Backend & Automation System',
        version: '2.0.0',
        mode: config_1.config.env,
        database: Boolean(config_1.config.databaseUrl && !config_1.config.databaseUrl.includes('placeholder')),
        queue: queueHealth,
        geminiConfigured: Boolean(config_1.config.geminiApiKey && !config_1.config.geminiApiKey.includes('placeholder')),
        resendConfigured: Boolean(config_1.config.resendApiKey && !config_1.config.resendApiKey.startsWith('re_123456')),
        turnstileConfigured: Boolean(config_1.config.turnstileSecretKey && !config_1.config.turnstileSecretKey.startsWith('0x4AAAA')),
        uptimeSeconds: Math.floor(process.uptime())
    });
});
// 5. Static File & Asset Hosting with Multi-Path Resilient Resolution
const staticOptions = {
    extensions: ['html'],
    maxAge: config_1.config.env === 'production' ? '1d' : 0
};
// Explicit static routes for /assets
app.use('/assets', express_1.default.static(path_1.default.join(process.cwd(), 'assets'), staticOptions));
app.use('/assets', express_1.default.static(path_1.default.join(__dirname, '..', 'assets'), staticOptions));
app.use('/assets', express_1.default.static(path_1.default.join(__dirname, 'assets'), staticOptions));
app.use('/assets', express_1.default.static(path_1.default.join(process.cwd(), 'public', 'assets'), staticOptions));
// Explicit Admin Routes (supports /admin, /admin/, /admin.html)
app.get(['/admin', '/admin/'], (_req, res) => {
    const adminPaths = [
        path_1.default.join(process.cwd(), 'admin.html'),
        path_1.default.join(__dirname, '..', 'admin.html'),
        path_1.default.join(__dirname, 'admin.html'),
        path_1.default.join(process.cwd(), 'public', 'admin.html')
    ];
    for (const p of adminPaths) {
        if (fs_1.default.existsSync(p)) {
            return res.sendFile(p);
        }
    }
    res.sendFile(path_1.default.join(__dirname, '..', 'admin.html'));
});
// General static middleware
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'public'), staticOptions));
app.use(express_1.default.static(path_1.default.join(__dirname, '..'), staticOptions));
app.use(express_1.default.static(path_1.default.join(__dirname), staticOptions));
// Fallback to index.html for root navigation
app.get('/', (_req, res) => {
    const indexPaths = [
        path_1.default.join(process.cwd(), 'index.html'),
        path_1.default.join(__dirname, '..', 'index.html'),
        path_1.default.join(__dirname, 'index.html'),
        path_1.default.join(process.cwd(), 'public', 'index.html')
    ];
    for (const p of indexPaths) {
        if (fs_1.default.existsSync(p)) {
            return res.sendFile(p);
        }
    }
    res.sendFile(path_1.default.join(__dirname, '..', 'index.html'));
});
// 6. Global Safe Error Handler
app.use((err, _req, res, _next) => {
    config_1.logger.error({ err: err.message, stack: err.stack }, '[Server Error] Unhandled internal error');
    res.status(500).json({
        success: false,
        error: 'An internal server error occurred.'
    });
});
// 7. Server Initialization
async function startServer(port = config_1.config.port) {
    await (0, client_1.verifyDatabaseConnection)();
    await (0, queue_1.initializeQueueSystem)();
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            config_1.logger.info(`=======================================================`);
            config_1.logger.info(`⚡ Enterprise Portfolio Backend running on http://localhost:${port}`);
            config_1.logger.info(`📋 Admin Command Center: http://localhost:${port}/admin`);
            config_1.logger.info(`🤖 MCP Automation Server: npm run mcp`);
            config_1.logger.info(`🛡️  Security: Helmet CSP, RBAC, Turnstile & Idempotency Active`);
            config_1.logger.info(`=======================================================`);
            resolve(server);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                const nextPort = port + 1;
                config_1.logger.warn(`[Port ${port} in use] Falling back to port ${nextPort}...`);
                resolve(startServer(nextPort));
            }
            else {
                config_1.logger.error({ err: err.message }, 'Server listen error');
            }
        });
    });
}
// Graceful shutdown
process.on('SIGINT', async () => {
    config_1.logger.info('Received SIGINT. Gracefully shutting down...');
    await client_1.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    config_1.logger.info('Received SIGTERM. Gracefully shutting down...');
    await client_1.prisma.$disconnect();
    process.exit(0);
});
if (require.main === module) {
    startServer();
}
exports.default = app;
//# sourceMappingURL=server.js.map