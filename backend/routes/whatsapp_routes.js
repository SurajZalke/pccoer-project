/**
 * routes/whatsapp_routes.js
 * All WhatsApp admin API endpoints.
 * Every route is protected by requireAdminSecret middleware.
 */

'use strict';

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { requireAdminSecret } = require('../lib/auth_middleware');
const { getTodayStats }      = require('../lib/firebase_logger');

// Lazy-require WhatsApp modules so the router can load even before WA connects
const wa = () => require('../whatsapp/client');
const msgSender  = () => require('../whatsapp/message_sender');
const mediaSender = () => require('../whatsapp/media_sender');
const groupSender = () => require('../whatsapp/group_sender');
const resultSender = () => require('../whatsapp/result_sender');
const attendanceSender = () => require('../whatsapp/attendance_sender');
const feeSender  = () => require('../whatsapp/fee_sender');
const hwSender   = () => require('../whatsapp/homework_sender');
const pdfSender = () => require('../whatsapp/pdf_sender');

const router = express.Router();

const reportDebugEvent = (hypothesisId, msg, data = {}, runId = process.env.WA_DEBUG_RUN_ID || 'pre-fix') => {
  // #region debug-point shared:report-runtime-event
  (() => {
    const envPath = path.resolve(__dirname, '../../.dbg/whatsapp-browser-path.env');
    let debugUrl = 'http://127.0.0.1:7777/event';
    let sessionId = 'whatsapp-browser-path';
    try {
      const envFile = fs.readFileSync(envPath, 'utf8');
      debugUrl = envFile.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugUrl;
      sessionId = envFile.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
    } catch {}
    fetch(debugUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        runId,
        hypothesisId,
        location: 'backend/routes/whatsapp_routes.js',
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
    }).catch(() => {});
  })();
  // #endregion
};

// ── File upload config ────────────────────────────────────────────────────────
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB max
  fileFilter(req, file, cb) {
    const allowed = /pdf|jpeg|jpg|png|mp4/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Only PDF, images and MP4 files are allowed'));
  },
});

// Apply auth to all routes in this router
router.use(requireAdminSecret);

// ─────────────────────────────────────────────────────────────────────────────
// STATUS & QR (defined first so they bypass the WhatsApp availability middleware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/whatsapp/status
 * Returns connection status, QR (if pending), and today's stats.
 */
router.get('/status', async (req, res) => {
  const waModule = wa();
  const { state } = waModule;
  const stats = await getTodayStats().catch(() => ({ sent: 0, failed: 0, studentsReached: 0 }));
  res.json({
    status:        state.status,
    qr:            state.status === 'qr_pending' ? state.qr : null,
    qrGeneratedAt: state.status === 'qr_pending' ? state.qrGeneratedAt : null,
    info:          state.info ? { name: state.info.pushname, number: state.info.wid?.user } : null,
    initError:     waModule.lastInitError || null,
    stats,
  });
});

/**
 * GET /api/whatsapp/debug
 * Returns raw diagnostics — session dir, last error, runtime info.
 */
router.get('/debug', (req, res) => {
  const waModule = wa();
  const { state } = waModule;

  res.json({
    status:        state.status,
    sessionDir:    process.env.SESSION_PATH || path.resolve(__dirname, '../sessions'),
    lastInitError: waModule.lastInitError || null,
    engine:        'baileys (WebSocket — no Chromium/Puppeteer)',
    platform:      process.platform,
    nodeVersion:   process.version,
    env: {
      SESSION_PATH: process.env.SESSION_PATH || '(not set)',
    },
  });
});

// Middleware to check if WhatsApp is available (for all routes except status/debug which are already defined)
router.use((req, res, next) => {
  try {
    wa(); // ensure the WhatsApp module loads
    next();
  } catch (err) {
    return res.status(503).json({
      error: 'WhatsApp feature temporarily unavailable.',
      code: 'WHATSAPP_UNAVAILABLE'
    });
  }
});

/**
 * POST /api/whatsapp/reconnect
 * Manually trigger a reconnect.
 */
