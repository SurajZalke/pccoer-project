/**
 * lib/firebase_logger.js
 * Log every WhatsApp message send attempt to Firestore.
 */

'use strict';

const { db } = require('./firebase');

/**
 * @param {object} entry
 *   recipient, message, status ('sent'|'failed'), messageId?, error?, type?
 */
async function logMessage(entry) {
  try {
    await db.collection('whatsapp_logs').add({
      recipient:  entry.recipient,
      message:    entry.message || '',
      status:     entry.status,
      messageId:  entry.messageId || null,
      error:      entry.error || null,
      type:       entry.type || 'individual',
      timestamp:  new Date(),
    });
  } catch (err) {
    // Logger failure must never crash the main flow
    console.warn('[Logger] Failed to write to Firestore:', err.message);
  }
}

/**
 * Get today's message stats.
 */
async function getTodayStats() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const snap = await db.collection('whatsapp_logs')
    .where('timestamp', '>=', start)
    .get();

  let sent = 0, failed = 0;
  const recipients = new Set();

  snap.forEach(doc => {
    const d = doc.data();
    if (d.status === 'sent') { sent++; recipients.add(d.recipient); }
    else failed++;
  });

  return { sent, failed, studentsReached: recipients.size };
}

module.exports = { logMessage, getTodayStats };
