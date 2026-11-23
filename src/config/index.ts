/**
 * src/config/index.ts
 * Enterprise Environment Configuration & Structured Logger
 */

import dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // Redis & Queue
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-akash-portfolio-enterprise-2026',
  adminEmail: (process.env.ADMIN_EMAIL || 'akashpandi506@gmail.com').toLowerCase().trim(),
  adminDefaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || process.env.ADMIN_PASSWORD || '241703114',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  
  // Email (Resend)
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'akashpandi506@gmail.com',
  
  // Cloudflare Turnstile
  turnstileSecretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '',
  
  // Google Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY || ''
};

export const logger = pino({
  level: config.env === 'test' ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  transport: config.env !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
});
