/**
 * src/queue/index.ts
 * Enterprise BullMQ / Redis Asynchronous Processing with Resilient In-Memory Fallback
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config, logger } from '../config';
import { inMemoryDb, INotificationJob } from '../db/client';

export const QUEUE_NAME = 'portfolio-notifications';

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

// 1. In-Memory Queue Fallback Implementation
class InMemoryQueueManager {
  private queue: Array<{ id: string; name: string; data: NotificationPayload; attempts: number; maxAttempts: number; delayUntil?: number }> = [];
  private activeCount = 0;
  private completedCount = 0;
  private failedCount = 0;
  private delayedCount = 0;
  private startTime = Date.now();
  private isProcessing = false;

  constructor() {
    setInterval(() => this.processNextBatch(), 500);
  }

  public async add(name: string, data: NotificationPayload, opts?: { attempts?: number; backoff?: any }): Promise<{ id: string }> {
    const jobId = 'mem-job-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    this.queue.push({
      id: jobId,
      name,
      data,
      attempts: 0,
      maxAttempts: opts?.attempts || 5
    });

    // Track in database
    const jobRecord: INotificationJob = {
      id: jobId,
      enquiryId: data.enquiryId,
      jobType: data.type,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: opts?.attempts || 5,
      lastError: null,
      payload: data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryDb.jobs.unshift(jobRecord);

    logger.info({ jobId, type: data.type }, '[Queue] Enqueued in-memory job');
    return { id: jobId };
  }

  private async processNextBatch() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      const eligibleIdx = this.queue.findIndex(j => !j.delayUntil || j.delayUntil <= now);
      if (eligibleIdx === -1) {
        this.delayedCount = this.queue.filter(j => j.delayUntil && j.delayUntil > now).length;
        this.isProcessing = false;
        return;
      }

      const job = this.queue.splice(eligibleIdx, 1)[0];
      this.activeCount++;

      const jobRecord = inMemoryDb.jobs.find(j => j.id === job.id);
      if (jobRecord) {
        jobRecord.status = 'PROCESSING';
        jobRecord.attempts++;
        jobRecord.updatedAt = new Date();
      }

      try {
        await executeNotification(job.data);
        this.completedCount++;
        if (jobRecord) {
          jobRecord.status = 'COMPLETED';
          jobRecord.updatedAt = new Date();
        }
        logger.info({ jobId: job.id }, '[Queue] Job completed successfully');
      } catch (err: any) {
        job.attempts++;
        logger.error({ jobId: job.id, err: err.message, attempt: job.attempts }, '[Queue] Job execution attempt failed');

        if (job.attempts < job.maxAttempts) {
          // Exponential backoff: 2s * 2^(attempt-1)
          const delayMs = 2000 * Math.pow(2, job.attempts - 1);
          job.delayUntil = Date.now() + delayMs;
          this.queue.push(job);
          if (jobRecord) {
            jobRecord.status = 'RETRYING';
            jobRecord.lastError = err.message;
            jobRecord.updatedAt = new Date();
          }
        } else {
          this.failedCount++;
          if (jobRecord) {
            jobRecord.status = 'FAILED';
            jobRecord.lastError = `Max attempts reached (${job.maxAttempts}). Error: ${err.message}`;
            jobRecord.updatedAt = new Date();
          }
        }
      } finally {
        this.activeCount = Math.max(0, this.activeCount - 1);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public getStats(): QueueHealthStats {
    const now = Date.now();
    return {
      mode: 'IN_MEMORY_FALLBACK',
      waiting: this.queue.filter(j => !j.delayUntil || j.delayUntil <= now).length,
      active: this.activeCount,
      completed: this.completedCount,
      failed: this.failedCount,
      delayed: this.queue.filter(j => j.delayUntil && j.delayUntil > now).length,
      concurrency: config.workerConcurrency,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  public retryFailed(): number {
    const failedRecords = inMemoryDb.jobs.filter(j => j.status === 'FAILED');
    for (const record of failedRecords) {
      record.status = 'PENDING';
      record.attempts = 0;
      record.lastError = null;
      record.updatedAt = new Date();
      this.queue.push({
        id: record.id,
        name: 'retry-' + record.jobType,
        data: record.payload,
        attempts: 0,
        maxAttempts: 5
      });
    }
    this.failedCount = 0;
    return failedRecords.length;
  }
}

// 2. Notification Dispatch Executor
async function executeNotification(payload: NotificationPayload): Promise<void> {
  const isResendConfigured = Boolean(config.resendApiKey && !config.resendApiKey.startsWith('re_123456'));

  if (payload.type === 'ADMIN_ALERT') {
    logger.info({ to: config.adminNotificationEmail, sender: payload.name }, '[Notification] Dispatching admin notification email');
    if (isResendConfigured) {
      const { Resend } = require('resend');
      const resend = new Resend(config.resendApiKey);
      await resend.emails.send({
        from: config.resendFromEmail,
        to: [config.adminNotificationEmail],
        subject: `[${payload.priority}] New ${payload.category} Enquiry: ${payload.name}`,
        html: `
          <div style="font-family:sans-serif;background:#08080D;color:#FFF;padding:24px;border-radius:12px;">
            <h2 style="color:#FF1744;">New Portfolio Enquiry Received</h2>
            <p><strong>Sender:</strong> ${payload.name} (${payload.email})</p>
            <p><strong>Category:</strong> ${payload.category} | <strong>Priority:</strong> ${payload.priority}</p>
            <blockquote style="background:#111118;padding:12px;border-left:4px solid #FF1744;color:#E0E0E0;">
              ${payload.message}
            </blockquote>
          </div>
        `
      });
    }
  } else if (payload.type === 'VISITOR_REPLY') {
    logger.info({ to: payload.email }, '[Notification] Dispatching visitor reply email');
    if (isResendConfigured && payload.replyText) {
      const { Resend } = require('resend');
      const resend = new Resend(config.resendApiKey);
      await resend.emails.send({
        from: config.resendFromEmail,
        to: [payload.email],
        subject: `Re: Your message to B. Akash Pandi`,
        html: `
          <div style="font-family:sans-serif;color:#222;line-height:1.6;">
            <p>${payload.replyText.replace(/\\n/g, '<br/>')}</p>
            <hr style="border:none;border-top:1px solid #EEE;margin:20px 0;"/>
            <p style="color:#777;font-size:12px;">B. Akash Pandi • Aspiring Data Analyst & AI Tools Enthusiast</p>
          </div>
        `
      });
    }
  }
}

// 3. Queue Instance Initialization
export const inMemoryQueue = new InMemoryQueueManager();

let bullQueue: Queue | null = null;
let bullWorker: Worker | null = null;

// Initialize BullMQ if Redis is reachable
export async function initializeQueueSystem() {
  const isRedisUrlValid = config.redisUrl && !config.redisUrl.includes('placeholder');
  
  if (isRedisUrlValid) {
    try {
      const redisConnection = new IORedis(config.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: () => null // Don't crash on initial failure
      });

      redisConnection.on('error', (err) => {
        logger.warn({ err: err.message }, '[Queue] Redis connection issue; defaulting to In-Memory Queue.');
      });

      await redisConnection.ping();
      logger.info('[Queue] Redis connected successfully. Initializing BullMQ.');

      bullQueue = new Queue(QUEUE_NAME, {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: 1000,
          removeOnFail: 5000
        }
      });

      bullWorker = new Worker(
        QUEUE_NAME,
        async (job: Job<NotificationPayload>) => {
          logger.info({ jobId: job.id, type: job.data.type }, '[BullMQ] Processing notification job');
          await executeNotification(job.data);
        },
        {
          connection: redisConnection,
          concurrency: config.workerConcurrency
        }
      );

      bullWorker.on('completed', (job) => {
        logger.info({ jobId: job.id }, '[BullMQ] Job completed');
      });

      bullWorker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err: err.message }, '[BullMQ] Job failed');
      });

      return;
    } catch (e: any) {
      logger.warn({ err: e.message }, '[Queue] Redis unavailable. Using resilient In-Memory queue fallback.');
    }
  } else {
    logger.info('[Queue] Redis URL unconfigured. Running in resilient In-Memory Queue mode.');
  }
}

// 4. Unified Queue Interface
export async function enqueueNotification(payload: NotificationPayload): Promise<{ id: string }> {
  if (bullQueue) {
    try {
      const job = await bullQueue.add('notification', payload);
      return { id: String(job.id) };
    } catch (e) {
      logger.warn('[Queue] Failed to add to BullMQ. Falling back to in-memory queue.');
    }
  }
  return inMemoryQueue.add('notification', payload);
}

export async function getQueueHealth(): Promise<QueueHealthStats> {
  if (bullQueue) {
    try {
      const counts = await bullQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return {
        mode: 'REDIS_BULLMQ',
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        concurrency: config.workerConcurrency,
        uptimeSeconds: Math.floor(process.uptime())
      };
    } catch (e) {}
  }
  return inMemoryQueue.getStats();
}

export async function retryFailedJobs(): Promise<number> {
  if (bullQueue) {
    try {
      const failed = await bullQueue.getFailed();
      for (const job of failed) {
        await job.retry();
      }
      return failed.length;
    } catch (e) {}
  }
  return inMemoryQueue.retryFailed();
}
