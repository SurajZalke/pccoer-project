/**
 * lib/scheduler.js
 * Daily cron jobs for automated reminders.
 * All times are in IST (UTC+5:30).
 */

'use strict';

const cron = require('node-cron');

let schedulerStarted = false;

function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // ── Fee reminders — every day at 9:00 AM IST ──────────────────────────────
  // IST = UTC + 5:30  →  cron in UTC: 3:30 AM = "30 3 * * *"
  cron.schedule('30 3 * * *', async () => {
    console.log('[Scheduler] Running daily fee reminders…');
    try {
      const { runDailyFeeReminders } = require('../whatsapp/fee_sender');
      const result = await runDailyFeeReminders();
      console.log('[Scheduler] Fee reminders done:', result);
    } catch (err) {
      console.error('[Scheduler] Fee reminder error:', err.message);
    }
  });

  // ── Attendance alerts — every weekday at 8:00 PM IST ─────────────────────
  // IST 8 PM = UTC 2:30 PM = "30 14 * * 1-6"
  cron.schedule('30 14 * * 1-6', async () => {
    console.log('[Scheduler] Checking attendance for today…');
    try {
      const { db } = require('./firebase');
      const { processAttendanceAndAlert } = require('../whatsapp/attendance_sender');
      const today = new Date().toISOString().split('T')[0];
      const snap = await db.collection('attendance').where('date', '==', today).get();
      if (!snap.empty) {
        const records = snap.docs.map(d => ({ studentId: d.data().studentId, status: d.data().status, date: today }));
        const result = await processAttendanceAndAlert(records);
        console.log('[Scheduler] Attendance alerts sent:', result.length);
      }
    } catch (err) {
      console.error('[Scheduler] Attendance alert error:', err.message);
    }
  });

  console.log('[Scheduler] All cron jobs started.');

  // ── Keep-alive ping (Render free tier spins down after 15 min of inactivity) ─
  // Ping our own health endpoint every 10 minutes to keep the service awake.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL ||
                   'https://dhole-sir-coaching-classes-iqpg.onrender.com';

  cron.schedule('*/10 * * * *', async () => {
    try {
      const https = require('https');
      https.get(`${SELF_URL}/health`, (res) => {
        console.log('[Scheduler] Keep-alive ping →', res.statusCode);
      }).on('error', (err) => {
        console.warn('[Scheduler] Keep-alive ping failed:', err.message);
      });
    } catch (err) {
      console.warn('[Scheduler] Keep-alive error:', err.message);
    }
  });
}

module.exports = { startScheduler };
