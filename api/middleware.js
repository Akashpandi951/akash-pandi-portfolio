/**
 * api/middleware.js
 * Security middleware, rate limiting, and Supabase client initializers.
 */

const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

// 1. Initialize Supabase Clients
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

// Admin / Service Role Client (Bypasses RLS on the server for secure operations)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Public Anon Client (Used for validating user sessions and tokens)
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
    // autoRefreshToken is true by default
  }
});

// 2. Rate Limiting Configuration
// Contact form submission rate limiter: configurable or default 5 requests per 15 minutes per IP
const contactMax = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : (process.env.NODE_ENV === 'test' ? 100 : 5);
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: contactMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many submissions from this IP address. Please wait 15 minutes before trying again.'
  }
});

// Admin endpoints rate limiter: max 120 requests per 15 minutes per IP
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.'
  }
});

// 3. Admin Authentication & Authorization Middleware
// Verifies Supabase Auth JWT token and confirms the user is the authorized admin.
async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or malformed authorization header.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No token provided.'
      });
    }

    // Verify token using Supabase Auth
    const isSupabaseConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');
    let user = null;

    if ((token === 'dev-admin-simulated-token' || token.startsWith('dev-')) && (!isSupabaseConfigured || process.env.NODE_ENV !== 'production')) {
      console.warn('[Dev Notice] Authenticated simulated dev admin session.');
      user = {
        id: 'dev-admin-simulated-id',
        email: (process.env.ADMIN_EMAIL || 'akashpandi506@gmail.com').toLowerCase().trim(),
        role: 'authenticated',
        last_sign_in_at: new Date().toISOString()
      };
    } else {
      const { data: { user: authUser }, error } = await supabasePublic.auth.getUser(token);
      if (error || !authUser) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or expired admin session. Please log in again.'
        });
      }
      user = authUser;
    }

    // Check against authorized admin email
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'akashpandi506@gmail.com').toLowerCase().trim();
    const userEmail = (user.email || '').toLowerCase().trim();

    if (userEmail !== configuredAdminEmail) {
      console.warn(`[Security Alert] Access denied for authenticated non-admin user: ${userEmail}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have administrator permissions to access these records.'
      });
    }

    // Attach verified user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]', err);
    return res.status(500).json({
      success: false,
      error: 'An internal authentication error occurred.'
    });
  }
}

// 4. Safe Error Handling Middleware
function errorHandler(err, req, res, next) {
  console.error('[Server Error]', err.stack || err);
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';
  res.status(status).json({
    success: false,
    error: isDev ? err.message : 'A server error occurred. Please try again later.'
  });
}

module.exports = {
  supabaseAdmin,
  supabasePublic,
  contactLimiter,
  adminLimiter,
  requireAdminAuth,
  errorHandler
};
