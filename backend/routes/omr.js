/**
 * backend/routes/omr.js
 * OMR Scanning and PDF Generation routes.
 *
 * POST /api/omr/scan             — Upload + process OMR image, return detected answers
 * POST /api/omr/result-pdf       — Generate result PDF for one student
 * POST /api/omr/bulk-result-pdf  — Generate combined PDF for ALL students in an exam
 * POST /api/omr/sheet-pdf        — Generate printable OMR answer sheet PDF
 *
 * ALL routes require admin authentication (Firebase ID token or admin secret).
 */

'use strict';

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const PDFKit   = require('pdfkit');
const QRCode   = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../lib/auth_middleware');

const router = express.Router();

// ── Apply admin authentication to ALL routes in this router ──────────────────
router.use(requireAdmin);

// ── Multer — memory storage for uploaded scans ────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ── Helper: map index → option letter ────────────────────────────────────────
const IDX_TO_LETTER = ['A', 'B', 'C', 'D', 'E'];

// ── Helper: draw a filled/empty bubble in PDF ─────────────────────────────────
function drawBubble(doc, x, y, radius, filled) {
  doc.save();
  doc.circle(x, y, radius);
  if (filled) {
    doc.fill('#1a1a1a');
  } else {
    doc.stroke('#333333');
  }
  doc.restore();
}

// ── Helper: generate QR code data URL ────────────────────────────────────────
async function generateQR(text) {
  return QRCode.toDataURL(text, { margin: 1, width: 80 });
}

// ── OMR Image Analysis (pure JavaScript pixel analysis) ──────────────────────
/**
 * Analyses an OMR answer sheet image buffer.
 * This uses a grid-based approach: for each question row we examine 4-5 bubble
 * columns and decide which bubble is the darkest (filled).
 *
 * Returns array of detected option letters (e.g. ["A", "C", "B", ...])
 * or "?" if no bubble detected for that question.
 *
 * NOTE: This works best with high-contrast scans. For production-grade OCR,
 * this logic can be replaced by a Python Tesseract microservice call.
 */
async function analyzeOMRImage(imageBuffer, totalQuestions, optionsCount = 4) {
  try {
    // Use Jimp if available, otherwise fall back to pattern-based analysis
    let Jimp;
    try {
      Jimp = require('jimp');
    } catch (_e) {
      Jimp = null;
    }

    if (!Jimp) {
      // Fallback: return placeholder answers (host must verify manually)
      console.warn('[OMR] Jimp not available — returning placeholder detected answers');
      return Array(totalQuestions).fill('?');
    }

    const image = await Jimp.read(imageBuffer);

    // Convert to greyscale + increase contrast
    image.greyscale().contrast(0.5);

    const { width, height } = image.bitmap;

    // Define the answer grid region (top 10% is header, last 10% is footer)
    const topMargin    = Math.floor(height * 0.12);
    const bottomMargin = Math.floor(height * 0.90);
    const leftMargin   = Math.floor(width  * 0.08);
    const rightMargin  = Math.floor(width  * 0.92);

    const gridHeight   = bottomMargin - topMargin;
    const gridWidth    = rightMargin  - leftMargin;

    const rowHeight    = gridHeight / totalQuestions;
    const colWidth     = gridWidth  / optionsCount;

    const answers = [];

    for (let q = 0; q < totalQuestions; q++) {
      const rowY = topMargin + q * rowHeight + rowHeight * 0.5;
      let darkestCol  = -1;
      let darkestVal  = 255; // lower = darker

      for (let opt = 0; opt < optionsCount; opt++) {
        const colX = leftMargin + opt * colWidth + colWidth * 0.5;

        // Sample a 10×10 pixel area around the bubble centre
        let total = 0;
        let count = 0;
        for (let dy = -5; dy <= 5; dy++) {
          for (let dx = -5; dx <= 5; dx++) {
            const px = Math.round(colX + dx);
            const py = Math.round(rowY + dy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const grey = Jimp.intToRGBA(image.getPixelColor(px, py)).r;
              total += grey;
              count++;
            }
          }
        }
        const avg = count > 0 ? total / count : 255;
        if (avg < darkestVal) {
          darkestVal  = avg;
          darkestCol  = opt;
        }
      }

      // Only accept as filled if avg brightness < 100 (0=black, 255=white)
      if (darkestCol >= 0 && darkestVal < 100) {
        answers.push(IDX_TO_LETTER[darkestCol] || '?');
      } else {
        answers.push('?');
      }
    }

    return answers;
  } catch (err) {
    console.error('[OMR] Image analysis error:', err.message);
    return Array(totalQuestions).fill('?');
  }
}

