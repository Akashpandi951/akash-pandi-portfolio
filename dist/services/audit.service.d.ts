/**
 * src/services/audit.service.ts
 * Enterprise Audit Logging Service for Immutable Compliance Tracking
 */
import { IAuditLog } from '../db/client';
export interface CreateAuditLogParams {
    action: 'ENQUIRY_CREATED' | 'STATUS_UPDATED' | 'PRIORITY_UPDATED' | 'REPLY_SENT' | 'ENQUIRY_DELETED' | 'JOB_RETRIED' | 'ADMIN_LOGIN';
    actorEmail?: string | null;
    actorIp?: string | null;
    enquiryId?: string | null;
    details?: Record<string, any>;
}
export declare class AuditService {
    static record(params: CreateAuditLogParams): Promise<IAuditLog>;
    static query(params: {
        action?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: IAuditLog[];
        total: number;
        limit: number;
        offset: number;
    }>;
}