router.post('/reconnect', async (req, res) => {
  const waModule = wa();
  try {
    // Destroy current client first, then initialize handles cleanup + restart
    if (waModule.client) {
      await waModule.client.destroy().catch(() => {});
    }
    // initialize() handles lock cleanup, process kill, and fresh start
    waModule.initialize();
    res.json({ success: true, message: 'Reconnecting…' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/disconnect
 * Gracefully disconnect WhatsApp without deleting session.
 */
router.post('/disconnect', async (req, res) => {
  const waModule = wa();
  try {
    await waModule.client.destroy().catch(() => {});
    waModule.state.status = 'disconnected';
    waModule.state.qr = null;
    waModule.state.info = null;
    res.json({ success: true, message: 'Disconnected.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/whatsapp/session
 * Delete the saved WhatsApp session so next connect forces a fresh QR scan.
 *
 * Flow:
 *  1. Close the current Baileys socket.
 *  2. Delete ALL session directories (primary + legacy .wwebjs_auth).
 *  3. Re-initialize with a fresh client instance (see client.js → initialize()).
 */
router.delete('/session', async (req, res) => {
  const waModule = wa();
  try {
    // 1. Destroy current client (ignore errors — client may already be dead)
    await waModule.client.destroy().catch(() => {});
    waModule.state.status = 'disconnected';
    waModule.state.qr = null;
    waModule.state.info = null;

    // 2. Delete session files — primary dir + legacy .wwebjs_auth fallback
    const SESSION_DIR = process.env.SESSION_PATH
      ? path.resolve(process.env.SESSION_PATH)
      : path.resolve(__dirname, '../sessions');

    const legacyDir = path.resolve(__dirname, '../.wwebjs_auth');
    const cacheDir = path.resolve(__dirname, '../.wwebjs_cache');
    const nodeModulesCacheDir = path.resolve(__dirname, '../node_modules/.cache');
    // #region debug-point E:delete-local-whatsapp-state
    reportDebugEvent('E', 'Deleting local WhatsApp state', {
      sessionDir: SESSION_DIR,
      sessionDirExists: fs.existsSync(SESSION_DIR),
      legacyDir,
      legacyDirExists: fs.existsSync(legacyDir),
      cacheDir,
      cacheDirExists: fs.existsSync(cacheDir),
      nodeModulesCacheDir,
      nodeModulesCacheDirExists: fs.existsSync(nodeModulesCacheDir),
    });
    // #endregion

    for (const dir of [SESSION_DIR, legacyDir, cacheDir, nodeModulesCacheDir]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log('[WhatsApp] 🗑️ Session deleted:', dir);
      }
    }

    // 3. Brief pause to let the OS flush file handles, then re-initialize
    //    with a fresh Client instance (see whatsapp/client.js → initialize())
    setTimeout(() => {
      waModule.initialize();
    }, 1500);

    res.json({ success: true, message: 'Session deleted. Scan QR to reconnect.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT / BROADCAST MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/send
 * Body: { phone, message }
 */
router.post('/send', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone and message are required' });
  const result = await msgSender().sendMessage(phone, message);
  res.json(result);
});

/**
 * POST /api/whatsapp/broadcast
 * Body: { phones: string[], message: string }
 */
router.post('/broadcast', async (req, res) => {
  const { phones, message } = req.body;
  if (!Array.isArray(phones) || !message) {
    return res.status(400).json({ error: 'phones (array) and message are required' });
  }
  const contacts = phones.map(p => ({ phone: p }));
  const result = await msgSender().sendBulkMessages(contacts, message);
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// FILE / PDF SENDING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/send-file
 * Multipart: file + fields: phone, caption
 */
router.post('/send-file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { phone, caption } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const filePath = req.file.path;
  // Rename with original extension so WhatsApp shows the right icon
  const ext = path.extname(req.file.originalname);
  const renamedPath = filePath + ext;
  fs.renameSync(filePath, renamedPath);

  const result = await mediaSender().sendFile(phone, renamedPath, caption || '');
  fs.unlink(renamedPath, () => {}); // cleanup
  res.json(result);
});

/**
 * POST /api/whatsapp/send-file-bulk
 * Multipart: file + fields: phones (JSON array), caption
 */
router.post('/send-file-bulk', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { phones, caption } = req.body;
  let phoneList;
  try { phoneList = JSON.parse(phones); } catch { return res.status(400).json({ error: 'phones must be a JSON array' }); }

  const ext = path.extname(req.file.originalname);
  const renamedPath = req.file.path + ext;
  fs.renameSync(req.file.path, renamedPath);

  const contacts = phoneList.map(p => ({ phone: p }));
  const result = await mediaSender().sendFileBulk(contacts, renamedPath, caption || '');
  fs.unlink(renamedPath, () => {});
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/send-result
 * Body: { studentPhone, parentPhone, studentName, examTitle, score, totalMarks,
 *         percentage, rank, totalStudents, date, batch, subjects[] }
 */
router.post('/send-result', async (req, res) => {
  const required = ['studentName', 'examTitle', 'score', 'totalMarks', 'percentage'];
  for (const f of required) {
    if (req.body[f] === undefined) return res.status(400).json({ error: `${f} is required` });
  }
  const results = await resultSender().sendResultToStudent(req.body);
  res.json({ success: true, results });
});

/**
 * POST /api/whatsapp/send-results-exam
 * Body: { examId }
 * Fetches all results for the exam from Firestore and sends to all students.
 */
router.post('/send-results-exam', async (req, res) => {
  const { examId } = req.body;
  if (!examId) return res.status(400).json({ error: 'examId is required' });
  const result = await resultSender().sendResultsForExam(examId);
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/attendance-alert
 * Body: { studentName, parentPhone, date?, batch? }
 */
router.post('/attendance-alert', async (req, res) => {
  const { studentName, parentPhone } = req.body;
  if (!studentName || !parentPhone) return res.status(400).json({ error: 'studentName and parentPhone required' });
  const result = await attendanceSender().sendAbsenceAlert(req.body);
  res.json(result);
});

/**
 * POST /api/whatsapp/process-attendance
 * Body: { records: [{ studentId, status, date }] }
 * Processes a full attendance list and sends alerts for absent students.
 */
router.post('/process-attendance', async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records array is required' });
  const results = await attendanceSender().processAttendanceAndAlert(records);
  res.json({ success: true, alertsSent: results.length, results });
});

/**
 * POST /api/whatsapp/attendance-report
 * Body: { studentId, month, year }
 */
router.post('/attendance-report', async (req, res) => {
  const { studentId, month, year } = req.body;
  if (!studentId || !month || !year) return res.status(400).json({ error: 'studentId, month, year required' });
  const results = await attendanceSender().sendMonthlyReport(studentId, Number(month), Number(year));
  res.json({ success: true, results });
});

// ─────────────────────────────────────────────────────────────────────────────
// FEE REMINDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/fee-reminder
 * Body: { studentName, parentPhone, studentPhone, amountDue, dueDate, batch }
 */
router.post('/fee-reminder', async (req, res) => {
  const { studentName, parentPhone, amountDue, dueDate } = req.body;
  if (!studentName || !amountDue || !dueDate) return res.status(400).json({ error: 'studentName, amountDue, dueDate required' });
  const results = await feeSender().sendFeeReminder(req.body);
  res.json({ success: true, results });
});

/**
 * POST /api/whatsapp/run-fee-reminders
 * Trigger daily fee reminder scan manually.
 */
router.post('/run-fee-reminders', async (req, res) => {
  const result = await feeSender().runDailyFeeReminders();
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// HOMEWORK & NOTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/send-homework
 * Multipart: file + fields: batch, subject, caption, type ('homework'|'notes')
 */
router.post('/send-homework', upload.single('file'), async (req, res) => {
  const { batch, subject, caption, type } = req.body;
  if (!batch) return res.status(400).json({ error: 'batch is required' });

  const params = { batch, subject, caption, type: type || 'homework' };

  if (req.file) {
    const ext = path.extname(req.file.originalname);
    const renamedPath = req.file.path + ext;
    fs.renameSync(req.file.path, renamedPath);
    params.filePath = renamedPath;
  }

  const result = await hwSender().sendHomeworkToBatch(params);
  if (req.file) fs.unlink(params.filePath, () => {});
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/whatsapp/groups
 * List all WhatsApp groups the account is in.
 */
router.get('/groups', async (req, res) => {
  const groups = await groupSender().listGroups();
  res.json({ groups });
});

/**
 * POST /api/whatsapp/group-message
 * Body: { groupId, message }
 */
router.post('/group-message', async (req, res) => {
  const { groupId, message } = req.body;
  if (!groupId || !message) return res.status(400).json({ error: 'groupId and message are required' });
  const result = await groupSender().sendToGroup(groupId, message);
  res.json(result);
});

/**
 * POST /api/whatsapp/group-file
 * Multipart: file + fields: groupId, caption
 */
router.post('/group-file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { groupId, caption } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });

  const ext = path.extname(req.file.originalname);
  const renamedPath = req.file.path + ext;
  fs.renameSync(req.file.path, renamedPath);

  const result = await groupSender().sendFileToGroup(groupId, renamedPath, caption || '');
  fs.unlink(renamedPath, () => {});
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/whatsapp/stats
 */
router.get('/stats', async (req, res) => {
  const stats = await getTodayStats().catch(() => ({ sent: 0, failed: 0, studentsReached: 0 }));
  res.json(stats);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLASS BROADCAST — send to all students in a class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/class-broadcast
 * Body: { className, message, includeParents? }
 * Fetches all students with examName === className from Firestore,
 * collects their phone/parentPhone and broadcasts the message.
 */
router.post('/class-broadcast', async (req, res) => {
  const { className, message, includeParents = true } = req.body;
  if (!className || !message) {
    return res.status(400).json({ error: 'className and message are required' });
  }
  try {
    const { db } = require('../lib/firebase');
    const snap = await db.collection('students').where('examName', '==', className).get();
    if (snap.empty) return res.json({ sent: 0, failed: 0, skipped: 0, message: 'No students found in this class' });

    const phones = new Set();
    snap.docs.forEach(d => {
      const s = d.data();
      if (s.phone) phones.add(s.phone);
      if (includeParents && s.parentPhone) phones.add(s.parentPhone);
    });

    const contacts = Array.from(phones).map(p => ({ phone: p }));
    if (contacts.length === 0) return res.json({ sent: 0, failed: 0, skipped: snap.size, message: 'No phone numbers found' });

    const result = await msgSender().sendBulkMessages(contacts, message);
    res.json({ ...result, total: contacts.length, class: className });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ RESULTS AUTO-SEND — after game ends
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/quiz-results
 * Body: { gameId, quizId?, quizTitle, players: [{nickname, rollNo?, phone?, parentPhone?,
 *   score, totalMarks, correct, total, accuracy, percentile, rank, totalPlayers,
 *   answers: [{questionId, selectedOption, correct, optionId}] }] }
 *
 * For each player:
 *  1. If player has phone → look up Realtime DB players/{classId}/{rollNo} for mobile
 *  2. Send scorecard text + PDF (with answer sheet) to student phone and parentPhone
 */
router.post('/quiz-results', async (req, res) => {
  const { gameId, quizId, quizTitle, players } = req.body;
  if (!quizTitle || !Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'quizTitle and players[] required' });
  }

  const { sendResultPDF } = require('../whatsapp/pdf_sender');
  const { sendMessage } = require('../whatsapp/message_sender');
  const totalStudents = players.length;
  let sent = 0, failed = 0, skipped = 0;

  // ── Fetch quiz questions from Firebase Realtime DB ──────────────────────
  let quizQuestions = [];
  const resolvedQuizId = quizId || gameId;
  if (resolvedQuizId) {
    try {
      const { rtdb } = require('../lib/firebase');
      // Try quizzes/{quizId} first (shared quiz), then games/{gameId}/quiz
      const quizSnap = await rtdb.ref(`quizzes/${resolvedQuizId}`).once('value');
      if (quizSnap.exists()) {
        const quizData = quizSnap.val();
        quizQuestions = quizData.questions || [];
      } else {
        const gameSnap = await rtdb.ref(`games/${resolvedQuizId}/quiz`).once('value');
        if (gameSnap.exists()) {
          const gameQuiz = gameSnap.val();
          quizQuestions = gameQuiz.questions || [];
        }
      }
    } catch (fetchErr) {
      console.warn('[QuizResults] Could not fetch quiz questions:', fetchErr.message);
    }
  }

  const gradeLabel = (pct) => {
    if (pct >= 90) return '🏆 Excellent!';
    if (pct >= 75) return '⭐ Very Good';
    if (pct >= 60) return '✅ Good';
    if (pct >= 40) return '📝 Average';
    return '💪 Keep Practicing';
  };

  for (const p of players) {
    const phone = p.phone;
    const parentPhone = p.parentPhone;

    if (!phone && !parentPhone) { skipped++; continue; }

    const scoreMsg =
      `🎯 *Quiz Result — ${quizTitle}*\n\n` +
      `👤 Student: *${p.nickname}*\n` +
      (p.rollNo ? `📋 Roll No: ${p.rollNo}\n` : '') +
      `\n📊 *Your Score*\n` +
      `• Score: *${p.score} / ${p.totalMarks}*\n` +
      `• Correct: ${p.correct} / ${p.total} questions\n` +
      `• Accuracy: *${(p.accuracy || 0).toFixed(1)}%*\n` +
      `• Percentile: *${(p.percentile || 0).toFixed(1)}%*\n` +
      `• Rank: *${p.rank}* out of *${totalStudents}*\n` +
      `• ${gradeLabel(p.percentile || 0)}\n\n` +
      `🎓 *PCCOER Education Platform*\nKeep learning, keep growing! 💪`;

    // Build per-player answer sheet by mapping answers → questions
    const answerSheet = buildAnswerSheet(quizQuestions, p.answers || []);

    const resultParams = {
      studentName: p.nickname,
      examTitle: quizTitle,
      score: p.score,
      totalMarks: p.totalMarks,
      percentage: p.totalMarks > 0 ? ((p.score / p.totalMarks) * 100) : 0,
      rank: p.rank,
      totalStudents,
      date: new Date().toLocaleDateString('en-IN'),
      batch: p.batch || p.rollNo || undefined,
      answerSheet,
    };

    try {
      if (phone) {
        await sendMessage(phone, scoreMsg);
        await sendResultPDF(phone, resultParams).catch(() => {});
        sent++;
      }
      if (parentPhone && parentPhone !== phone) {
        const parentMsg =
          `📢 *Parent Alert — Quiz Result*\n\n` +
          `Dear Parent,\n` +
          `Your child *${p.nickname}* completed a quiz.\n\n` +
          `📚 Quiz: *${quizTitle}*\n` +
          `📊 Score: *${p.score} / ${p.totalMarks}*\n` +
          `🏆 Rank: *${p.rank}* out of *${totalStudents}*\n` +
          `📈 Accuracy: *${(p.accuracy || 0).toFixed(1)}%*\n\n` +
          `— PCCOER Education Platform`;
        await sendMessage(parentPhone, parentMsg);
        sent++;
      }
      await new Promise(r => setTimeout(r, 1500)); // rate limit
    } catch (err) {
      failed++;
      console.error('[QuizResults] Send error for', p.nickname, err.message);
    }
  }

  res.json({ success: true, sent, failed, skipped, total: players.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// OMR Results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp/omr-send-result
 * Send OMR result to individual student (and parent if available)
 * Body: {
 *   studentPhone?: string,
 *   parentPhone?: string,
 *   studentName: string,
 *   examTitle: string,
 *   score: number,
 *   totalMarks: number,
 *   percentage: number,
 *   rank?: number,
 *   totalStudents?: number,
 *   date?: string,
 *   batch?: string,
 *   answerKey?: string[],
 *   detectedAnswers?: string[]
 * }
 */
router.post('/omr-send-result', async (req, res) => {
  const { db } = require('../lib/firebase');
  const {
    studentPhone,
    parentPhone,
    studentName,
    examTitle,
    score,
    totalMarks,
    percentage,
    rank = 1,
    totalStudents = 1,
    date = new Date().toLocaleDateString('en-IN'),
    batch,
    answerKey = [],
    detectedAnswers = []
  } = req.body;

  if (!studentName || !examTitle || score === undefined || totalMarks === undefined || percentage === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const results = [];

  // Build answer sheet for PDF
  const answerSheet = answerKey.map((correct, i) => ({
    qNum: i + 1,
    questionText: `Question ${i + 1}`,
    selectedText: detectedAnswers[i] || 'Not Answered',
    correctText: correct,
    isCorrect: detectedAnswers[i]?.toUpperCase() === correct?.toUpperCase()
  }));

  const resultParams = {
    studentName,
    examTitle,
    score,
    totalMarks,
    percentage,
    rank,
    totalStudents,
    date,
    batch,
    answerSheet
  };

  // Grade label helper
  const gradeLabel = (pct) => {
    if (pct >= 90) return '🏆 Excellent!';
    if (pct >= 75) return '⭐ Very Good';
    if (pct >= 60) return '✅ Good';
    if (pct >= 40) return '📝 Average';
    return '💪 Keep Practicing';
  };

  // Text message
  const studentMsg =
    `🎯 *OMR Exam Result*\n` +
    `📚 Exam: *${examTitle}*\n` +
    `👤 Student: *${studentName}*\n\n` +
    `📊 Score: *${score} / ${totalMarks}*\n` +
    `📈 Percentage: *${percentage.toFixed(1)}% ${gradeLabel(percentage)}*\n` +
    `${rank > 1 ? `🏆 Rank: *${rank}* out of *${totalStudents}*\n\n` : '\n'}🎓 PCCOER Education Platform\nKeep learning, keep growing! 💪`;

  // Send to student
  if (studentPhone) {
    try {
      const msgResult = await msgSender().sendMessage(studentPhone, studentMsg);
      results.push({ to: 'student', phone: studentPhone, ...msgResult });
      const pdfResult = await pdfSender().sendResultPDF(studentPhone, resultParams);
      results.push({ to: 'student_pdf', phone: studentPhone, ...pdfResult });
    } catch (err) {
      results.push({ to: 'student', phone: studentPhone, success: false, error: err.message });
    }
    await new Promise(r => setTimeout(r, 1500)); // rate limit
  }

  // Send to parent
  if (parentPhone && parentPhone !== studentPhone) {
    const parentMsg =
      `📢 *Parent Alert — OMR Result*\n\n` +
      `Dear Parent,\n` +
      `Your child *${studentName}* has received their OMR exam result.\n\n` +
      `📚 Exam: *${examTitle}*\n` +
      `📊 Score: *${score} / ${totalMarks}* (${percentage.toFixed(1)}%)\n` +
      `${rank > 1 ? `🏆 Rank: *${rank}* out of *${totalStudents}*\n\n` : '\n'}— PCCOER Education Platform`;
    try {
      const msgResult = await msgSender().sendMessage(parentPhone, parentMsg);
      results.push({ to: 'parent', phone: parentPhone, ...msgResult });
    } catch (err) {
      results.push({ to: 'parent', phone: parentPhone, success: false, error: err.message });
    }
  }

  res.json({ success: true, results });
});

/**
 * POST /api/whatsapp/omr-send-group
 * Send OMR result summary to a WhatsApp group
 * Body: {
 *   groupId: string,
 *   examTitle: string,
 *   results: [{ studentName, score, totalMarks, percentage }]
 * }
 */
router.post('/omr-send-group', async (req, res) => {
  const { groupId, examTitle, results: studentResults, date } = req.body;
  if (!groupId || !examTitle || !Array.isArray(studentResults)) {
    return res.status(400).json({ error: 'groupId, examTitle, and results array are required' });
  }

  try {
    // Sort by percentage descending
    const sorted = [...studentResults].sort((a, b) => b.percentage - a.percentage);
    const passing = sorted.filter(r => r.percentage >= 35).length;
    const avg = sorted.length
      ? (sorted.reduce((s, r) => s + r.percentage, 0) / sorted.length).toFixed(1)
      : '0';

    // ── Text summary message ─────────────────────────────────────────────────
    let msg = `📊 *OMR Exam Results — ${examTitle}*\n`;
    msg += `📅 ${date || new Date().toLocaleDateString('en-IN')}\n\n`;

    const medals = ['🥇', '🥈', '🥉'];
    sorted.forEach((r, i) => {
      const prefix = i < 3 ? `${medals[i]} ` : `${i + 1}. `;
      const grade  = r.percentage >= 90 ? 'A+' : r.percentage >= 75 ? 'A'
                   : r.percentage >= 60 ? 'B'  : r.percentage >= 45 ? 'C'
                   : r.percentage >= 35 ? 'D'  : 'F';
      msg += `${prefix}*${r.studentName}*: ${r.score}/${r.totalMarks} (${r.percentage.toFixed(1)}%) — ${grade}\n`;
    });

    msg += `\n📈 *Class Stats*\n`;
    msg += `• Avg: *${avg}%*  •  Passing: *${passing}/${sorted.length}*\n`;
    msg += `\n🎓 PCCOER Education Platform`;

    // Send text first
    const textResult = await groupSender().sendToGroup(groupId, msg);

    // ── PDF results report ───────────────────────────────────────────────────
    let pdfResult = null;
    try {
      const { sendGroupResultsPDF } = require('../whatsapp/pdf_sender');
      pdfResult = await sendGroupResultsPDF(groupId, {
        examTitle,
        date: date || new Date().toLocaleDateString('en-IN'),
        results: sorted,
      });
    } catch (pdfErr) {
      console.warn('[omr-send-group] PDF send failed (non-fatal):', pdfErr.message);
    }

    res.json({ success: true, text: textResult, pdf: pdfResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Build answer sheet rows from quiz questions + player answers.
 * Handles both live-game format (questionId + selectedOption) and
 * shared-quiz format (optionId + correct, index-ordered).
 *
 * @param {Array} questions - Quiz question objects
 * @param {Array} answers   - Player answer objects
 * @returns {Array} - [{ qNum, questionText, selectedText, correctText, isCorrect }]
 */
function buildAnswerSheet(questions, answers) {
  if (!questions || questions.length === 0) return [];

  return questions.map((q, idx) => {
    const qText = q.text || q.questionText || `Question ${idx + 1}`;
    const options = Array.isArray(q.options) ? q.options : [];
    const correctOpt = options.find(o => o.id === q.correctOption || o.id === q.correctAnswer || o.correct);
    const correctText = correctOpt ? correctOpt.text : '—';

    // Try to match by questionId first (live game), then fall back to index (shared quiz)
    const byId = answers.find(a => a.questionId === q.id || a.questionId === q.publicId);
    const answer = byId || answers[idx];

    let selectedText = 'Not Answered';
    let isCorrect = false;

    if (answer) {
      // selectedOption (live game) or optionId (shared quiz)
      const selectedId = answer.selectedOption || answer.optionId;
      const selectedOpt = options.find(o => o.id === selectedId);
      selectedText = selectedOpt ? selectedOpt.text : (selectedId ? selectedId : 'Not Answered');
      isCorrect = Boolean(answer.correct);
    }

    return {
      qNum: idx + 1,
      questionText: qText,
      selectedText,
      correctText,
      isCorrect,
    };
  });
}

module.exports = router;
