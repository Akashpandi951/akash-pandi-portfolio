/**
 * src/services/audit.service.ts
 * Enterprise Audit Logging Service for Immutable Compliance Tracking
 */

import { prisma, isDatabaseConfigured, inMemoryDb, IAuditLog } from '../db/client';
import { logger } from '../config';

export interface CreateAuditLogParams {
  action: 'ENQUIRY_CREATED' | 'STATUS_UPDATED' | 'PRIORITY_UPDATED' | 'REPLY_SENT' | 'ENQUIRY_DELETED' | 'JOB_RETRIED' | 'ADMIN_LOGIN';
  actorEmail?: string | null;
  actorIp?: string | null;
  enquiryId?: string | null;
  details?: Record<string, any>;
}

export class AuditService {
  public static async record(params: CreateAuditLogParams): Promise<IAuditLog> {
    const logData: IAuditLog = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      action: params.action,
      actorEmail: params.actorEmail || 'anonymous',
      actorIp: params.actorIp || null,
      enquiryId: params.enquiryId || null,
      details: params.details || {},
      createdAt: new Date()
    };

    if (isDatabaseConfigured) {
      try {
        const saved = await prisma.auditLog.create({
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
      } catch (err: any) {
        logger.error({ err: err.message }, '[Audit] Failed to persist to PostgreSQL; saving in memory.');
      }
    }

    inMemoryDb.auditLogs.unshift(logData);
    logger.info({ action: params.action, actor: params.actorEmail }, '[Audit] Recorded audit event');
    return logData;
  }

  public static async query(params: { action?: string; limit?: number; offset?: number }) {
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    if (isDatabaseConfigured) {
      try {
        const where = params.action ? { action: params.action } : {};
        const [logs, total] = await Promise.all([
          prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
          }),
          prisma.auditLog.count({ where })
        ]);
        return { logs, total, limit, offset };
      } catch (err: any) {
        logger.error({ err: err.message }, '[Audit] Failed query on PostgreSQL; using in-memory.');
      }
    }

    let filtered = [...inMemoryDb.auditLogs];
    if (params.action) {
      filtered = filtered.filter(l => l.action === params.action);
    }
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    return { logs: paginated, total, limit, offset };
  }
}
