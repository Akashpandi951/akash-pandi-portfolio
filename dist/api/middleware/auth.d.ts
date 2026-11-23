/**
 * src/api/middleware/auth.ts
 * Enterprise JWT Verification & Role-Based Access Control (RBAC) Middleware
 */
import { Request, Response, NextFunction } from 'express';
import { AdminTokenPayload } from '../../services/auth.service';
export interface AuthenticatedRequest extends Request {
    adminUser?: AdminTokenPayload;
}
export declare function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRole(...allowedRoles: Array<'ADMIN' | 'AUDITOR' | 'VIEWER'>): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
