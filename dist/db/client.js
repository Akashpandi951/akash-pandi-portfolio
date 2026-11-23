"use strict";
/**
 * src/db/client.ts
 * Enterprise Database Client with Prisma ORM & Resilient In-Memory Fallback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.inMemoryDb = exports.isDatabaseConfigured = exports.prisma = void 0;
exports.verifyDatabaseConnection = verifyDatabaseConnection;
const client_1 = require("@prisma/client");
const config_1 = require("../config");
// 1. Prisma Client Instance
exports.prisma = new client_1.PrismaClient({
    log: config_1.config.env === 'development' ? ['warn', 'error'] : ['error']
});
exports.isDatabaseConfigured = Boolean(config_1.config.databaseUrl &&
    !config_1.config.databaseUrl.includes('placeholder') &&
    config_1.config.databaseUrl.startsWith('postgres'));
// 3. Resilient In-Memory Store for Local Offline Development & Rapid Testing
class InMemoryDatabase {
    enquiries = [
        {
            id: 'enq-demo-001',
            name: 'Sarah Jenkins',
            email: 'sarah.jenkins@fintechsolutions.com',
            message: 'Hi Akash, we came across your portfolio and were really impressed by your data analytics projects and SQL background. We are expanding our data team and would love to schedule a preliminary conversation with you this week.',
            category: 'HIRING',
            priority: 'HIGH',
            status: 'NEW',
            ipAddress: '192.168.1.101',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            replyNotes: null,
            repliedAt: null,
            metadata: { source: 'portfolio_contact', score: 92 },
            createdAt: new Date(Date.now() - 2 * 3600 * 1000),
            updatedAt: new Date(Date.now() - 2 * 3600 * 1000)
        },
        {
            id: 'enq-demo-002',
            name: 'David Kumar',
            email: 'david.k@analyticsinsights.io',
            message: 'Hello Akash, great work on the AI-assisted development project! I had a quick question regarding the prompt engineering workflows you used. Let me know if you are open to discussing.',
            category: 'PROJECT',
            priority: 'MEDIUM',
            status: 'READ',
            ipAddress: '10.0.0.45',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            replyNotes: null,
            repliedAt: null,
            metadata: { source: 'portfolio_contact', score: 75 },
            createdAt: new Date(Date.now() - 24 * 3600 * 1000),
            updatedAt: new Date(Date.now() - 12 * 3600 * 1000)
        },
        {
            id: 'enq-demo-003',
            name: 'Elena Rostova',
            email: 'elena@moderntechlabs.org',
            message: 'Hi Akash, following up on our discussion regarding the junior data analyst position. We sent over the initial technical assessment to your email.',
            category: 'HIRING',
            priority: 'URGENT',
            status: 'REPLIED',
            ipAddress: '172.16.0.12',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
            replyNotes: 'Sent preliminary technical solutions and scheduled screening call.',
            repliedAt: new Date(Date.now() - 48 * 3600 * 1000),
            metadata: { source: 'portfolio_contact', score: 98 },
            createdAt: new Date(Date.now() - 72 * 3600 * 1000),
            updatedAt: new Date(Date.now() - 48 * 3600 * 1000)
        }
    ];
    jobs = [
        {
            id: 'job-001',
            enquiryId: 'enq-demo-001',
            jobType: 'EMAIL_NOTIFICATION',
            status: 'COMPLETED',
            attempts: 1,
            maxAttempts: 5,
            lastError: null,
            payload: { to: 'akashpandi506@gmail.com' },
            createdAt: new Date(Date.now() - 2 * 3600 * 1000),
            updatedAt: new Date(Date.now() - 2 * 3600 * 1000)
        }
    ];
    auditLogs = [
        {
            id: 'audit-001',
            action: 'SYSTEM_BOOT',
            actorEmail: 'system@portfolio.internal',
            actorIp: '127.0.0.1',
            enquiryId: null,
            details: { message: 'Enterprise Backend Automation initialized.' },
            createdAt: new Date()
        }
    ];
}
exports.inMemoryDb = new InMemoryDatabase();
// Connect check
async function verifyDatabaseConnection() {
    if (!exports.isDatabaseConfigured) {
        config_1.logger.info('[DB] PostgreSQL URL unconfigured. Running with Resilient In-Memory Repository.');
        return true;
    }
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        config_1.logger.info('[DB] PostgreSQL connected successfully via Prisma ORM.');
        return true;
    }
    catch (err) {
        config_1.logger.warn({ err: err.message }, '[DB] PostgreSQL connection failed. Falling back to In-Memory Repository.');
        return false;
    }
}
//# sourceMappingURL=client.js.map