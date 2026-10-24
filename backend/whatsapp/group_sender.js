/**
 * whatsapp/group_sender.js
 * Send messages and files to WhatsApp groups by group ID.
 * Group IDs look like: 1234567890-1234567890@g.us
 */

'use strict';

const { MessageMedia } = require('./message_media');
const wa = require('./client');
const getClient = () => wa.client;
const getState  = () => wa.state;
const { logMessage } = require('../lib/firebase_logger');
const fs = require('fs');
const path = require('path');

/**
 * List all groups the WhatsApp account is in.
 * Returns an array of { id, name, participantCount }
 */
async function listGroups() {
  if (getState().status !== 'connected') return [];
  return getClient().getGroups();
}

/**
 * Send a text message to a group.
 */
async function sendToGroup(groupId, text) {
  if (getState().status !== 'connected') {
    return { success: false, error: 'WhatsApp not connected' };
  }
  try {
    const msg = await getClient().sendMessage(groupId, text);
    await logMessage({ recipient: groupId, message: text.slice(0, 200), status: 'sent', messageId: msg.id._serialized, type: 'group' });
    return { success: true, messageId: msg.id._serialized };
  } catch (err) {
    await logMessage({ recipient: groupId, message: text.slice(0, 200), status: 'failed', error: err.message, type: 'group' });
    return { success: false, error: err.message };
  }
}

/**
 * Send a file to a group.
 */
async function sendFileToGroup(groupId, filePath, caption = '') {
  if (getState().status !== 'connected') {
    return { success: false, error: 'WhatsApp not connected' };
  }
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }
  try {
    const media = MessageMedia.fromFilePath(filePath);
    const msg = await getClient().sendMessage(groupId, media, { caption });
    await logMessage({
      recipient: groupId,
      message: `[FILE] ${path.basename(filePath)}`,
      status: 'sent',
      messageId: msg.id._serialized,
      type: 'group',
    });
    return { success: true, messageId: msg.id._serialized };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Send a Buffer (e.g. generated PDF) to a group.
 */
async function sendBufferToGroup(groupId, buffer, mimeType, filename, caption = '') {
  if (getState().status !== 'connected') {
    return { success: false, error: 'WhatsApp not connected' };
  }
  try {
    const base64 = buffer.toString('base64');
    const media = new MessageMedia(mimeType, base64, filename);
    const msg = await getClient().sendMessage(groupId, media, { caption });
    await logMessage({
      recipient: groupId,
      message: `[FILE] ${filename}`,
      status: 'sent',
      messageId: msg.id._serialized,
      type: 'group',
    });
    return { success: true, messageId: msg.id._serialized };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Send a message to multiple groups.
 */
async function broadcastToGroups(groupIds, text) {
  const results = [];
  for (const gid of groupIds) {
    const r = await sendToGroup(gid, text);
    results.push({ groupId: gid, ...r });
    await new Promise(res => setTimeout(res, 1500));
  }
  return results;
}

module.exports = { listGroups, sendToGroup, sendFileToGroup, sendBufferToGroup, broadcastToGroups };
