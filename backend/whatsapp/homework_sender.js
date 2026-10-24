/**
 * whatsapp/homework_sender.js
 * Send homework/notes PDFs to an entire batch.
 */

'use strict';

const { sendMessage } = require('./message_sender');
const { sendFile, sendBuffer } = require('./media_sender');
const { sendFileToGroup, sendBufferToGroup } = require('./group_sender');
const { db } = require('../lib/firebase');

/**
 * Send homework PDF to all students + parents in a batch.
 * @param {object} params
 *   { filePath|buffer, mimeType, filename, caption, batch, subject, type: 'homework'|'notes' }
 */
async function sendHomeworkToBatch(params) {
  const { batch, subject, type = 'homework' } = params;
  const typeLabel = type === 'notes' ? '📝 Notes' : '📚 Homework';
  const caption = params.caption ||
    `${typeLabel}\n` +
    `📚 Subject: *${subject || 'General'}*\n` +
    `🏫 Batch: *${batch}*\n\n` +
    `Please review and complete.\n— *PCCOER Education Platform*`;

  // Fetch all students in the batch
  const snap = await db.collection('students').where('batch', '==', batch).get();
  if (snap.empty) return { error: `No students found in batch: ${batch}` };

  let sent = 0, failed = 0, skipped = 0;

  for (const doc of snap.docs) {
    const student = doc.data();
    const phones = [student.phone, student.parentPhone].filter(Boolean);

    for (const phone of phones) {
      let result;
      if (params.filePath) {
        result = await sendFile(phone, params.filePath, caption);
      } else if (params.buffer) {
        result = await sendBuffer(phone, params.buffer, params.mimeType, params.filename, caption);
      } else {
        // Just send text if no file
        result = await sendMessage(phone, caption);
      }

      if (result.success) sent++;
      else { failed++; skipped++; }
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Also send to batch WhatsApp groups if configured
  const groupSnap = await db.collection('whatsapp_groups').where('batch', '==', batch).get();
  const groupResults = [];
  for (const gDoc of groupSnap.docs) {
    const g = gDoc.data();
    let gr;
    if (params.filePath) {
      gr = await sendFileToGroup(g.groupId, params.filePath, caption);
    } else if (params.buffer) {
      gr = await sendBufferToGroup(g.groupId, params.buffer, params.mimeType, params.filename, caption);
    }
    if (gr) groupResults.push({ groupId: g.groupId, name: g.name, ...gr });
    await new Promise(r => setTimeout(r, 1500));
  }

  return { sent, failed, skipped, groupsSent: groupResults.filter(g => g.success).length };
}

module.exports = { sendHomeworkToBatch };
