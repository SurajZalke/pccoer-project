/**
 * backend/server.js
 * Entry point for the WhatsApp Automation Backend.
 *
 * Start: node server.js   OR   npm start (in backend/ folder)
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

// ── Firebase (initialize first) ───────────────────────────────────────────────
require('./lib/firebase');

// ── WhatsApp client (initialize and auto-reconnect) ───────────────────────────
const { initialize } = require('./whatsapp/client');
require('./whatsapp/reconnect_manager'); // registers auto-reconnect listeners

// ── Scheduler (fee reminders, attendance alerts) ──────────────────────────────
const { startScheduler } = require('./lib/scheduler');

// ── Express setup ─────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

// Allowed origins — frontend URL
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:8081',
  'https://pccoerapp.vercel.app',
  'https://vivekdhole-sir.netlify.app',
  'https://mspcollage-advance.netlify.app',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);

    // Exact match
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Vercel preview deployments: *.vercel.app
    if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return callback(null, true);

    // Local network IPs (10.x, 172.16-31.x, 192.168.x) during development
    const isLocal = origin.includes('localhost') ||
                    origin.includes('127.0.0.1') ||
                    /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
                    /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin) ||
                    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin);

    if (isLocal) return callback(null, true);

    callback(new Error('CORS not allowed'), false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
}));

// Rate limiting — max 60 requests per minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down.' },
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
const whatsappRoutes = require('./routes/whatsapp_routes');
app.use('/api/whatsapp', whatsappRoutes);

// Authentication routes (forgot password, reset, contact)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Keep the old quiz image-delete route
const quizRoutes = require('./routes/quiz');
app.use('/api', quizRoutes);

// OMR scanning and PDF generation
const omrRoutes = require('./routes/omr');
app.use('/api/omr', omrRoutes);

// Avatar customization and subscription routes
const avatarRoutes = require('./routes/avatar');
app.use('/api/avatar', avatarRoutes);

// Health check (no auth)
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// 404 catch-all
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  PCCOER Education Platform — WhatsApp Backend         ║`);
  console.log(`║  Listening on http://localhost:${PORT}                  ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  // Start WhatsApp — will scan QR if no session, else auto-login (fail gracefully)
  initialize().catch((err) => {
    console.warn('[Server] WhatsApp initialization failed (continuing without it):', err?.message || err);
  });

  // Start scheduled jobs
  try {
    startScheduler();
  } catch (err) {
    console.warn('[Server] Scheduler failed to start (continuing without it):', err.message);
  }
});

module.exports = app;
