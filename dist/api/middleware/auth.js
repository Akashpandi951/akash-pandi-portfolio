"use strict";
/**
 * src/api/middleware/auth.ts
 * Enterprise JWT Verification & Role-Based Access Control (RBAC) Middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAuth = requireAdminAuth;
exports.requireRole = requireRole;
const auth_service_1 = require("../../services/auth.service");
const config_1 = require("../../config");
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Missing or malformed authorization header.'
        });
    }
    const token = authHeader.split(' ')[1];
    const payload = auth_service_1.AuthService.verifyToken(token);
    if (!payload) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid or expired token session.'
        });
    }
    req.adminUser = payload;
    next();
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.adminUser) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        if (!allowedRoles.includes(req.adminUser.role)) {
            config_1.logger.warn({ user: req.adminUser.email, role: req.adminUser.role, required: allowedRoles }, '[RBAC] Forbidden access attempt');
            return res.status(403).json({
                success: false,
                error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] permissions.`
            });
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map