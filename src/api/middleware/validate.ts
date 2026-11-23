/**
 * src/api/middleware/validate.ts
 * Zod Input Validation Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed: ' + err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
          details: err.issues
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid request body.'
      });
    }
  };
}
