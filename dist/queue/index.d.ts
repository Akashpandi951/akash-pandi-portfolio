/**
 * src/queue/index.ts
 * Enterprise BullMQ / Redis Asynchronous Processing with Resilient In-Memory Fallback
 */
export declare const QUEUE_NAME = "portfolio-notifications";
export interface NotificationPayload {
    enquiryId: string;
    name: string;
    email: string;
    message: string;
    category: string;
    priority: string;
    type: 'ADMIN_ALERT' | 'VISITOR_REPLY';
    replyText?: string;
}
export interface QueueHealthStats {
    mode: 'REDIS_BULLMQ' | 'IN_MEMORY_FALLBACK';
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    concurrency: number;
    uptimeSeconds: number;
}
declare class InMemoryQueueManager {
    private queue;
    private activeCount;
    private completedCount;
    private failedCount;
    private delayedCount;
    private startTime;
    private isProcessing;
    constructor();
    add(name: string, data: NotificationPayload, opts?: {
        attempts?: number;
        backoff?: any;
    }): Promise<{
        id: string;
    }>;
    private processNextBatch;
    getStats(): QueueHealthStats;
    retryFailed(): number;
}
export declare const inMemoryQueue: InMemoryQueueManager;
export declare function initializeQueueSystem(): Promise<void>;
export declare function enqueueNotification(payload: NotificationPayload): Promise<{
    id: string;
}>;
export declare function getQueueHealth(): Promise<QueueHealthStats>;
export declare function retryFailedJobs(): Promise<number>;
export {};
