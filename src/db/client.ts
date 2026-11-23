/**
 * src/db/client.ts
 * Enterprise Database Client with Prisma ORM & Resilient In-Memory Fallback
 */

import { PrismaClient } from '@prisma/client';
import { config, logger } from '../config';

// 1. Prisma Client Instance
export const prisma = new PrismaClient({
  log: config.env === 'development' ? ['warn', 'error'] : ['error']
});

export const isDatabaseConfigured = Boolean(
  config.databaseUrl &&
  !config.databaseUrl.includes('placeholder') &&
  config.databaseUrl.startsWith('postgres')
);

// 2. Types for Database Entities
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

// 3. Resilient In-Memory Store for Local Offline Development & Rapid Testing
class InMemoryDatabase {
  public enquiries: IEnquiry[] = [
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

  public jobs: INotificationJob[] = [
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

  public auditLogs: IAuditLog[] = [
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

export const inMemoryDb = new InMemoryDatabase();

// Connect check
export async function verifyDatabaseConnection(): Promise<boolean> {
  if (!isDatabaseConfigured) {
    logger.info('[DB] PostgreSQL URL unconfigured. Running with Resilient In-Memory Repository.');
    return true;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('[DB] PostgreSQL connected successfully via Prisma ORM.');
    return true;
  } catch (err: any) {
    logger.warn({ err: err.message }, '[DB] PostgreSQL connection failed. Falling back to In-Memory Repository.');
    return false;
  }
}
