"use strict";
/**
 * src/services/audit.service.ts
 * Enterprise Audit Logging Service for Immutable Compliance Tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const client_1 = require("../db/client");
const config_1 = require("../config");
class AuditService {
    static async record(params) {
        const logData = {
            id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            action: params.action,
            actorEmail: params.actorEmail || 'anonymous',
            actorIp: params.actorIp || null,
            enquiryId: params.enquiryId || null,
            details: params.details || {},
            createdAt: new Date()
        };
        if (client_1.isDatabaseConfigured) {
            try {
                const saved = await client_1.prisma.auditLog.create({
                    data: {
                        action: params.action,
                        actorEmail: params.actorEmail,
                        actorIp: params.actorIp,
                        enquiryId: params.enquiryId,
                        details: params.details || {}
                    }
                });
                return {
                    id: saved.id,
                    action: saved.action,
                    actorEmail: saved.actorEmail,
                    actorIp: saved.actorIp,
                    enquiryId: saved.enquiryId,
                    details: saved.details,
                    createdAt: saved.createdAt
                };
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Audit] Failed to persist to PostgreSQL; saving in memory.');
            }
        }
        client_1.inMemoryDb.auditLogs.unshift(logData);
        config_1.logger.info({ action: params.action, actor: params.actorEmail }, '[Audit] Recorded audit event');
        return logData;
    }
    static async query(params) {
        const limit = params.limit || 50;
        const offset = params.offset || 0;
        if (client_1.isDatabaseConfigured) {
            try {
                const where = params.action ? { action: params.action } : {};
                const [logs, total] = await Promise.all([
                    client_1.prisma.auditLog.findMany({
                        where,
                        orderBy: { createdAt: 'desc' },
                        take: limit,
                        skip: offset
                    }),
                    client_1.prisma.auditLog.count({ where })
                ]);
                return { logs, total, limit, offset };
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Audit] Failed query on PostgreSQL; using in-memory.');
            }
        }
        let filtered = [...client_1.inMemoryDb.auditLogs];
        if (params.action) {
            filtered = filtered.filter(l => l.action === params.action);
        }
        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);
        return { logs: paginated, total, limit, offset };
    }
}
exports.AuditService = AuditService;
//# sourceMappingURL=audit.service.js.map