// ── POST /api/omr/scan ────────────────────────────────────────────────────────
router.post('/scan', upload.single('omrFile'), async (req, res) => {
  try {
    const { totalQuestions, optionsCount, answerKey, examCode } = req.body;
    const total   = parseInt(totalQuestions, 10) || 30;
    const options = parseInt(optionsCount,   10) || 4;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let imageBuffer = req.file.buffer;
    const mimeType  = req.file.mimetype;

    // If PDF uploaded, convert first page to image using PDFKit page extraction
    // (For full PDF→image, recommend pdf-poppler or pdf2image in production)
    if (mimeType === 'application/pdf') {
      // Return a notice — we'll process as-is and rely on frontend canvas rendering
      return res.status(200).json({
        success: true,
        detectedAnswers: Array(total).fill('?'),
        message: 'PDF uploaded. Please use the manual answer entry or upload a JPG/PNG scan for automatic detection.',
        manualRequired: true,
      });
    }

    const detectedAnswers = await analyzeOMRImage(imageBuffer, total, options);

    // Score calculation if answerKey provided
    let score = null;
    if (answerKey) {
      const key = typeof answerKey === 'string' ? JSON.parse(answerKey) : answerKey;
      let obtained = 0;
      const breakdown = detectedAnswers.map((ans, i) => {
        const correct    = key[i] || '';
        const isCorrect  = ans !== '?' && ans.toUpperCase() === correct.toUpperCase();
        const awarded    = isCorrect ? 1 : 0;
        obtained += awarded;
        return { questionNo: i + 1, correctAnswer: correct, studentAnswer: ans, isCorrect, marksAwarded: awarded };
      });
      score = { obtained, total: key.length, breakdown };
    }

    return res.json({
      success: true,
      detectedAnswers,
      score,
      examCode: examCode || null,
    });

  } catch (err) {
    console.error('[OMR] Scan error:', err);
    res.status(500).json({ error: err.message || 'Failed to process OMR' });
  }
});

// ── POST /api/omr/sheet-pdf ───────────────────────────────────────────────────
/**
 * Generate printable OMR answer sheets — one page per student.
 * Each page has a scannable QR code encoding the sheetCode (examCode|rollNo|studentId).
 * Body: { examTitle, examCode, className, totalQuestions, optionsCount,
 *         students: [{ studentName, rollNo, sheetCode }] }
 * Returns: application/pdf binary stream
 */
