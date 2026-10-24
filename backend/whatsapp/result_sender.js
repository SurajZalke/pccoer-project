/**
 * whatsapp/result_sender.js
 * Orchestrates result distribution: fetch from Firebase → generate PDF → send via WhatsApp.
 */

'use strict';

const { sendMessage } = require('./message_sender');
const { sendResultPDF } = require('./pdf_sender');
const { db } = require('../lib/firebase');

/**
 * Send result to a single student and their parent.
 * @param {object} params
 *   studentId, studentName, studentPhone, parentPhone,
 *   examTitle, score, totalMarks, percentage, rank, totalStudents,
 *   date, batch, subjects[]
 */
async function sendResultToStudent(params) {
  const results = [];

  // Text summary message
  const grade = gradeLabel(params.percentage);
  const summary =
    `🎯 *Quiz / Test Result*\n` +
    `📚 Exam: *${params.examTitle}*\n` +
    `👤 Student: *${params.studentName}*\n\n` +
    `📊 Score: *${params.score} / ${params.totalMarks}*\n` +
    `📈 Percentage: *${params.percentage.toFixed(1)}%* ${grade}\n` +
    `🏆 Rank: *${params.rank}* out of *${params.totalStudents}*\n\n` +
    `🎓 PCCOER Education Platform\nKeep learning, keep growing! 💪`;

  // Send text to student
  if (params.studentPhone) {
    const r = await sendMessage(params.studentPhone, summary);
    results.push({ to: 'student', phone: params.studentPhone, ...r });

    // Send PDF to student
    const pdf = await sendResultPDF(params.studentPhone, params);
    results.push({ to: 'student_pdf', phone: params.studentPhone, ...pdf });
  }

  // Send text to parent
  if (params.parentPhone) {
    const parentMsg =
      `📢 *Parent Alert — Result Notification*\n\n` +
      `Dear Parent,\n` +
      `Your child *${params.studentName}* has received their result.\n\n` +
      `📚 Exam: *${params.examTitle}*\n` +
      `📊 Score: *${params.score} / ${params.totalMarks}* (${params.percentage.toFixed(1)}%)\n` +
      `🏆 Rank: *${params.rank}* out of *${params.totalStudents}*\n\n` +
      `— PCCOER Education Platform`;

    const rp = await sendMessage(params.parentPhone, parentMsg);
    results.push({ to: 'parent', phone: params.parentPhone, ...rp });
  }

  return results;
}

/**
 * Bulk send results to all students in an exam.
 * @param {string} examId - Firestore exam document ID
 */
async function sendResultsForExam(examId, onProgress) {
  // Fetch exam results from Firestore
  const snapshot = await db.collection('results').where('examId', '==', examId).get();
  if (snapshot.empty) return { error: 'No results found for this exam' };

  const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const total = docs.length;
  let sent = 0, failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const r = docs[i];
    // Fetch student info
    const studentSnap = await db.collection('students').doc(r.studentId).get();
    if (!studentSnap.exists) { failed++; continue; }
    const student = studentSnap.data();

    await sendResultToStudent({
      studentId: r.studentId,
      studentName: student.name,
      studentPhone: student.phone,
      parentPhone: student.parentPhone,
      examTitle: r.examTitle || examId,
      score: r.score,
      totalMarks: r.totalMarks,
      percentage: r.percentage,
      rank: r.rank,
      totalStudents: total,
      date: r.date,
      batch: student.batch,
      subjects: r.subjects || [],
    });

    sent++;
    if (onProgress) onProgress(i + 1, total);
    await new Promise(res => setTimeout(res, 3000)); // respect rate limits
  }

  return { sent, failed, total };
}

function gradeLabel(pct) {
  if (pct >= 90) return '🏆 Excellent!';
  if (pct >= 75) return '⭐ Very Good';
  if (pct >= 60) return '✅ Good';
  if (pct >= 40) return '📝 Average';
  return '💪 Keep Practicing';
}

module.exports = { sendResultToStudent, sendResultsForExam };
