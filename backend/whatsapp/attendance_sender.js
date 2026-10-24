/**
 * whatsapp/attendance_sender.js
 * Auto-send absence alerts to parents and monthly attendance PDFs.
 */

'use strict';

const { sendMessage } = require('./message_sender');
const { sendAttendancePDF } = require('./pdf_sender');
const { db } = require('../lib/firebase');

/**
 * Send an absence alert to a parent immediately.
 * @param {{ studentName, parentPhone, date?, batch? }} params
 */
async function sendAbsenceAlert(params) {
  const date = params.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const message =
    `⚠️ *Attendance Alert*\n\n` +
    `Dear Parent,\n\n` +
    `Your child *${params.studentName}* was marked *ABSENT* today (${date}).\n` +
    (params.batch ? `📚 Batch: ${params.batch}\n` : '') +
    `\nPlease ensure regular attendance for better performance.\n\n` +
    `— *PCCOER Education Platform*`;

  return sendMessage(params.parentPhone, message);
}

/**
 * Process today's attendance list and send alerts for each absent student.
 * @param {Array<{ studentId, status }>} attendanceList
 */
async function processAttendanceAndAlert(attendanceList) {
  const absentStudents = attendanceList.filter(a => a.status === 'absent');
  const results = [];

  for (const record of absentStudents) {
    const studentSnap = await db.collection('students').doc(record.studentId).get();
    if (!studentSnap.exists) continue;
    const student = studentSnap.data();
    if (!student.parentPhone) continue;

    const result = await sendAbsenceAlert({
      studentName: student.name,
      parentPhone: student.parentPhone,
      date: record.date,
      batch: student.batch,
    });

    // Log to Firestore
    await db.collection('attendance').add({
      studentId: record.studentId,
      date: record.date || new Date().toISOString().split('T')[0],
      status: 'absent',
      alertSent: result.success,
      timestamp: new Date(),
    });

    results.push({ studentId: record.studentId, name: student.name, ...result });
    await new Promise(r => setTimeout(r, 1500));
  }

  return results;
}

/**
 * Send a monthly attendance PDF to a student and parent.
 */
async function sendMonthlyReport(studentId, month, year) {
  const studentSnap = await db.collection('students').doc(studentId).get();
  if (!studentSnap.exists) return { error: 'Student not found' };
  const student = studentSnap.data();

  // Fetch attendance records for this month
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end   = `${year}-${String(month).padStart(2, '0')}-31`;
  const snap = await db.collection('attendance')
    .where('studentId', '==', studentId)
    .where('date', '>=', start)
    .where('date', '<=', end)
    .get();

  const records = snap.docs.map(d => d.data()).map(r => ({
    date: r.date,
    status: r.status,
  })).sort((a, b) => a.date.localeCompare(b.date));

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const data = {
    studentName: student.name,
    batch: student.batch,
    month: monthNames[month - 1],
    year,
    records,
  };

  const results = [];
  if (student.phone) {
    const r = await sendAttendancePDF(student.phone, data);
    results.push({ to: 'student', ...r });
  }
  if (student.parentPhone) {
    const r = await sendAttendancePDF(student.parentPhone, data);
    results.push({ to: 'parent', ...r });
  }

  return results;
}

module.exports = { sendAbsenceAlert, processAttendanceAndAlert, sendMonthlyReport };
