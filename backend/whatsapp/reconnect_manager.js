/**
 * whatsapp/reconnect_manager.js
 * Watches the WhatsApp client state and automatically reconnects on disconnection.
 */

'use strict';

// Use the module reference (not destructured `client`) so we always access
// the current client instance after initialize() replaces it.
const waClient = require('./client');
const { state, bus, initialize } = waClient;

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 5_000;   // 5 s
const MAX_DELAY_MS  = 120_000; // 2 min

let retryCount = 0;
let retryTimer = null;

function scheduleReconnect() {
  if (retryCount >= MAX_RETRIES) {
    console.error('[Reconnect] Max retries reached. Manual intervention required.');
    return;
  }

  const delay = Math.min(BASE_DELAY_MS * 2 ** retryCount, MAX_DELAY_MS);
  retryCount++;

  console.log(`[Reconnect] Attempt ${retryCount}/${MAX_RETRIES} in ${delay / 1000}s…`);

  retryTimer = setTimeout(async () => {
    try {
      console.log('[Reconnect] Destroying old client instance…');
      await waClient.client.destroy().catch(() => {});
    } catch (_) { /* ignore */ }

    // Re-initialize — this reuses the same LocalAuth session files
    initialize();
  }, delay);
}

// Reset counter on successful connection
bus.on('ready', () => {
  retryCount = 0;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
});

bus.on('disconnected', (reason) => {
  if (reason === 'LOGOUT') {
    console.warn('[Reconnect] Client logged out. Session cleared. Awaiting new QR scan.');
    return; // Don't auto-reconnect after logout
  }
  scheduleReconnect();
});

bus.on('auth_failure', () => {
  console.warn('[Reconnect] Auth failure — clearing session and requesting new QR.');
  scheduleReconnect();
});

module.exports = { scheduleReconnect };
