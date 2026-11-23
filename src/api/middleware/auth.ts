/**
 * src/api/middleware/auth.ts
 * Enterprise JWT Verification & Role-Based Access Control (RBAC) Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService, AdminTokenPayload } from '../../services/auth.service';
import { logger } from '../../config';

export interface AuthenticatedRequest extends Request {
  adminUser?: AdminTokenPayload;
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or malformed authorization header.'
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = AuthService.verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired token session.'
    });
  }

  req.adminUser = payload;
  next();
}

export function requireRole(...allowedRoles: Array<'ADMIN' | 'AUDITOR' | 'VIEWER'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    if (!allowedRoles.includes(req.adminUser.role)) {
      logger.warn({ user: req.adminUser.email, role: req.adminUser.role, required: allowedRoles }, '[RBAC] Forbidden access attempt');
      return res.status(403).json({
        success: false,
        error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] permissions.`
      });
    }

    next();
  };
}