router.post('/sheet-pdf', async (req, res) => {
  try {
    const {
      examTitle      = 'OMR Exam',
      examCode       = '',
      className      = '',
      totalQuestions = 30,
      optionsCount   = 4,
      students       = [],
    } = req.body;

    // Validate
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'No students provided' });
    }

    // Build PDF in memory so we can set Content-Length (fixes browser download)
    const chunks = [];
    const doc = new PDFKit({ size: 'A4', margin: 0, autoFirstPage: false });
    doc.on('data', chunk => chunks.push(chunk));

    const A4W    = 595.28;
    const A4H    = 841.89;
    const MARGIN = 28;
    const OPTS   = Math.min(Math.max(optionsCount, 3), 5);

    for (const student of students) {
      doc.addPage({ size: 'A4', margin: 0 });

      // ── Deep-indigo header band ──────────────────────────────────────────
      doc.rect(0, 0, A4W, 82).fill('#1e1b4b');

      // School name
      doc.fillColor('#a5b4fc').font('Helvetica-Bold').fontSize(9)
        .text('PCCOER EDUCATION PLATFORM', MARGIN, 10, { width: A4W - MARGIN * 2 - 90 });

      // Exam title
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
        .text(examTitle, MARGIN, 22, { width: A4W - MARGIN * 2 - 90 });

      // Class / code / student / roll
      doc.font('Helvetica').fontSize(9).fillColor('#c7d2fe')
        .text(`Class: ${className}   ·   Exam Code: ${examCode}`, MARGIN, 42, { width: A4W - MARGIN * 2 - 90 })
        .text(`Student: ${student.studentName}   ·   Roll No: ${student.rollNo}`, MARGIN, 55, { width: A4W - MARGIN * 2 - 90 });

      // ── QR Code (top-right) ──────────────────────────────────────────────
      const qrText = student.sheetCode || `${examCode}|${student.rollNo}|${student.rollNo}`;
      try {
        // Generate a larger QR (200px) for reliable scanning
        const qrDataUrl = await QRCode.toDataURL(qrText, {
          margin: 1, width: 200, errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#ffffff' },
        });
        const qrBuf = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
        // White backing for QR
        doc.rect(A4W - MARGIN - 78, 4, 74, 74).fill('#ffffff');
        doc.image(qrBuf, A4W - MARGIN - 76, 6, { width: 70, height: 70 });
      } catch (qrErr) {
        console.warn('[OMR] QR generation failed:', qrErr.message);
        // Draw placeholder
        doc.rect(A4W - MARGIN - 78, 4, 74, 74).fill('#ffffff').stroke('#9ca3af');
        doc.fillColor('#6b7280').font('Helvetica').fontSize(7)
          .text('QR Error', A4W - MARGIN - 70, 38, { width: 58, align: 'center' });
      }

      // Sheet code as small text under QR
      doc.fillColor('#818cf8').font('Helvetica').fontSize(5.5)
        .text(qrText, A4W - MARGIN - 78, 76, { width: 74, align: 'center' });

      // ── Instructions ────────────────────────────────────────────────────
      let y = 92;
      doc.rect(MARGIN, y, A4W - MARGIN * 2, 14).fill('#fef3c7');
      doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(7.5)
        .text('INSTRUCTIONS: Use BLACK/BLUE pen only. Fill bubble COMPLETELY. Do NOT use tick or cross. Do NOT fold this sheet.', MARGIN + 4, y + 3, { width: A4W - MARGIN * 2 - 8 });
      y += 20;

      // ── Column headers ──────────────────────────────────────────────────
      const COLS        = 2;
      const GRID_W      = A4W - MARGIN * 2;
      const colW        = GRID_W / COLS;
      const ROW_H       = 20;
      const BUBBLE_R    = 6;
      const Q_LABEL_W   = 28;
      const OPT_SPACING = Math.min(22, (colW - Q_LABEL_W - 12) / OPTS);
      const questPerCol = Math.ceil(totalQuestions / COLS);

      // Header row for each column
      for (let c = 0; c < COLS; c++) {
        const cx = MARGIN + c * colW;
        doc.rect(cx, y, colW - 2, 14).fill('#1e1b4b');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
          .text('Q', cx + 4, y + 3, { width: Q_LABEL_W, align: 'center' });
        for (let o = 0; o < OPTS; o++) {
          const bx = cx + Q_LABEL_W + 8 + o * OPT_SPACING + OPT_SPACING / 2;
          doc.fillColor('#a5b4fc').font('Helvetica-Bold').fontSize(8)
            .text(IDX_TO_LETTER[o], bx - 4, y + 3, { width: 8, align: 'center' });
        }
      }
      y += 16;

      // ── Bubble rows ──────────────────────────────────────────────────────
      for (let q = 0; q < totalQuestions; q++) {
        const col = q < questPerCol ? 0 : 1;
        const row = q < questPerCol ? q : q - questPerCol;
        const qx  = MARGIN + col * colW;
        const qy  = y + row * ROW_H;

        // Alternating zebra stripe
        if (row % 2 === 0) {
          doc.rect(qx, qy - 1, colW - 2, ROW_H - 1).fill('#f8fafc');
        }

        // Question number
        doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8.5)
          .text(`${q + 1}`, qx + 2, qy + 5, { width: Q_LABEL_W, align: 'right' });

        // Bubbles
        for (let o = 0; o < OPTS; o++) {
          const bx = qx + Q_LABEL_W + 8 + o * OPT_SPACING + OPT_SPACING / 2;
          const by = qy + ROW_H / 2;

          // Outer circle
          doc.save()
            .circle(bx, by, BUBBLE_R)
            .lineWidth(0.8)
            .stroke('#334155')
            .restore();

          // Option letter inside
          doc.fillColor('#475569').font('Helvetica').fontSize(6.5)
            .text(IDX_TO_LETTER[o], bx - 3.5, by - 4, { width: 8, align: 'center' });
        }
      }

      // ── Footer ───────────────────────────────────────────────────────────
      const footerY = A4H - 20;
      doc.moveTo(MARGIN, footerY - 2).lineTo(A4W - MARGIN, footerY - 2).lineWidth(0.4).stroke('#cbd5e1');
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7)
        .text(
          `Dhole Sir Coaching Classes  ·  ${examTitle}  ·  Roll: ${student.rollNo}  ·  DO NOT FOLD`,
          MARGIN, footerY, { width: A4W - MARGIN * 2, align: 'center' }
        );
    }

    // Finalise and send
    await new Promise(resolve => { doc.on('end', resolve); doc.end(); });
    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="OMR_Sheets_${examCode}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(pdfBuffer);

  } catch (err) {
    console.error('[OMR] Sheet PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ── POST /api/omr/result-pdf ──────────────────────────────────────────────────
/**
 * Generate result PDF for a single student.
 * Body: { examTitle, examCode, className, studentName, rollNo,
 *         answerKey, detectedAnswers, marksPerQuestion, negativeMarks,
 *         totalQuestions }
 * Returns: application/pdf stream
 */
router.post('/result-pdf', async (req, res) => {
  try {
    const {
      examTitle       = 'OMR Exam',
      examCode        = '',
      className       = '',
      studentName     = 'Student',
      rollNo          = '',
      answerKey       = [],
      detectedAnswers = [],
      marksPerQuestion = 1,
      negativeMarks   = 0,
      totalQuestions  = 30,
    } = req.body;

    // ── Compute scores ────────────────────────────────────────────────────
    let obtained   = 0;
    let correct    = 0;
    let wrong      = 0;
    let unattempted = 0;

    const breakdown = answerKey.map((correctAns, i) => {
      const studentAns = (detectedAnswers[i] || '?').toUpperCase();
      const isCorrect  = studentAns !== '?' && studentAns === correctAns.toUpperCase();
      const isBlank    = studentAns === '?';
      let awarded      = 0;
      if (isCorrect) {
        awarded = marksPerQuestion;
        correct++;
      } else if (!isBlank) {
        awarded = -negativeMarks;
        wrong++;
      } else {
        unattempted++;
      }
      obtained += awarded;
      return { qNo: i + 1, correct: correctAns, student: studentAns, isCorrect, isBlank, awarded };
    });

    const maxMarks   = totalQuestions * marksPerQuestion;
    const percentage = maxMarks > 0 ? Math.max(0, (obtained / maxMarks) * 100).toFixed(1) : '0';

    // ── PDF ───────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Result_${rollNo}_${examCode}.pdf"`);

    const doc    = new PDFKit({ size: 'A4', margin: 36 });
    doc.pipe(res);

    const W = 595 - 72;

    // Header
    doc.rect(0, 0, 595, 80).fill('#1e1b4b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
      .text('OMR RESULT CARD', 36, 14, { width: W, align: 'center' });
    doc.font('Helvetica').fontSize(10)
      .text(`${examTitle}  |  Class: ${className}  |  Exam Code: ${examCode}`, 36, 36, { width: W, align: 'center' });
    doc.text(`Student: ${studentName}  |  Roll No: ${rollNo}  |  Date: ${new Date().toLocaleDateString('en-IN')}`, 36, 52, { width: W, align: 'center' });

    let y = 100;

    // Score summary box
    const boxColors = ['#4ade80', '#f87171', '#fbbf24', '#60a5fa'];
    const summaryItems = [
      { label: 'Obtained', value: obtained.toFixed(1), color: boxColors[0] },
      { label: 'Max Marks', value: maxMarks.toString(), color: boxColors[3] },
      { label: 'Percentage', value: `${percentage}%`, color: parseFloat(percentage) >= 35 ? boxColors[0] : boxColors[1] },
      { label: 'Correct', value: correct.toString(), color: boxColors[0] },
      { label: 'Wrong', value: wrong.toString(), color: boxColors[1] },
      { label: 'Blank', value: unattempted.toString(), color: boxColors[2] },
    ];
    const boxW = W / 3;
    summaryItems.forEach((item, idx) => {
      const bx = 36 + (idx % 3) * boxW;
      const by = y + Math.floor(idx / 3) * 55;
      doc.rect(bx, by, boxW - 8, 48).fill('#f9fafb').stroke('#e5e7eb');
      doc.fillColor(item.color).font('Helvetica-Bold').fontSize(20)
        .text(item.value, bx + 4, by + 6, { width: boxW - 16, align: 'center' });
      doc.fillColor('#6b7280').font('Helvetica').fontSize(9)
        .text(item.label, bx + 4, by + 30, { width: boxW - 16, align: 'center' });
    });

    y += 120;

    // Result bar
    const barW = W * (Math.max(0, obtained) / maxMarks);
    doc.rect(36, y, W, 14).fill('#e5e7eb');
    doc.rect(36, y, barW, 14).fill(parseFloat(percentage) >= 35 ? '#4ade80' : '#f87171');
    doc.fillColor('#374151').font('Helvetica').fontSize(8)
      .text(`${percentage}% — ${parseFloat(percentage) >= 35 ? 'PASS' : 'FAIL'}`, 36, y + 3, { width: W, align: 'center' });
    y += 24;

    // Question-wise table header
    doc.rect(36, y, W, 18).fill('#1e1b4b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
      .text('Q.No', 36, y + 4, { width: 36, align: 'center' })
      .text('Correct Ans', 72, y + 4, { width: 80, align: 'center' })
      .text('Your Ans', 152, y + 4, { width: 80, align: 'center' })
      .text('Status', 232, y + 4, { width: 80, align: 'center' })
      .text('Marks', 312, y + 4, { width: 60, align: 'center' });
    y += 18;

    const cols = 2;
    const rowH = 16;
    const colW = W / cols;

    breakdown.forEach((row, i) => {
      const col = i % cols;
      const r   = Math.floor(i / cols);
      const rx  = 36 + col * colW;
      const ry  = y + r * rowH;

      const bgColor = row.isCorrect ? '#f0fdf4' : row.isBlank ? '#fffbeb' : '#fef2f2';
      doc.rect(rx, ry, colW - 2, rowH - 1).fill(bgColor);

      const statusColor = row.isCorrect ? '#16a34a' : row.isBlank ? '#d97706' : '#dc2626';
      const statusText  = row.isCorrect ? '✓ Correct' : row.isBlank ? '— Blank' : '✗ Wrong';

      doc.fillColor('#374151').font('Helvetica').fontSize(8)
        .text(`${row.qNo}`, rx + 2, ry + 3, { width: 30, align: 'center' })
        .text(row.correct, rx + 32, ry + 3, { width: 70, align: 'center' });
      doc.fillColor(row.isBlank ? '#9ca3af' : row.isCorrect ? '#16a34a' : '#dc2626').font('Helvetica-Bold').fontSize(8)
        .text(row.student, rx + 102, ry + 3, { width: 70, align: 'center' });
      doc.fillColor(statusColor).font('Helvetica').fontSize(8)
        .text(statusText, rx + 172, ry + 3, { width: 70, align: 'center' });
      doc.fillColor(row.awarded >= 0 ? '#16a34a' : '#dc2626').font('Helvetica-Bold').fontSize(8)
        .text(row.awarded >= 0 ? `+${row.awarded}` : `${row.awarded}`, rx + 242, ry + 3, { width: 50, align: 'center' });

      // Check if near page end
      if (ry + rowH > 780) {
        doc.addPage();
        y = 40;
      }
    });

    // Footer
    const lastY = y + Math.ceil(breakdown.length / cols) * rowH + 16;
    doc.moveTo(36, lastY).lineTo(36 + W, lastY).stroke('#d1d5db');
    doc.fillColor('#9ca3af').font('Helvetica').fontSize(8)
      .text('Dhole Sir Coaching Classes — OMR Result Card — Auto-generated', 36, lastY + 4, { width: W, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('[OMR] Result PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ── POST /api/omr/bulk-result-pdf ────────────────────────────────────────────
/**
 * Generate a combined PDF containing result cards for ALL students.
 * Body: { examTitle, examCode, className, answerKey, marksPerQuestion, negativeMarks,
 *         totalQuestions, results: [{ studentName, rollNo, detectedAnswers, obtainedMarks, totalMarks, percentage }] }
 */
router.post('/bulk-result-pdf', async (req, res) => {
  try {
    const {
      examTitle       = 'OMR Exam',
      examCode        = '',
      className       = '',
      answerKey       = [],
      marksPerQuestion = 1,
      negativeMarks   = 0,
      totalQuestions  = 30,
      results         = [],
    } = req.body;

    if (!results.length) return res.status(400).json({ error: 'No results provided' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="AllResults_${examCode}.pdf"`);

    const doc = new PDFKit({ size: 'A4', margin: 36, autoFirstPage: false });
    doc.pipe(res);

    const W = 595 - 72;

    // Sort by percentage desc
    const sorted = [...results].sort((a, b) => b.percentage - a.percentage);

    for (let ri = 0; ri < sorted.length; ri++) {
      const r = sorted[ri];
      doc.addPage();

      // Header
      doc.rect(0, 0, 595, 72).fill('#1e1b4b');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15)
        .text('OMR RESULT CARD', 36, 12, { width: W, align: 'center' });
      doc.font('Helvetica').fontSize(9)
        .text(`${examTitle}  |  Class: ${className}  |  Code: ${examCode}`, 36, 30, { width: W, align: 'center' });
      doc.text(`#${ri + 1} Rank  |  ${r.studentName}  |  Roll: ${r.rollNo}  |  ${new Date().toLocaleDateString('en-IN')}`, 36, 46, { width: W, align: 'center' });

      let y = 84;

      // Score boxes
      const pct        = r.percentage;
      const maxMarks   = totalQuestions * marksPerQuestion;
      const summaryItems = [
        { label: 'Score',    value: `${r.obtainedMarks}/${r.totalMarks}` },
        { label: '%',        value: `${pct.toFixed(1)}%` },
        { label: 'Result',   value: pct >= 35 ? 'PASS' : 'FAIL' },
      ];
      const bxW = W / 3;
      summaryItems.forEach((item, idx) => {
        const bx = 36 + idx * bxW;
        const isPass = item.value === 'PASS'; const isFail = item.value === 'FAIL';
        doc.rect(bx, y, bxW - 6, 40).fill('#f9fafb').stroke('#e5e7eb');
        const col = isPass ? '#16a34a' : isFail ? '#dc2626' : idx === 1 && pct < 35 ? '#dc2626' : '#111827';
        doc.fillColor(col).font('Helvetica-Bold').fontSize(18)
          .text(item.value, bx + 3, y + 4, { width: bxW - 12, align: 'center' });
        doc.fillColor('#6b7280').font('Helvetica').fontSize(8)
          .text(item.label, bx + 3, y + 26, { width: bxW - 12, align: 'center' });
      });
      y += 52;

      // Progress bar
      const barW = W * Math.max(0, Math.min(1, r.obtainedMarks / maxMarks));
      doc.rect(36, y, W, 12).fill('#e5e7eb');
      doc.rect(36, y, barW, 12).fill(pct >= 35 ? '#4ade80' : '#f87171');
      doc.fillColor('#374151').font('Helvetica').fontSize(7)
        .text(`${pct.toFixed(1)}% — ${pct >= 35 ? 'PASS' : 'FAIL'}`, 36, y + 2, { width: W, align: 'center' });
      y += 20;

      // Q-wise table header
      doc.rect(36, y, W, 16).fill('#1e1b4b');
      ['Q.No','Correct Ans','Your Ans','Status','Marks'].forEach((h, hi) => {
        const offsets = [0, 36, 116, 196, 276];
        const widths  = [30, 74, 74, 74, 50];
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
          .text(h, 36 + offsets[hi], y + 4, { width: widths[hi], align: 'center' });
      });
      y += 16;

      const rowH = 14;
      const detectedAnswers = r.detectedAnswers || [];
      let breakdown = [];
      if (answerKey.length) {
        answerKey.forEach((correct, i) => {
          const studentAns = (detectedAnswers[i] || '?').toUpperCase();
          const isCorrect  = studentAns !== '?' && studentAns === correct.toUpperCase();
          const isBlank    = studentAns === '?';
          let awarded = 0;
          if (isCorrect)      awarded = marksPerQuestion;
          else if (!isBlank)  awarded = -negativeMarks;
          breakdown.push({ qNo: i+1, correct, student: studentAns, isCorrect, isBlank, awarded });
        });
      }

      const cols2 = 2;
      const colW2 = W / cols2;
      breakdown.forEach((row, i) => {
        const col = i % cols2;
        const rx  = 36 + col * colW2;
        const ry  = y + Math.floor(i / cols2) * rowH;
        if (ry > 800) return; // page overflow guard
        const bgc = row.isCorrect ? '#f0fdf4' : row.isBlank ? '#fffbeb' : '#fef2f2';
        doc.rect(rx, ry, colW2 - 2, rowH - 1).fill(bgc);
        doc.fillColor('#374151').font('Helvetica').fontSize(7)
          .text(`${row.qNo}`, rx + 2, ry + 3, { width: 26, align: 'center' })
          .text(row.correct, rx + 30, ry + 3, { width: 60, align: 'center' });
        const stCol = row.isCorrect ? '#16a34a' : row.isBlank ? '#9ca3af' : '#dc2626';
        doc.fillColor(stCol).font('Helvetica-Bold').fontSize(7)
          .text(row.student, rx + 92, ry + 3, { width: 60, align: 'center' });
        const stText = row.isCorrect ? '✓ Correct' : row.isBlank ? '— Blank' : '✗ Wrong';
        doc.fillColor(stCol).font('Helvetica').fontSize(7)
          .text(stText, rx + 154, ry + 3, { width: 60, align: 'center' });
        const mCol = row.awarded >= 0 ? '#16a34a' : '#dc2626';
        doc.fillColor(mCol).font('Helvetica-Bold').fontSize(7)
          .text(row.awarded >= 0 ? `+${row.awarded}` : `${row.awarded}`, rx + 216, ry + 3, { width: 44, align: 'center' });
      });

      // Footer
      const fY = Math.min(800, y + Math.ceil(breakdown.length / cols2) * rowH + 12);
      doc.moveTo(36, fY).lineTo(36 + W, fY).stroke('#d1d5db');
      doc.fillColor('#9ca3af').font('Helvetica').fontSize(7)
        .text(`Dhole Sir Coaching Classes — Bulk Result Card ${ri + 1}/${sorted.length}`, 36, fY + 3, { width: W, align: 'center' });
    }

    doc.end();
  } catch (err) {
    console.error('[OMR] Bulk PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

module.exports = router;
