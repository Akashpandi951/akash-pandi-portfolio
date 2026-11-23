/**
 * src/db/client.ts
 * Enterprise Database Client with Prisma ORM & Resilient In-Memory Fallback
 */
import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<{
    log: ("error" | "warn")[];
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const isDatabaseConfigured: boolean;
export interface IEnquiry {
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
}
export interface INotificationJob {
    id: string;
    enquiryId: string;
    jobType: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    lastError?: string | null;
    payload?: any;
    createdAt: Date;
    updatedAt: Date;
}
export interface IAuditLog {
    id: string;
    action: string;
    actorEmail?: string | null;
    actorIp?: string | null;
    enquiryId?: string | null;
    details?: any;
    createdAt: Date;
}
declare class InMemoryDatabase {
    enquiries: IEnquiry[];
    jobs: INotificationJob[];
    auditLogs: IAuditLog[];
}
export declare const inMemoryDb: InMemoryDatabase;
export declare function verifyDatabaseConnection(): Promise<boolean>;
export {};
