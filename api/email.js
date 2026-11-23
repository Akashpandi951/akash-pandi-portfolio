/**
 * api/email.js
 * High-performance email notification helper using Resend SDK.
 * Handles both:
 * 1. Admin notifications when a new contact message is received.
 * 2. Admin replies sent directly from the Admin Dashboard to visitors.
 */

const { Resend } = require('resend');

// Initialize Resend with graceful fallback if unconfigured
let resendClient = null;
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith('re_123456') || apiKey === 'your-resend-api-key') {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Sends notification email to the site owner when a visitor submits a contact form.
 */
async function sendAdminNotification({ name, email, message, messageId, createdAt }) {
  const resend = getResendClient();
  const toEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'akashpandi506@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Portfolio Contact <onboarding@resend.dev>';

  if (!resend) {
    console.warn('[Resend] API key not configured or using placeholder. Skipping email dispatch (message is safely saved in Supabase).');
    return { success: false, reason: 'unconfigured_api_key' };
  }

  const formattedDate = new Date(createdAt || Date.now()).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC'
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #08080D; color: #FFFFFF; margin: 0; padding: 24px; }
    .card { background-color: #111118; border: 1px solid rgba(255, 23, 68, 0.4); border-radius: 16px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
    .header { background: linear-gradient(135deg, #FF1744 0%, #D90429 100%); padding: 24px 28px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: 0.05em; text-transform: uppercase; }
    .content { padding: 28px; }
    .badge { display: inline-block; background: rgba(255, 23, 68, 0.15); border: 1px solid rgba(255, 23, 68, 0.4); color: #FF1744; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; padding: 4px 10px; border-radius: 999px; margin-bottom: 16px; }
    .meta-row { margin-bottom: 14px; font-size: 14px; color: #B4B4BE; }
    .meta-row strong { color: #FFFFFF; }
    .message-box { background-color: #08080D; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 18px; margin-top: 20px; font-size: 15px; line-height: 1.6; color: #FFFFFF; white-space: pre-wrap; }
    .footer { padding: 20px 28px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #71717A; text-align: center; }
    .btn { display: inline-block; background: #FF1744; color: #FFFFFF; padding: 10px 22px; border-radius: 999px; text-decoration: none; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>New Portfolio Inquiry</h1>
    </div>
    <div class="content">
      <span class="badge">New Message</span>
      <div class="meta-row"><strong>From:</strong> ${escapeHtml(name)} &lt;<a href="mailto:${escapeHtml(email)}" style="color:#FF1744;">${escapeHtml(email)}</a>&gt;</div>
      <div class="meta-row"><strong>Received:</strong> ${formattedDate} (UTC)</div>
      <div class="meta-row"><strong>Message ID:</strong> <code style="font-size:12px;color:#A1A1AA;">${messageId || 'N/A'}</code></div>
      
      <div class="message-box">
${escapeHtml(message)}
      </div>

      <div style="text-align: center;">
        <a href="mailto:${escapeHtml(email)}?subject=Re:%20Portfolio%20Inquiry%20-%20B.%20Akash%20Pandi" class="btn">Reply Directly via Email</a>
      </div>
    </div>
    <div class="footer">
      B. Akash Pandi Portfolio Contact Management System • Protected by Supabase & Cloudflare Turnstile
    </div>
  </div>
</body>
</html>
  `;

  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `[Portfolio Inquiry] New message from ${name}`,
      html: htmlContent
    });
    return { success: true, data };
  } catch (error) {
    console.error('[Resend] Error sending admin notification:', error.message || error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends reply email from site owner directly to visitor.
 */
async function sendVisitorReply({ visitorName, visitorEmail, replyMessage, originalMessage }) {
  const resend = getResendClient();
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'B. Akash Pandi <onboarding@resend.dev>';
  const replyToEmail = process.env.ADMIN_EMAIL || 'akashpandi506@gmail.com';

  if (!resend) {
    console.warn('[Resend] API key unconfigured. Simulating visitor reply in development mode.');
    return { success: true, simulated: true };
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #08080D; color: #FFFFFF; margin: 0; padding: 24px; }
    .card { background-color: #111118; border: 1px solid rgba(255, 23, 68, 0.4); border-radius: 16px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
    .header { background: linear-gradient(135deg, #FF1744 0%, #D90429 100%); padding: 24px 28px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #FFFFFF; text-transform: uppercase; letter-spacing: 0.05em; }
    .content { padding: 28px; }
    .greeting { font-size: 16px; font-weight: 600; color: #FFFFFF; margin-bottom: 16px; }
    .reply-body { font-size: 15px; line-height: 1.6; color: #E4E4E7; margin-bottom: 24px; white-space: pre-wrap; }
    .quote-box { background-color: #08080D; border-left: 3px solid #FF1744; border-radius: 0 8px 8px 0; padding: 14px 18px; margin-top: 20px; font-size: 13px; color: #A1A1AA; }
    .footer { padding: 20px 28px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #71717A; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>B. Akash Pandi</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 0.1em;">Aspiring Data Analyst &amp; AI Tools Enthusiast</p>
    </div>
    <div class="content">
      <div class="greeting">Hi ${escapeHtml(visitorName)},</div>
      <div class="reply-body">${escapeHtml(replyMessage)}</div>

      <div class="quote-box">
        <strong style="color:#FFFFFF;display:block;margin-bottom:4px;">Your original inquiry:</strong>
        ${escapeHtml(originalMessage)}
      </div>
    </div>
    <div class="footer">
      B. Akash Pandi • <a href="mailto:${replyToEmail}" style="color:#FF1744;text-decoration:none;">${replyToEmail}</a>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to: [visitorEmail],
      reply_to: replyToEmail,
      subject: `Re: Portfolio Inquiry - B. Akash Pandi`,
      html: htmlContent
    });
    return { success: true, data };
  } catch (error) {
    console.error('[Resend] Error sending visitor reply:', error.message || error);
    return { success: false, error: error.message };
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  sendAdminNotification,
  sendVisitorReply
};
