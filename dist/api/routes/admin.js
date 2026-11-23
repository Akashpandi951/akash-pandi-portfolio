"use strict";
/**
 * src/api/routes/admin.ts
 * Enterprise Admin API with RBAC, Queue Monitoring, Audit Logs, and Analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const enquiry_service_1 = require("../../services/enquiry.service");
const auth_service_1 = require("../../services/auth.service");
const audit_service_1 = require("../../services/audit.service");
const queue_1 = require("../../queue");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const config_1 = require("../../config");
const router = (0, express_1.Router)();
// 1. Admin Authentication Route (Public)
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1)
});
router.post('/auth/login', (0, validate_1.validateBody)(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const authResult = await auth_service_1.AuthService.authenticate(email, password, clientIp);
        if (!authResult) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email credentials or unauthorized account.'
            });
        }
        return res.json({
            success: true,
            message: 'Authentication successful.',
            token: authResult.token,
            user: authResult.user
        });
    }
    catch (err) {
        config_1.logger.error({ err: err.message }, '[Admin Login Error]');
        return res.status(500).json({ success: false, error: 'Internal server authentication error.' });
    }
});
// All routes below require Admin Authentication
router.use(auth_1.requireAdminAuth);
// 2. Current User Profile
router.get('/me', (req, res) => {
    return res.json({
        success: true,
        user: req.adminUser
    });
});
// 3. Enquiry Inbox Listing (supports both /enquiries and /messages for backwards compatibility)
const handleGetEnquiries = async (req, res) => {
    try {
        const { status, category, priority, search, page, limit } = req.query;
        const result = await enquiry_service_1.EnquiryService.getEnquiries({
            status: status,
            category: category,
            priority: priority,
            search: search,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20
        });
        const analytics = await enquiry_service_1.EnquiryService.getAnalytics();
        return res.json({
            success: true,
            data: result.enquiries,
            stats: {
                total: analytics.total,
                new: analytics.byStatus.new,
                read: analytics.byStatus.read,
                replied: analytics.byStatus.replied,
                inReview: analytics.byStatus.inReview,
                archived: analytics.byStatus.archived
            },
            pagination: result.pagination
        });
    }
    catch (err) {
        config_1.logger.error({ err: err.message }, '[Admin Get Enquiries Error]');
        return res.status(500).json({ success: false, error: 'Failed to retrieve enquiries.' });
    }
};
router.get('/enquiries', handleGetEnquiries);
router.get('/messages', handleGetEnquiries); // Backward compatibility alias
// 4. Single Enquiry Details
router.get('/enquiries/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const enquiry = await enquiry_service_1.EnquiryService.getEnquiryById(id);
        if (!enquiry) {
            return res.status(404).json({ success: false, error: 'Enquiry not found.' });
        }
        return res.json({ success: true, data: enquiry });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to retrieve enquiry.' });
    }
});
// 5. Update Status
const handleUpdateStatus = async (req, res) => {
    try {
        const id = req.params.id;
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, error: 'Target status is required.' });
        }
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const updated = await enquiry_service_1.EnquiryService.updateStatus(id, status, req.adminUser?.email, clientIp);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Enquiry not found.' });
        }
        return res.json({
            success: true,
            message: `Status updated to ${status}.`,
            data: updated
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
};
router.patch('/enquiries/:id/status', handleUpdateStatus);
router.patch('/messages/:id/status', handleUpdateStatus); // Backward compatibility alias
// 6. Update Priority
router.patch('/enquiries/:id/priority', async (req, res) => {
    try {
        const id = req.params.id;
        const { priority } = req.body;
        if (!priority) {
            return res.status(400).json({ success: false, error: 'Target priority is required.' });
        }
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const updated = await enquiry_service_1.EnquiryService.updatePriority(id, priority, req.adminUser?.email, clientIp);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Enquiry not found.' });
        }
        return res.json({
            success: true,
            message: `Priority updated to ${priority}.`,
            data: updated
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
});
// 7. Send Direct Email Reply
const handleReply = async (req, res) => {
    try {
        const id = req.params.id;
        const { replyMessage } = req.body;
        if (!replyMessage || !replyMessage.trim()) {
            return res.status(400).json({ success: false, error: 'Reply message cannot be empty.' });
        }
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const updated = await enquiry_service_1.EnquiryService.recordReply(id, replyMessage, req.adminUser?.email, clientIp);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Enquiry not found.' });
        }
        return res.json({
            success: true,
            message: `Reply scheduled and dispatched to ${updated.email}!`,
            data: updated
        });
    }
    catch (err) {
        config_1.logger.error({ err: err.message }, '[Admin Reply Error]');
        return res.status(500).json({ success: false, error: 'Failed to process reply.' });
    }
};
router.post('/enquiries/:id/reply', handleReply);
router.post('/messages/:id/reply', handleReply); // Backward compatibility alias
// 8. Delete Enquiry (Requires ADMIN role)
const handleDelete = async (req, res) => {
    try {
        const id = req.params.id;
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const deleted = await enquiry_service_1.EnquiryService.deleteEnquiry(id, req.adminUser?.email, clientIp);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Enquiry not found.' });
        }
        return res.json({
            success: true,
            message: 'Enquiry deleted successfully.'
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to delete enquiry.' });
    }
};
router.delete('/enquiries/:id', (0, auth_1.requireRole)('ADMIN'), handleDelete);
router.delete('/messages/:id', (0, auth_1.requireRole)('ADMIN'), handleDelete); // Backward compatibility alias
// 9. Overview Analytics
router.get('/analytics', async (_req, res) => {
    try {
        const analytics = await enquiry_service_1.EnquiryService.getAnalytics();
        return res.json({ success: true, data: analytics });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to retrieve analytics.' });
    }
});
// 10. BullMQ Queue Health Telemetry
router.get('/queue/health', async (_req, res) => {
    try {
        const health = await (0, queue_1.getQueueHealth)();
        return res.json({ success: true, data: health });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to inspect queue health.' });
    }
});
// 11. BullMQ Retry Failed Jobs
router.post('/queue/retry', (0, auth_1.requireRole)('ADMIN'), async (_req, res) => {
    try {
        const count = await (0, queue_1.retryFailedJobs)();
        return res.json({
            success: true,
            message: `Re-queued ${count} failed jobs for retry.`,
            count
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to retry jobs.' });
    }
});
// 12. Audit Logs
router.get('/audit-logs', async (req, res) => {
    try {
        const { action, limit, offset } = req.query;
        const logs = await audit_service_1.AuditService.query({
            action: action,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        return res.json({ success: true, data: logs });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to query audit logs.' });
    }
});
// 13. Export Data
router.get('/export', async (req, res) => {
    try {
        const format = req.query.format === 'csv' ? 'csv' : 'json';
        const exported = await enquiry_service_1.EnquiryService.exportData(format);
        res.setHeader('Content-Type', exported.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=enquiries-export-${Date.now()}.${format}`);
        return res.send(exported.data);
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to export data.' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map