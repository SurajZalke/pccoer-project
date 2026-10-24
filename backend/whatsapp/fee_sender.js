/**
 * whatsapp/fee_sender.js
 * Fee reminder system — runs on a daily schedule.
 */

'use strict';

const { sendMessage } = require('./message_sender');
const { db } = require('../lib/firebase');

/**
 * Send a fee reminder to one student / parent.
 */
async function sendFeeReminder(params) {
  // params: { studentName, parentPhone, studentPhone, amountDue, dueDate, batch }
  const message =
    `💰 *Fee Reminder*\n\n` +
    `Dear Parent / Student,\n\n` +
    `This is a reminder that the fees for *${params.studentName}* are due.\n\n` +
    `📚 Batch: ${params.batch || '—'}\n` +
    `💵 Amount Due: *₹${params.amountDue}*\n` +
    `📅 Due Date: *${params.dueDate}*\n\n` +
    `Please make the payment at the earliest to avoid any inconvenience.\n\n` +
    `For queries, contact the office.\n\n` +
    `— *PCCOER Education Platform*`;

  const results = [];
  if (params.parentPhone) {
    const r = await sendMessage(params.parentPhone, message);
    results.push({ to: 'parent', ...r });
    await new Promise(res => setTimeout(res, 1200));
  }
  if (params.studentPhone) {
    const r = await sendMessage(params.studentPhone, message);
    results.push({ to: 'student', ...r });
    await new Promise(res => setTimeout(res, 1200));
  }
  return results;
}

/**
 * Scan all students with pending fees and send reminders.
 * Called by the daily scheduler.
 */
async function runDailyFeeReminders() {
  const today = new Date().toISOString().split('T')[0];
  console.log('[FeeReminder] Running daily fee reminder scan…');

  // students with feeDue <= today and feePaid !== true
  const snap = await db.collection('students')
    .where('feePaid', '!=', true)
    .get();

  let sent = 0, skipped = 0;

  for (const doc of snap.docs) {
    const student = doc.data();
    if (!student.feeDueDate) { skipped++; continue; }
    if (student.feeDueDate > today) { skipped++; continue; }

    await sendFeeReminder({
      studentName:  student.name,
      parentPhone:  student.parentPhone,
      studentPhone: student.phone,
      amountDue:    student.feeAmount || '—',
      dueDate:      student.feeDueDate,
      batch:        student.batch,
    });

    // Log reminder
    await db.collection('fee_reminders').add({
      studentId: doc.id,
      sentAt: new Date(),
      dueDate: student.feeDueDate,
    });

    sent++;
    await new Promise(res => setTimeout(res, 2000));
  }

  console.log(`[FeeReminder] Done. Sent: ${sent}, Skipped: ${skipped}`);
  return { sent, skipped };
}

module.exports = { sendFeeReminder, runDailyFeeReminders };
