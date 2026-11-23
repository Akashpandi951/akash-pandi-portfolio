/**
 * src/config/index.ts
 * Enterprise Environment Configuration & Structured Logger
 */
import pino from 'pino';
export declare const config: {
    env: string;
    port: number;
    databaseUrl: string;
    redisUrl: string;
    redisHost: string;
    redisPort: number;
    redisPassword: string | undefined;
    workerConcurrency: number;
    jwtSecret: string;
    adminEmail: string;
    adminDefaultPassword: string;
    rateLimitMax: number;
    resendApiKey: string;
    resendFromEmail: string;
    adminNotificationEmail: string;
    turnstileSecretKey: string;
    geminiApiKey: string;
};
export declare const logger: pino.Logger<never, boolean>;
