"use strict";
/**
 * src/api/middleware/validate.ts
 * Zod Input Validation Middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
const zod_1 = require("zod");
function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
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
//# sourceMappingURL=validate.js.map