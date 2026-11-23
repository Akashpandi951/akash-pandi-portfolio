/**
 * src/services/enquiry.service.ts
 * Enterprise Enquiry Management Service: Ingestion, Idempotency, State Transitions & Analytics
 */
import { IEnquiry } from '../db/client';
export interface CreateEnquiryInput {
    name: string;
    email: string;
    message: string;
    idempotencyKey?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, any>;
}
export interface EnquiryFilterParams {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
}
export declare class EnquiryService {
    /**
     * Automatic Enquiry Categorization Engine
     */
    static categorize(message: string): 'HIRING' | 'PROJECT' | 'COLLABORATION' | 'GENERAL';
    /**
     * Automatic Priority Scoring Engine
     */
    static calculatePriority(message: string, category: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    /**
     * Generate or resolve unique Idempotency Key
     */
    static generateIdempotencyKey(input: CreateEnquiryInput): string;
    /**
     * Idempotent Ingestion & Background Queue Dispatch
     */
    static createEnquiry(input: CreateEnquiryInput): Promise<{
        enquiry: IEnquiry;
        isDuplicate: boolean;
    }>;
    /**
     * Filtered & Paginated Enquiry Query
     */
    static getEnquiries(params: EnquiryFilterParams): Promise<{
        enquiries: IEnquiry[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Retrieve Single Enquiry with Notification History & Audit Trail
     */
    static getEnquiryById(id: string): Promise<{
        id: string;
        name: string;
        email: string;
        message: string;
        category: string;
        priority: string;
        status: string;
        ipAddress?: string | null;
        userAgent?: string | null;
        idempotencyKey?: string | null;
        replyNotes?: string | null;
        repliedAt?: Date | null;
        metadata?: any;
        createdAt: Date;
        updatedAt: Date;
        notificationJobs: import("../db/client").INotificationJob[];
        auditLogs: import("../db/client").IAuditLog[];
    } | null>;
    /**
     * State Machine Status Transition
     */
    static updateStatus(id: string, newStatus: string, actorEmail?: string, actorIp?: string): Promise<IEnquiry | null>;
    /**
     * Priority Update
     */
    static updatePriority(id: string, newPriority: string, actorEmail?: string, actorIp?: string): Promise<IEnquiry | null>;
    /**
     * Reply & Mark Replied
     */
    static recordReply(id: string, replyText: string, actorEmail?: string, actorIp?: string): Promise<IEnquiry | null>;
    /**
     * Delete Enquiry
     */
    static deleteEnquiry(id: string, actorEmail?: string, actorIp?: string): Promise<boolean>;
    /**
     * System Overview Analytics
     */
    static getAnalytics(): Promise<{
        total: number;
        byStatus: {
            new: number;
            inReview: number;
            read: number;
            replied: number;
            archived: number;
        };
        byCategory: {
            hiring: number;
            project: number;
            collaboration: number;
            general: number;
        };
        byPriority: {
            urgent: number;
            high: number;
            medium: number;
            low: number;
        };
        responseRate: string;
        lastEnquiryAt: Date;
    }>;
    /**
     * Export Enquiry Data (JSON / CSV format)
     */
    static exportData(format?: 'json' | 'csv'): Promise<{
        contentType: string;
        data: string;
    }>;
}
