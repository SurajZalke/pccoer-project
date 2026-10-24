'use strict';

// Bypass self-signed certificate errors for WebSocket connections.
// This is necessary when local network proxies or antivirus software intercept TLS.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * whatsapp/client.js
 *
 * Lightweight WhatsApp client built on Baileys (WebSocket protocol).
 * No Chromium / Puppeteer — starts in a fraction of the memory, which is
 * what makes it viable on free-tier hosts (Render 512MB, Fly 256MB).
 *
 * Exposes the same surface the rest of the codebase already relies on:
 *   - state  { status, qr, qrGeneratedAt, info }
 *   - bus    (EventEmitter: 'qr' | 'ready' | 'disconnected' | 'auth_failure')
 *   - initialize()
 *   - client (getter) with sendMessage() / getGroups() / destroy() / info
 *   - lastInitError, chromiumPath (kept as null for route compatibility)
 */

const path = require('path');
const fs   = require('fs');
const https = require('https');
const EventEmitter = require('events');

// ── Session directory ─────────────────────────────────────────────────────────
function getSessionDir() {
  // Try env var first, then local directory (fallback if env var path is not writable)
  const candidates = [
    process.env.SESSION_PATH ? path.resolve(process.env.SESSION_PATH) : null,
    path.resolve(__dirname, '../sessions'),
    // Use /tmp as a last resort (writable on most systems)
    path.resolve('/tmp', 'dhole-sir-sessions'),
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Test write permission by creating a temp file
      const testFile = path.join(dir, '.test-write');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('[WhatsApp] Session dir:', dir);
      return dir;
    } catch (err) {
      console.warn('[WhatsApp] Failed to use session dir:', dir, '-', err.message);
    }
  }
  throw new Error('Could not find a writable session directory');
}
const SESSION_DIR = getSessionDir();
// Baileys stores multi-file auth state (creds.json + keys) in this folder.
const AUTH_DIR = path.join(SESSION_DIR, 'baileys_auth');

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  status: 'initializing',
  qr: null,
  qrGeneratedAt: null,
  info: null,
};
const bus = new EventEmitter();
bus.setMaxListeners(20);

let sock = null;             // raw Baileys socket
let lastInitError = null;
let baileysModule = null;    // cached ESM module

// ── Load Baileys lazily (it is an ESM package) ────────────────────────────────
async function loadBaileys() {
  if (!baileysModule) {
    baileysModule = await import('@whiskeysockets/baileys');
  }
  return baileysModule;
}

// ── Silent logger (Baileys is very chatty at default level) ───────────────────
function makeLogger() {
  try {
    return require('pino')({ level: 'silent' });
  } catch (_) {
    const noop = () => {};
    return { level: 'silent', fatal: noop, error: noop, warn: noop, info: noop, debug: noop, trace: noop, child() { return this; } };
  }
}

// ── Client facade (mimics the whatsapp-web.js Client surface we used before) ──
const client = {
  get info() { return state.info; },
  get raw() { return sock; },

  /**
   * Send a text or media message.
   * @param {string} jid       e.g. 919999999999@s.whatsapp.net or xxxx@g.us
   * @param {string|object} content  text string, or a MessageMedia instance
   * @param {{caption?: string}} [options]
   * @returns {Promise<{ id: { _serialized: string } }>}
   */
  async sendMessage(jid, content, options = {}) {
    if (!sock) throw new Error('WhatsApp client not connected');

    let res;
    if (typeof content === 'string') {
      res = await sock.sendMessage(jid, { text: content });
    } else if (content && content.data && typeof content.mimetype === 'string') {
      const buf     = Buffer.from(content.data, 'base64');
      const caption = options.caption || '';
      const mime    = content.mimetype;
      if (mime.startsWith('image/')) {
        res = await sock.sendMessage(jid, { image: buf, mimetype: mime, caption });
      } else {
        res = await sock.sendMessage(jid, { document: buf, mimetype: mime, fileName: content.filename, caption });
      }
    } else {
      throw new Error('Unsupported message content');
    }

    return { id: { _serialized: res?.key?.id || null } };
  },

  /**
   * List every group this account participates in.
   * @returns {Promise<Array<{ id: string, name: string, participantCount: number }>>}
   */
  async getGroups() {
    if (!sock) return [];
    const all = await sock.groupFetchAllParticipating();
    return Object.values(all).map((g) => ({
      id: g.id,
      name: g.subject,
      participantCount: g.participants?.length || 0,
    }));
  },

  /** Close the socket (used before re-init / on disconnect). */
  async destroy() {
    if (!sock) return;
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.end(undefined);
    } catch (_) { /* socket may already be dead */ }
    sock = null;
  },
};

// ── Initialize ────────────────────────────────────────────────────────────────
async function initialize() {
  try {
    const b = await loadBaileys();
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      Browsers,
    } = b;

    state.status = 'initializing';
    state.qr = null;
    state.info = null;
    lastInitError = null;

    // Tear down any previous socket first
    await client.destroy();

    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch (_) {
      version = undefined; // fall back to Baileys' bundled protocol version
    }

    // Create a custom HTTPS agent to bypass "self-signed certificate" errors
    // which often occur when local network proxies or antivirus intercept TLS.
    const agent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
    });

    sock = makeWASocket({
      version,
      auth: authState,
      logger: makeLogger(),
      agent, // Pass the custom agent here
      browser: Browsers ? Browsers.ubuntu('Chrome') : undefined,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        require('qrcode').toDataURL(qr, (err, url) => {
          state.qr = err ? null : url;
          state.qrGeneratedAt = Date.now();
          state.status = 'qr_pending';
          console.log('[WhatsApp] 📱 QR ready — open Dashboard to scan');
          bus.emit('qr', state.qr);
        });
      }

      if (connection === 'open') {
        const user = sock.user || {};
        const number = (user.id || '').split(':')[0].split('@')[0];
        state.status = 'connected';
        state.qr = null;
        state.info = {
          pushname: user.name || user.verifiedName || 'WhatsApp',
          wid: { user: number },
        };
        console.log(`[WhatsApp] ✅ Connected as ${state.info.pushname} (${number})`);
        bus.emit('ready', state.info);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut  = statusCode === DisconnectReason.loggedOut;
        state.status = 'disconnected';
        state.qr = null;

        if (loggedOut) {
          console.warn('[WhatsApp] ⚠️ Logged out — clearing session. Scan QR to reconnect.');
          try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (_) {}
          bus.emit('disconnected', 'LOGOUT');
        } else {
          const reason = lastDisconnect?.error?.message || `code ${statusCode}`;
          console.warn('[WhatsApp] ⚠️ Disconnected:', reason);
          bus.emit('disconnected', reason);
        }
      }
    });

    console.log('[WhatsApp] Baileys socket initialised (lightweight — no Chromium).');
  } catch (err) {
    console.error('[WhatsApp] ❌ Init error:', err.message || err);
    lastInitError = err.message || String(err);
    state.status = 'disconnected';
    bus.emit('disconnected', lastInitError);
  }
}

module.exports = {
  get client() { return client; },
  get lastInitError() { return lastInitError; },
  // Kept for backwards compatibility with existing routes — Chromium is no longer used.
  get chromiumPath() { return null; },
  state, bus, initialize,
};
