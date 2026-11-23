"use strict";
/**
 * src/services/enquiry.service.ts
 * Enterprise Enquiry Management Service: Ingestion, Idempotency, State Transitions & Analytics
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnquiryService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("../db/client");
const queue_1 = require("../queue");
const audit_service_1 = require("./audit.service");
const config_1 = require("../config");
class EnquiryService {
    /**
     * Automatic Enquiry Categorization Engine
     */
    static categorize(message) {
        const text = message.toLowerCase();
        if (/hiring|hire|job|recruiter|interview|position|salary|full-time|part-time|vacancy|resume/i.test(text)) {
            return 'HIRING';
        }
        if (/project|build|website|application|software|quote|estimate|scope|contract|freelance|budget/i.test(text)) {
            return 'PROJECT';
        }
        if (/collaborat|partner|co-found|open source|contribut|join forces/i.test(text)) {
            return 'COLLABORATION';
        }
        return 'GENERAL';
    }
    /**
     * Automatic Priority Scoring Engine
     */
    static calculatePriority(message, category) {
        const text = message.toLowerCase();
        if (/urgent|asap|immediately|critical|rush|emergency|today|within 24 hours/i.test(text)) {
            return 'URGENT';
        }
        if (category === 'HIRING' || /opportunity|interview|budget|offer|lead/i.test(text)) {
            return 'HIGH';
        }
        if (category === 'PROJECT' || text.length > 200) {
            return 'MEDIUM';
        }
        return 'LOW';
    }
    /**
     * Generate or resolve unique Idempotency Key
     */
    static generateIdempotencyKey(input) {
        if (input.idempotencyKey && input.idempotencyKey.trim().length > 0) {
            return input.idempotencyKey.trim();
        }
        // Generate deterministic hash of (email + name + normalized_message)
        const normalized = `${input.email.toLowerCase().trim()}:${input.name.trim()}:${input.message.trim().replace(/\s+/g, ' ')}`;
        return crypto_1.default.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
    }
    /**
     * Idempotent Ingestion & Background Queue Dispatch
     */
    static async createEnquiry(input) {
        const idempotencyKey = this.generateIdempotencyKey(input);
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        // 1. Idempotency Check in Database
        if (client_1.isDatabaseConfigured) {
            try {
                const existing = await client_1.prisma.enquiry.findFirst({
                    where: {
                        idempotencyKey,
                        createdAt: { gte: fifteenMinutesAgo }
                    }
                });
                if (existing) {
                    config_1.logger.info({ id: existing.id, idempotencyKey }, '[Enquiry] Duplicate submission intercepted via idempotency key');
                    return { enquiry: existing, isDuplicate: true };
                }
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Enquiry] DB check error; falling back to in-memory check');
            }
        }
        else {
            const existing = client_1.inMemoryDb.enquiries.find(e => e.idempotencyKey === idempotencyKey && new Date(e.createdAt) >= fifteenMinutesAgo);
            if (existing) {
                config_1.logger.info({ id: existing.id, idempotencyKey }, '[Enquiry] Duplicate submission intercepted (in-memory)');
                return { enquiry: existing, isDuplicate: true };
            }
        }
        // 2. Classify & Score
        const category = this.categorize(input.message);
        const priority = this.calculatePriority(input.message, category);
        // 3. Persist to Storage
        let savedEnquiry;
        if (client_1.isDatabaseConfigured) {
            const created = await client_1.prisma.enquiry.create({
                data: {
                    name: input.name.trim(),
                    email: input.email.toLowerCase().trim(),
                    message: input.message.trim(),
                    category,
                    priority,
                    status: 'NEW',
                    ipAddress: input.ipAddress || null,
                    userAgent: input.userAgent ? input.userAgent.substring(0, 255) : null,
                    idempotencyKey,
                    metadata: input.metadata || {}
                }
            });
            savedEnquiry = created;
        }
        else {
            savedEnquiry = {
                id: 'enq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                name: input.name.trim(),
                email: input.email.toLowerCase().trim(),
                message: input.message.trim(),
                category,
                priority,
                status: 'NEW',
                ipAddress: input.ipAddress || null,
                userAgent: input.userAgent || null,
                idempotencyKey,
                replyNotes: null,
                repliedAt: null,
                metadata: input.metadata || {},
                createdAt: new Date(),
                updatedAt: new Date()
            };
            client_1.inMemoryDb.enquiries.unshift(savedEnquiry);
        }
        // 4. Record Audit Log
        await audit_service_1.AuditService.record({
            action: 'ENQUIRY_CREATED',
            actorEmail: savedEnquiry.email,
            actorIp: input.ipAddress,
            enquiryId: savedEnquiry.id,
            details: { category, priority, idempotencyKey }
        });
        // 5. Asynchronous Queue Enqueueing (Decoupled from HTTP response)
        await (0, queue_1.enqueueNotification)({
            enquiryId: savedEnquiry.id,
            name: savedEnquiry.name,
            email: savedEnquiry.email,
            message: savedEnquiry.message,
            category: savedEnquiry.category,
            priority: savedEnquiry.priority,
            type: 'ADMIN_ALERT'
        });
        return { enquiry: savedEnquiry, isDuplicate: false };
    }
    /**
     * Filtered & Paginated Enquiry Query
     */
    static async getEnquiries(params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 20));
        const offset = (page - 1) * limit;
        if (client_1.isDatabaseConfigured) {
            try {
                const where = {};
                if (params.status && params.status !== 'ALL')
                    where.status = params.status.toUpperCase();
                if (params.category && params.category !== 'ALL')
                    where.category = params.category.toUpperCase();
                if (params.priority && params.priority !== 'ALL')
                    where.priority = params.priority.toUpperCase();
                if (params.search && params.search.trim()) {
                    const s = params.search.trim();
                    where.OR = [
                        { name: { contains: s, mode: 'insensitive' } },
                        { email: { contains: s, mode: 'insensitive' } },
                        { message: { contains: s, mode: 'insensitive' } }
                    ];
                }
                const [enquiries, total] = await Promise.all([
                    client_1.prisma.enquiry.findMany({
                        where,
                        orderBy: { createdAt: 'desc' },
                        take: limit,
                        skip: offset,
                        include: {
                            notificationJobs: { take: 3, orderBy: { createdAt: 'desc' } }
                        }
                    }),
                    client_1.prisma.enquiry.count({ where })
                ]);
                return {
                    enquiries: enquiries,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit) || 1
                    }
                };
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Enquiry] DB query failed; using in-memory');
            }
        }
        // In-Memory Search & Filtering
        let list = [...client_1.inMemoryDb.enquiries];
        if (params.status && params.status !== 'ALL') {
            list = list.filter(e => e.status.toUpperCase() === params.status?.toUpperCase());
        }
        if (params.category && params.category !== 'ALL') {
            list = list.filter(e => e.category.toUpperCase() === params.category?.toUpperCase());
        }
        if (params.priority && params.priority !== 'ALL') {
            list = list.filter(e => e.priority.toUpperCase() === params.priority?.toUpperCase());
        }
        if (params.search && params.search.trim()) {
            const q = params.search.trim().toLowerCase();
            list = list.filter(e => e.name.toLowerCase().includes(q) ||
                e.email.toLowerCase().includes(q) ||
                e.message.toLowerCase().includes(q));
        }
        const total = list.length;
        const paginated = list.slice(offset, offset + limit);
        return {
            enquiries: paginated,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        };
    }
    /**
     * Retrieve Single Enquiry with Notification History & Audit Trail
     */
    static async getEnquiryById(id) {
        if (client_1.isDatabaseConfigured) {
            try {
                const item = await client_1.prisma.enquiry.findUnique({
                    where: { id },
                    include: {
                        notificationJobs: { orderBy: { createdAt: 'desc' } },
                        auditLogs: { orderBy: { createdAt: 'desc' } }
                    }
                });
                if (item)
                    return item;
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Enquiry] DB findUnique error; using fallback');
            }
        }
        const item = client_1.inMemoryDb.enquiries.find(e => e.id === id);
        if (!item)
            return null;
        const relatedJobs = client_1.inMemoryDb.jobs.filter(j => j.enquiryId === id);
        const relatedLogs = client_1.inMemoryDb.auditLogs.filter(a => a.enquiryId === id);
        return {
            ...item,
            notificationJobs: relatedJobs,
            auditLogs: relatedLogs
        };
    }
    /**
     * State Machine Status Transition
     */
    static async updateStatus(id, newStatus, actorEmail, actorIp) {
        const validStatuses = ['NEW', 'IN_REVIEW', 'READ', 'REPLIED', 'ARCHIVED'];
        const statusUpper = newStatus.toUpperCase();
        if (!validStatuses.includes(statusUpper)) {
            throw new Error(`Invalid status "${newStatus}". Must be one of: ${validStatuses.join(', ')}`);
        }
        if (client_1.isDatabaseConfigured) {
            try {
                const updated = await client_1.prisma.enquiry.update({
                    where: { id },
                    data: { status: statusUpper }
                });
                await audit_service_1.AuditService.record({
                    action: 'STATUS_UPDATED',
                    actorEmail,
                    actorIp,
                    enquiryId: id,
                    details: { newStatus: statusUpper }
                });
                return updated;
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Enquiry] DB status update failed; using in-memory');
            }
        }
        const item = client_1.inMemoryDb.enquiries.find(e => e.id === id);
        if (!item)
            return null;
        const oldStatus = item.status;
        item.status = statusUpper;
        item.updatedAt = new Date();
        await audit_service_1.AuditService.record({
            action: 'STATUS_UPDATED',
            actorEmail,
            actorIp,
            enquiryId: id,
            details: { oldStatus, newStatus: statusUpper }
        });
        return item;
    }
    /**
     * Priority Update
     */
    static async updatePriority(id, newPriority, actorEmail, actorIp) {
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        const priorityUpper = newPriority.toUpperCase();
        if (!validPriorities.includes(priorityUpper)) {
            throw new Error(`Invalid priority "${newPriority}". Must be one of: ${validPriorities.join(', ')}`);
        }
        if (client_1.isDatabaseConfigured) {
            try {
                const updated = await client_1.prisma.enquiry.update({
                    where: { id },
                    data: { priority: priorityUpper }
                });
                await audit_service_1.AuditService.record({
                    action: 'PRIORITY_UPDATED',
                    actorEmail,
                    actorIp,
                    enquiryId: id,
                    details: { newPriority: priorityUpper }
                });
                return updated;
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Enquiry] DB priority update failed; using in-memory');
            }
        }
        const item = client_1.inMemoryDb.enquiries.find(e => e.id === id);
        if (!item)
            return null;
        const oldPriority = item.priority;
        item.priority = priorityUpper;
        item.updatedAt = new Date();
        await audit_service_1.AuditService.record({
            action: 'PRIORITY_UPDATED',
            actorEmail,
            actorIp,
            enquiryId: id,
            details: { oldPriority, newPriority: priorityUpper }
        });
        return item;
    }
    /**
     * Reply & Mark Replied
     */
    static async recordReply(id, replyText, actorEmail, actorIp) {
        const now = new Date();
        // Enqueue background email dispatch to visitor
        const enquiry = await this.getEnquiryById(id);
        if (!enquiry)
            return null;
        await (0, queue_1.enqueueNotification)({
            enquiryId: id,
            name: enquiry.name,
            email: enquiry.email,
            message: enquiry.message,
            category: enquiry.category,
            priority: enquiry.priority,
            type: 'VISITOR_REPLY',
            replyText: replyText.trim()
        });
        if (client_1.isDatabaseConfigured) {
            try {
                const updated = await client_1.prisma.enquiry.update({
                    where: { id },
                    data: {
                        status: 'REPLIED',
                        replyNotes: replyText.trim(),
                        repliedAt: now
                    }
                });
                await audit_service_1.AuditService.record({
                    action: 'REPLY_SENT',
                    actorEmail,
                    actorIp,
                    enquiryId: id,
                    details: { replySnippet: replyText.substring(0, 100) }
                });
                return updated;
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Enquiry] DB reply record failed; using in-memory');
            }
        }
        const item = client_1.inMemoryDb.enquiries.find(e => e.id === id);
        if (!item)
            return null;
        item.status = 'REPLIED';
        item.replyNotes = replyText.trim();
        item.repliedAt = now;
        item.updatedAt = now;
        await audit_service_1.AuditService.record({
            action: 'REPLY_SENT',
            actorEmail,
            actorIp,
            enquiryId: id,
            details: { replySnippet: replyText.substring(0, 100) }
        });
        return item;
    }
    /**
     * Delete Enquiry
     */
    static async deleteEnquiry(id, actorEmail, actorIp) {
        if (client_1.isDatabaseConfigured) {
            try {
                await client_1.prisma.enquiry.delete({ where: { id } });
                await audit_service_1.AuditService.record({
                    action: 'ENQUIRY_DELETED',
                    actorEmail,
                    actorIp,
                    enquiryId: id
                });
                return true;
            }
            catch (err) {
                config_1.logger.error({ err: err.message }, '[Enquiry] DB delete error; trying in-memory');
            }
        }
        const idx = client_1.inMemoryDb.enquiries.findIndex(e => e.id === id);
        if (idx !== -1) {
            client_1.inMemoryDb.enquiries.splice(idx, 1);
            await audit_service_1.AuditService.record({
                action: 'ENQUIRY_DELETED',
                actorEmail,
                actorIp,
                enquiryId: id
            });
            return true;
        }
        return false;
    }
    /**
     * System Overview Analytics
     */
    static async getAnalytics() {
        let all = client_1.inMemoryDb.enquiries;
        if (client_1.isDatabaseConfigured) {
            try {
                all = (await client_1.prisma.enquiry.findMany());
            }
            catch (err) { }
        }
        const total = all.length;
        const byStatus = {
            new: all.filter(e => e.status.toUpperCase() === 'NEW').length,
            inReview: all.filter(e => e.status.toUpperCase() === 'IN_REVIEW').length,
            read: all.filter(e => e.status.toUpperCase() === 'READ').length,
            replied: all.filter(e => e.status.toUpperCase() === 'REPLIED').length,
            archived: all.filter(e => e.status.toUpperCase() === 'ARCHIVED').length
        };
        const byCategory = {
            hiring: all.filter(e => e.category.toUpperCase() === 'HIRING').length,
            project: all.filter(e => e.category.toUpperCase() === 'PROJECT').length,
            collaboration: all.filter(e => e.category.toUpperCase() === 'COLLABORATION').length,
            general: all.filter(e => e.category.toUpperCase() === 'GENERAL').length
        };
        const byPriority = {
            urgent: all.filter(e => e.priority.toUpperCase() === 'URGENT').length,
            high: all.filter(e => e.priority.toUpperCase() === 'HIGH').length,
            medium: all.filter(e => e.priority.toUpperCase() === 'MEDIUM').length,
            low: all.filter(e => e.priority.toUpperCase() === 'LOW').length
        };
        // Calculate response rate
        const repliedCount = byStatus.replied;
        const responseRate = total > 0 ? Math.round((repliedCount / total) * 100) : 100;
        return {
            total,
            byStatus,
            byCategory,
            byPriority,
            responseRate: `${responseRate}%`,
            lastEnquiryAt: all[0]?.createdAt || null
        };
    }
    /**
     * Export Enquiry Data (JSON / CSV format)
     */
    static async exportData(format = 'json') {
        const { enquiries } = await this.getEnquiries({ limit: 1000 });
        if (format === 'csv') {
            const headers = ['id', 'name', 'email', 'category', 'priority', 'status', 'createdAt', 'message'];
            const rows = enquiries.map(e => [
                `"${e.id}"`,
                `"${e.name.replace(/"/g, '""')}"`,
                `"${e.email}"`,
                `"${e.category}"`,
                `"${e.priority}"`,
                `"${e.status}"`,
                `"${new Date(e.createdAt).toISOString()}"`,
                `"${e.message.replace(/"/g, '""').replace(/\n/g, ' ')}"`
            ].join(','));
            return {
                contentType: 'text/csv',
                data: [headers.join(','), ...rows].join('\n')
            };
        }
        return {
            contentType: 'application/json',
            data: JSON.stringify(enquiries, null, 2)
        };
    }
}
exports.EnquiryService = EnquiryService;
//# sourceMappingURL=enquiry.service.js.map