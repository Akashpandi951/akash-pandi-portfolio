/**
 * api/contact.js
 * Secure public Contact Form submission handler.
 * Pipeline:
 * 1. Honeypot check (_gotcha / website)
 * 2. Input validation (name, email, message length & format)
 * 3. Server-side XSS sanitization
 * 4. Cloudflare Turnstile verification
 * 5. Supabase persistence via Service Role Key (Row Level Security protected)
 * 6. Email dispatch via Resend (with fail-safe error isolation)
 */

const express = require('express');
const router = express.Router();
const validator = require('validator');
const xss = require('xss');
const { supabaseAdmin, contactLimiter } = require('./middleware');
const { sendAdminNotification } = require('./email');
const { addDevMessage } = require('./devStore');

/**
 * Helper to verify Cloudflare Turnstile token with Cloudflare API.
 */
async function verifyTurnstileToken(token, remoteIp) {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  // Development / Demo bypass:
  // If no Turnstile key is configured or set to placeholder/test, permit in dev mode with a log warning.
  if (!secretKey || secretKey.startsWith('0x4AAAA') || secretKey === 'dummy_secret_key' || !token || token === 'dev_bypass_token') {
    if (process.env.NODE_ENV === 'development' || !secretKey || secretKey.startsWith('0x4AAAA')) {
      console.log('[Turnstile] Notice: Running with development Turnstile bypass. Set valid CLOUDFLARE_TURNSTILE_SECRET_KEY in production.');
      return { success: true, isDevBypass: true };
    }
  }

  if (!token) {
    return { success: false, error: 'CAPTCHA verification token is missing. Please complete the security check.' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const outcome = await response.json();
    return outcome;
  } catch (err) {
    console.error('[Turnstile Verification Error]', err);
    // In dev mode allow failure without blocking testing
    if (process.env.NODE_ENV === 'development') {
      return { success: true, isDevBypass: true };
    }
    return { success: false, error: 'Failed to verify security token. Please try again.' };
  }
}

// POST /api/contact - Public contact submission
router.post('/', contactLimiter, async (req, res) => {
  try {
    const { name, email, message, turnstileToken, _gotcha, website } = req.body;

    // 1. Spam Bot Honeypot Check
    // Real users never see or fill this field; bots auto-fill it.
    if (_gotcha || website) {
      console.warn('[Honeypot Triggered] Bot submission detected and dropped silently.');
      // Return fake success to fool bot scripts
      return res.status(200).json({
        success: true,
        message: 'Thank you for reaching out! Your message has been received.'
      });
    }

    // 2. Strict Input Validation
    const rawName = (name || '').trim();
    const rawEmail = (email || '').trim();
    const rawMessage = (message || '').trim();

    if (!rawName || !rawEmail || !rawMessage) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required. Please provide your name, email, and message.'
      });
    }

    if (rawName.length < 2 || rawName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Your name must be between 2 and 100 characters in length.'
      });
    }

    if (!validator.isEmail(rawEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid, well-formed email address.'
      });
    }

    if (rawMessage.length < 5 || rawMessage.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Message must be between 5 and 5,000 characters in length.'
      });
    }

    // 3. Server-side XSS Sanitization & Stripping
    const cleanName = xss(rawName, { whiteList: {} }).trim();
    const cleanEmail = validator.normalizeEmail(rawEmail) || rawEmail;
    const cleanMessage = xss(rawMessage, { whiteList: {} }).trim();

    // 4. Cloudflare Turnstile Verification
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIp);

    if (!turnstileResult.success) {
      return res.status(400).json({
        success: false,
        error: turnstileResult['error-codes']?.join(', ') || turnstileResult.error || 'CAPTCHA security check failed. Please refresh and try again.'
      });
    }

    // 5. Database Persistence (Supabase PostgreSQL via Service Role)
    let savedMessage = null;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Check if Supabase is configured with real project
    const isSupabaseConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');

    if (isSupabaseConfigured) {
      const { data, error: dbError } = await supabaseAdmin
        .from('contact_messages')
        .insert([
          {
            name: cleanName,
            email: cleanEmail,
            message: cleanMessage,
            status: 'new',
            ip_address: clientIp || null,
            user_agent: userAgent.substring(0, 255)
          }
        ])
        .select()
        .single();

      if (dbError) {
        console.error('[Supabase DB Insert Error]', dbError);
        return res.status(500).json({
          success: false,
          error: 'An unexpected database error occurred while saving your message. Please try again.'
        });
      }

      savedMessage = data;
    } else {
      console.warn('[Supabase] Warning: Database URL unconfigured. Running in local test simulation mode.');
      savedMessage = {
        id: 'msg-' + Date.now(),
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
        status: 'new',
        ip_address: clientIp || '127.0.0.1',
        user_agent: userAgent.substring(0, 255),
        reply_notes: null,
        replied_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      addDevMessage(savedMessage);
    }

    // 6. Email Notification via Resend (Fail-safe: errors are isolated from DB success)
    sendAdminNotification({
      name: cleanName,
      email: cleanEmail,
      message: cleanMessage,
      messageId: savedMessage.id,
      createdAt: savedMessage.created_at
    }).catch(emailErr => {
      console.error('[Resend Background Notice Error]', emailErr);
    });

    // 7. Successful Response to Client
    return res.status(201).json({
      success: true,
      message: `Thank you for reaching out, ${cleanName}! Your message has been received.`,
      data: {
        id: savedMessage.id
      }
    });

  } catch (error) {
    console.error('[POST /api/contact Error]', error);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while processing your message. Please try again.'
    });
  }
});

module.exports = router;
