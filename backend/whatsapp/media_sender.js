/**
 * whatsapp/media_sender.js
 * Send files (PDF, images) as WhatsApp attachments.
 */

'use strict';

const { MessageMedia } = require('./message_media');
const wa = require('./client');
const getClient = () => wa.client;
const getState  = () => wa.state;
const { normalizeNumber } = require('./message_sender');
const { logMessage } = require('../lib/firebase_logger');
const fs = require('fs');
const path = require('path');

/**
 * Send a file from a local path.
 * @param {string} phone
 * @param {string} filePath  - absolute path to the file
 * @param {string} [caption]
 */
async function sendFile(phone, filePath, caption = '') {
  if (getState().status !== 'connected') {
    return { success: false, error: 'WhatsApp client not connected' };
  }

  const chatId = normalizeNumber(phone);
  if (!chatId) return { success: false, error: `Invalid phone number: ${phone}` };

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  try {
    const media = MessageMedia.fromFilePath(filePath);
    const msg = await getClient().sendMessage(chatId, media, { caption });
    await logMessage({
      recipient: phone,
      message: `[FILE] ${path.basename(filePath)}${caption ? ' - ' + caption.slice(0, 100) : ''}`,
      status: 'sent',
      messageId: msg.id._serialized,
    });
    return { success: true, messageId: msg.id._serialized };
  } catch (err) {
    await logMessage({
      recipient: phone,
      message: `[FILE] ${path.basename(filePath)}`,
      status: 'failed',
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Send a file from a Buffer (e.g. in-memory generated PDF).
 * @param {string} phone
 * @param {Buffer} buffer
 * @param {string} mimeType  e.g. 'application/pdf'
 * @param {string} filename
 * @param {string} [caption]
 */
async function sendBuffer(phone, buffer, mimeType, filename, caption = '') {
  if (getState().status !== 'connected') {
    return { success: false, error: 'WhatsApp client not connected' };
  }

  const chatId = normalizeNumber(phone);
  if (!chatId) return { success: false, error: `Invalid phone number: ${phone}` };

  try {
    const base64 = buffer.toString('base64');
    const media = new MessageMedia(mimeType, base64, filename);
    const msg = await getClient().sendMessage(chatId, media, { caption });
    await logMessage({
      recipient: phone,
      message: `[BUFFER_FILE] ${filename}${caption ? ' - ' + caption.slice(0, 100) : ''}`,
      status: 'sent',
      messageId: msg.id._serialized,
    });
    return { success: true, messageId: msg.id._serialized };
  } catch (err) {
    await logMessage({
      recipient: phone,
      message: `[BUFFER_FILE] ${filename}`,
      status: 'failed',
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Send a file to multiple numbers.
 */
async function sendFileBulk(contacts, filePath, caption, onProgress) {
  const results = { sent: 0, failed: 0, errors: [] };
  for (let i = 0; i < contacts.length; i++) {
    const { phone } = contacts[i];
    const result = await sendFile(phone, filePath, caption);
    if (result.success) results.sent++;
    else {
      results.failed++;
      results.errors.push({ phone, error: result.error });
    }
    if (onProgress) onProgress(i + 1, contacts.length);
    await new Promise(r => setTimeout(r, 2000)); // slightly slower for media
  }
  return results;
}

module.exports = { sendFile, sendBuffer, sendFileBulk };
