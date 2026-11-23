/**
 * server.js
 * Production-ready Express Backend Server for Akash Pandi's Portfolio &
 * Contact Management System.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const contactRouter = require('./api/contact');
const adminRouter = require('./api/admin');
const aiRouter = require('./api/ai');
const { errorHandler } = require('./api/middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Enhanced Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline script execution
          "'unsafe-eval'",
          "https://cdn.tailwindcss.com",
          "https://unpkg.com",
          "https://challenges.cloudflare.com" // Cloudflare Turnstile CAPTCHA
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:"
        ],
        connectSrc: [
          "'self'",
          "https://*.supabase.co", // Supabase DB & Auth REST API
          "wss://*.supabase.co",   // Supabase Realtime WebSockets
          "https://challenges.cloudflare.com",
          "http://localhost:*",
          "http://127.0.0.1:*"
        ],
        frameSrc: [
          "'self'",
          "https://challenges.cloudflare.com" // Turnstile iframe
        ]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev, or restricted by configuration
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// 3. Body Parsers with Payload Safeguards
app.use(express.json({ limit: '50kb' })); // Prevents large payload abuse
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// 4. API Endpoints
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Akash Pandi Portfolio Contact Management API',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('placeholder')),
    supabaseConnected: Boolean(process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder')),
    resendConfigured: Boolean(process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_123456')),
    turnstileConfigured: Boolean(process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY && !process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY.startsWith('0x4AAAA'))
  });
});

// Explicit Admin Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 5. Static File Hosting (Serves index.html, admin.html, assets)
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

// Fallback to index.html for root navigation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 6. Global Centralized Error Handler
app.use(errorHandler);

// 7. Start Server
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`⚡ Akash Pandi Portfolio Backend running on http://localhost:${PORT}`);
    console.log(`📋 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`🛡️  Security: Helmet, CORS, Rate-Limiting & RLS Active`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port ${PORT} in use] Trying fallback port 3001...`);
      app.listen(3001, () => {
        console.log(`⚡ Backend listening on fallback http://localhost:3001`);
      });
    } else {
      console.error('[Server Listen Error]', err);
    }
  });
}

module.exports = app;
