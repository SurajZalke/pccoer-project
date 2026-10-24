/**
 * whatsapp/message_sender.js
 * Send plain text messages to individual numbers or lists.
 */

'use strict';

const wa = require('./client');

// Always access wa.client so we get the current instance after session resets.
const getClient = () => wa.client;
const getState  = () => wa.state;
const { logMessage } = require('../lib/firebase_logger');

/**
 * Normalize a phone number to WhatsApp chat ID format.
 * Accepts: +91XXXXXXXXXX  /  91XXXXXXXXXX  /  0XXXXXXXXXX
 */
function normalizeNumber(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  // If starts with 0, replace with 91 (India)
  if (digits.startsWith('0')) digits = '91' + digits.slice(1);
  // If 10 digits, prepend India code
  if (digits.length === 10) digits = '91' + digits;
  if (digits.length < 11) return null;
  // Baileys uses @s.whatsapp.net for individual chats (whatsapp-web.js used @c.us)
  return `${digits}@s.whatsapp.net`;
}

/**
 * Send a single text message.
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendMessage(phone, text) {
  if (getState().status !== 'connected') {
    return { success: false, error: 'WhatsApp client not connected' };
  }

  const chatId = normalizeNumber(phone);
  if (!chatId) return { success: false, error: `Invalid phone number: ${phone}` };

  try {
    const msg = await getClient().sendMessage(chatId, text);
    await logMessage({ recipient: phone, message: text.slice(0, 200), status: 'sent', messageId: msg.id._serialized });
    return { success: true, messageId: msg.id._serialized };
  } catch (err) {
    await logMessage({ recipient: phone, message: text.slice(0, 200), status: 'failed', error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Send a message to multiple numbers with rate limiting.
 * @param {Array<{phone: string}>} contacts
 * @param {string} text
 * @param {Function} [onProgress]
 */
async function sendBulkMessages(contacts, text, onProgress) {
  const results = { sent: 0, failed: 0, errors: [] };
  for (let i = 0; i < contacts.length; i++) {
    const { phone } = contacts[i];
    const result = await sendMessage(phone, text);
    if (result.success) results.sent++;
    else {
      results.failed++;
      results.errors.push({ phone, error: result.error });
    }
    if (onProgress) onProgress(i + 1, contacts.length);
    // Rate limit: 1 message per ~1.5s to avoid WhatsApp spam detection
    await new Promise(r => setTimeout(r, 1500));
  }
  return results;
}

module.exports = { sendMessage, sendBulkMessages, normalizeNumber };
