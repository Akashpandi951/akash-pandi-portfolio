/**
 * api/admin.js
 * Protected administrator endpoints for the Contact Management Dashboard.
 * Protected by Supabase Auth JWT verification and admin email check.
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin, requireAdminAuth, adminLimiter } = require('./middleware');
const { sendVisitorReply } = require('./email');
const {
  getDevMessages,
  updateDevMessageStatus,
  replyDevMessage,
  deleteDevMessage
} = require('./devStore');

// Apply security and rate limiting to all admin routes
router.use(adminLimiter);
router.use(requireAdminAuth);

/**
 * GET /api/admin/me
 * Returns current authenticated admin details.
 */
router.get('/me', (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      lastSignInAt: req.user.last_sign_in_at
    }
  });
});

/**
 * GET /api/admin/messages
 * Retrieves paginated messages with search, status filtering, and dashboard stats.
 */
router.get('/messages', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const isSupabaseConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');

    if (!isSupabaseConfigured) {
      // In dev fallback return simulated list from devStore
      const devResult = getDevMessages({ status, search, page: pageNum, limit: limitNum });
      return res.json({
        success: true,
        data: devResult.messages,
        stats: devResult.stats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: devResult.total,
          totalPages: devResult.totalPages
        },
        notice: 'Running with local simulation store. Connect your Supabase project in .env to persist to PostgreSQL.'
      });
    }

    // 1. Calculate Dashboard Statistics (Total, New, Read, Replied)
    const statsQuery = supabaseAdmin.from('contact_messages').select('status', { count: 'exact' });
    const [allStats, newStats, readStats, repliedStats] = await Promise.all([
      supabaseAdmin.from('contact_messages').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('contact_messages').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabaseAdmin.from('contact_messages').select('*', { count: 'exact', head: true }).eq('status', 'read'),
      supabaseAdmin.from('contact_messages').select('*', { count: 'exact', head: true }).eq('status', 'replied')
    ]);

    const stats = {
      total: allStats.count || 0,
      new: newStats.count || 0,
      read: readStats.count || 0,
      replied: repliedStats.count || 0
    };

    // 2. Build Filtered Query
    let query = supabaseAdmin
      .from('contact_messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (status && status !== 'all' && ['new', 'read', 'replied'].includes(status)) {
      query = query.eq('status', status);
    }

    if (search && search.trim()) {
      const term = search.trim();
      // Search across name, email, or message text
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,message.ilike.%${term}%`);
    }

    const { data: messages, count: totalFiltered, error } = await query;

    if (error) {
      console.error('[Admin GET /messages DB Error]', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve messages from database.'
      });
    }

    return res.json({
      success: true,
      data: messages || [],
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFiltered || 0,
        totalPages: Math.ceil((totalFiltered || 0) / limitNum) || 1
      }
    });

  } catch (err) {
    console.error('[Admin GET /messages Error]', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while fetching messages.'
    });
  }
});

/**
 * PATCH /api/admin/messages/:id/status
 * Updates status of a contact message (e.g. mark as 'read' or 'replied').
 */
router.patch('/messages/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !['new', 'read', 'replied'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Valid status ('new', 'read', or 'replied') and message ID are required."
      });
    }

    const isSupabaseConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');

    if (!isSupabaseConfigured) {
      const updated = updateDevMessageStatus(id, status);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Message not found.' });
      }
      return res.json({
        success: true,
        message: `Message marked as ${status}.`,
        data: updated
      });
    }

    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Admin PATCH /messages/:id/status Error]', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update message status in database.'
      });
    }

    return res.json({
      success: true,
      message: `Message marked as ${status}.`,
      data
    });

  } catch (err) {
    console.error('[Admin PATCH /status Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Internal error updating message status.'
    });
  }
});

/**
 * POST /api/admin/messages/:id/reply
 * Sends an email reply directly to the visitor using Resend and marks message as 'replied'.
 */
router.post('/messages/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage } = req.body;

    if (!id || !replyMessage || !replyMessage.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Reply message cannot be empty.'
      });
    }

    // 1. Fetch original message
    const isSupabaseConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');
    let original = null;

    if (!isSupabaseConfigured) {
      const devMsg = require('./devStore').devMessages.find(m => m.id === id);
      if (!devMsg) {
        return res.status(404).json({
          success: false,
          error: 'Original message not found.'
        });
      }
      original = devMsg;
    } else {
      const { data, error: fetchErr } = await supabaseAdmin
        .from('contact_messages')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !data) {
        return res.status(404).json({
          success: false,
          error: 'Original message not found.'
        });
      }
      original = data;
    }

    // 2. Send email via Resend
    const emailResult = await sendVisitorReply({
      visitorName: original.name,
      visitorEmail: original.email,
      replyMessage: replyMessage.trim(),
      originalMessage: original.message
    });

    if (!emailResult.success) {
      return res.status(502).json({
        success: false,
        error: `Failed to deliver email reply: ${emailResult.error || 'Unknown email service error'}`
      });
    }

    // 3. Update record status to 'replied'
    if (!isSupabaseConfigured) {
      const updated = replyDevMessage(id, replyMessage.trim());
      return res.json({
        success: true,
        message: `Reply sent successfully to ${original.email}!`,
        data: updated
      });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('contact_messages')
      .update({
        status: 'replied',
        replied_at: new Date().toISOString(),
        reply_notes: replyMessage.trim()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('[Admin Reply DB Update Error]', updateErr);
    }

    return res.json({
      success: true,
      message: `Reply sent successfully to ${original.email}!`,
      data: updated || original
    });

  } catch (err) {
    console.error('[Admin POST /reply Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Internal error sending reply.'
    });
  }
});

/**
 * DELETE /api/admin/messages/:id
 * Permanently deletes a message after confirmation.
 */
router.delete('/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Message ID is required.'
      });
    }

    const isSupabaseConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');

    if (!isSupabaseConfigured) {
      const deleted = deleteDevMessage(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Message not found.' });
      }
      return res.json({
        success: true,
        message: 'Message deleted successfully.'
      });
    }

    const { error } = await supabaseAdmin
      .from('contact_messages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Admin DELETE /messages/:id Error]', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete message from database.'
      });
    }

    return res.json({
      success: true,
      message: 'Message deleted successfully.'
    });

  } catch (err) {
    console.error('[Admin DELETE Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Internal error deleting message.'
    });
  }
});

module.exports = router;
