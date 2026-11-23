/**
 * src/api/routes/admin.ts
 * Enterprise Admin API with RBAC, Queue Monitoring, Audit Logs, and Analytics
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { EnquiryService } from '../../services/enquiry.service';
import { AuthService } from '../../services/auth.service';
import { AuditService } from '../../services/audit.service';
import { getQueueHealth, retryFailedJobs } from '../../queue';
import { requireAdminAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { logger } from '../../config';

const router = Router();

// 1. Admin Authentication Route (Public)
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/auth/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;

    const authResult = await AuthService.authenticate(email, password, clientIp);

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
  } catch (err: any) {
    logger.error({ err: err.message }, '[Admin Login Error]');
    return res.status(500).json({ success: false, error: 'Internal server authentication error.' });
  }
});

// All routes below require Admin Authentication
router.use(requireAdminAuth);

// 2. Current User Profile
router.get('/me', (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    user: req.adminUser
  });
});

// 3. Enquiry Inbox Listing (supports both /enquiries and /messages for backwards compatibility)
const handleGetEnquiries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, category, priority, search, page, limit } = req.query;

    const result = await EnquiryService.getEnquiries({
      status: status as string,
      category: category as string,
      priority: priority as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20
    });

    const analytics = await EnquiryService.getAnalytics();

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
  } catch (err: any) {
    logger.error({ err: err.message }, '[Admin Get Enquiries Error]');
    return res.status(500).json({ success: false, error: 'Failed to retrieve enquiries.' });
  }
};

router.get('/enquiries', handleGetEnquiries);
router.get('/messages', handleGetEnquiries); // Backward compatibility alias

// 4. Single Enquiry Details
router.get('/enquiries/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const enquiry = await EnquiryService.getEnquiryById(id);
    if (!enquiry) {
      return res.status(404).json({ success: false, error: 'Enquiry not found.' });
    }
    return res.json({ success: true, data: enquiry });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve enquiry.' });
  }
});

// 5. Update Status
const handleUpdateStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Target status is required.' });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const updated = await EnquiryService.updateStatus(id, status, req.adminUser?.email, clientIp);

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Enquiry not found.' });
    }

    return res.json({
      success: true,
      message: `Status updated to ${status}.`,
      data: updated
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

router.patch('/enquiries/:id/status', handleUpdateStatus);
router.patch('/messages/:id/status', handleUpdateStatus); // Backward compatibility alias

// 6. Update Priority
router.patch('/enquiries/:id/priority', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({ success: false, error: 'Target priority is required.' });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const updated = await EnquiryService.updatePriority(id, priority, req.adminUser?.email, clientIp);

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Enquiry not found.' });
    }

    return res.json({
      success: true,
      message: `Priority updated to ${priority}.`,
      data: updated
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 7. Send Direct Email Reply
const handleReply = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { replyMessage } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({ success: false, error: 'Reply message cannot be empty.' });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const updated = await EnquiryService.recordReply(id, replyMessage, req.adminUser?.email, clientIp);

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Enquiry not found.' });
    }

    return res.json({
      success: true,
      message: `Reply scheduled and dispatched to ${updated.email}!`,
      data: updated
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Admin Reply Error]');
    return res.status(500).json({ success: false, error: 'Failed to process reply.' });
  }
};

router.post('/enquiries/:id/reply', handleReply);
router.post('/messages/:id/reply', handleReply); // Backward compatibility alias

// 8. Delete Enquiry (Requires ADMIN role)
const handleDelete = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;

    const deleted = await EnquiryService.deleteEnquiry(id, req.adminUser?.email, clientIp);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Enquiry not found.' });
    }

    return res.json({
      success: true,
      message: 'Enquiry deleted successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete enquiry.' });
  }
};

router.delete('/enquiries/:id', requireRole('ADMIN'), handleDelete);
router.delete('/messages/:id', requireRole('ADMIN'), handleDelete); // Backward compatibility alias

// 9. Overview Analytics
router.get('/analytics', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const analytics = await EnquiryService.getAnalytics();
    return res.json({ success: true, data: analytics });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve analytics.' });
  }
});

// 10. BullMQ Queue Health Telemetry
router.get('/queue/health', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const health = await getQueueHealth();
    return res.json({ success: true, data: health });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to inspect queue health.' });
  }
});

// 11. BullMQ Retry Failed Jobs
router.post('/queue/retry', requireRole('ADMIN'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await retryFailedJobs();
    return res.json({
      success: true,
      message: `Re-queued ${count} failed jobs for retry.`,
      count
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retry jobs.' });
  }
});

// 12. Audit Logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, limit, offset } = req.query;
    const logs = await AuditService.query({
      action: action as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    return res.json({ success: true, data: logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to query audit logs.' });
  }
});

// 13. Export Data
router.get('/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
    const exported = await EnquiryService.exportData(format);

    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=enquiries-export-${Date.now()}.${format}`);
    return res.send(exported.data);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to export data.' });
  }
});

export default router;
