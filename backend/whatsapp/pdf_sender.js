/**
 * whatsapp/pdf_sender.js
 * PDFKit-based PDF generation for WhatsApp delivery.
 *
 * FOOTER STRATEGY — proven reliable with PDFKit 0.15:
 *   Draw footer immediately after addPage() using saved/restored graphics state.
 *   This guarantees footer appears on EVERY page without corrupting doc.y cursor.
 *
 *   Pattern:
 *     function addPageWithFooter(doc) {
 *       doc.addPage();
 *       drawFooterNow(doc);   // absolute coords, save/restore
 *     }
 *
 *   Never use the 'pageAdded' event — it fires during addPage() before the page
 *   is fully initialised in some PDFKit versions, and its text calls corrupt doc.y.
 */

'use strict';

const PDFDocument = require('pdfkit');
const { sendBuffer } = require('./media_sender');

// ─── Brand colours ─────────────────────────────────────────────────────────────
const NAVY  = '#1a237e';
const TEAL  = '#00897b';
const GOLD  = '#f9a825';
const GREEN = '#2e7d32';
const RED   = '#c62828';
const LIGHT = '#e8eaf6';
const WHITE = '#ffffff';
const DARK  = '#212121';
const GREY  = '#757575';

const FOOTER_H = 44;
const MARGIN   = 45;

// ─── Draw footer at fixed absolute position ───────────────────────────────────
// doc.save()/restore() only saves PDF graphics state, NOT doc.y (JS variable).
// We must manually snapshot and restore doc.y after drawing footer text.
function drawFooterNow(doc) {
  const W   = doc.page.width;
  const H   = doc.page.height;
  const CW  = W - MARGIN * 2;
  const savedY = doc.y;   // save cursor before footer drawing

  doc.rect(0, H - FOOTER_H, W, FOOTER_H).fill(NAVY);
  doc.rect(0, H - FOOTER_H, W, 3).fill(TEAL);
  doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold')
     .text('PCCOER EDUCATION PLATFORM',
           MARGIN, H - FOOTER_H + 8, { align: 'center', width: CW, lineBreak: false });
  doc.fillColor('#b0bec5').fontSize(7).font('Helvetica')
     .text('Keep learning, keep growing!  |  Created by Mr. Suraj Zalke',
           MARGIN, H - FOOTER_H + 22, { align: 'center', width: CW, lineBreak: false });

  // Restore y cursor so content drawing is not affected
  doc.y = savedY;
}

// ─── Add a new page AND immediately stamp its footer ──────────────────────────
function addPage(doc) {
  doc.addPage();
  drawFooterNow(doc);
  // Reset y to top margin so content starts below the header area
  doc.y = MARGIN;
}

// ─── Page 1: stamp footer then reset y ────────────────────────────────────────
function initFirstPage(doc) {
  drawFooterNow(doc);
  // doc.y is already at MARGIN after autoFirstPage; leave it as-is
}

// ─── Safe content bottom ──────────────────────────────────────────────────────
function bodyBottom(doc) {
  return doc.page.height - FOOTER_H - 10;
}

// ─── Page header band ─────────────────────────────────────────────────────────
function drawPageHeader(doc, subtitle) {
  const W  = doc.page.width;
  const CW = W - MARGIN * 2;
  doc.rect(0, 0, W, 76).fill(NAVY);
  doc.rect(0, 70, W, 6).fill(TEAL);
  doc.fillColor(WHITE).fontSize(17).font('Helvetica-Bold')
     .text('PCCOER EDUCATION PLATFORM', MARGIN, 14,
           { align: 'center', width: CW, lineBreak: false });
  doc.fillColor('#b2dfdb').fontSize(10).font('Helvetica')
     .text(subtitle, MARGIN, 44, { align: 'center', width: CW, lineBreak: false });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL RESULT PDF
// ═══════════════════════════════════════════════════════════════════════════════

async function sendResultPDF(phone, result) {
  const buffer = await generateResultPDF(result);
  const filename = `Result_${result.studentName.replace(/\s+/g, '_')}.pdf`;
  const caption =
    `*Result Report*\n` +
    `Student: *${result.studentName}*\n` +
    `Exam: *${result.examTitle}*\n` +
    `Score: *${result.score}/${result.totalMarks}* (${result.percentage.toFixed(1)}%)\n` +
    `Rank: *${result.rank}* of ${result.totalStudents}`;
  return sendBuffer(phone, buffer, 'application/pdf', filename, caption);
}

function generateResultPDF(result) {
  return new Promise((resolve, reject) => {
    // margin:0 — we manage all positioning manually to prevent PDFKit
    // auto-pagination from triggering when we draw near the page bottom
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Stamp footer on page 1 (already created by autoFirstPage)
    initFirstPage(doc);

    const W  = doc.page.width;
    const CW = W - MARGIN * 2;

    drawPageHeader(doc, 'Student Result Report');

    let y = 86;
    doc.rect(MARGIN, y, CW, 3).fill(TEAL); y += 8;

    const info = [
      ['Student', result.studentName],
      ['Exam',    result.examTitle],
      ['Date',    result.date || new Date().toLocaleDateString('en-IN')],
      ['Batch',   result.batch || '--'],
    ];
    info.forEach(([label, val], li) => {
      doc.rect(MARGIN, y, CW, 18).fill(li % 2 === 0 ? LIGHT : WHITE);
      doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold')
         .text(label + ':', MARGIN + 8, y + 4, { width: 70, lineBreak: false });
      doc.fillColor(DARK).fontSize(9).font('Helvetica')
         .text(String(val), MARGIN + 82, y + 4, { width: CW - 90, lineBreak: false });
      y += 18;
    });
    y += 8;

    // ── Score hero ────────────────────────────────────────────────────────────
    const pct   = result.percentage;
    const grade = pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B'
                : pct >= 45 ? 'C'  : pct >= 35 ? 'D' : 'F';
    const rankLabel = result.rank === 1 ? '1st' : result.rank === 2 ? '2nd'
                    : result.rank === 3 ? '3rd' : `${result.rank}th`;

    doc.rect(MARGIN, y, CW, 68).fill(NAVY);
    doc.rect(MARGIN, y, 6, 68).fill(TEAL);
    doc.fillColor(WHITE).fontSize(28).font('Helvetica-Bold')
       .text(`${result.score} / ${result.totalMarks}`, MARGIN + 14, y + 8,
             { align: 'center', width: CW - 14, lineBreak: false });
    doc.fillColor('#b2dfdb').fontSize(10).font('Helvetica')
       .text(`${pct.toFixed(1)}%   |   Grade: ${grade}   |   Rank: ${rankLabel} of ${result.totalStudents}`,
             MARGIN + 14, y + 44, { align: 'center', width: CW - 14, lineBreak: false });
    y += 76;

    // ── Percentile bar ────────────────────────────────────────────────────────
    if (result.totalStudents > 1) {
      const percentile = result.rank > 0
        ? Math.round(((result.totalStudents - result.rank) / (result.totalStudents - 1)) * 100)
        : 100;
      const barColor = percentile >= 75 ? TEAL : percentile >= 50 ? GOLD : RED;
      doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold')
         .text(`Percentile: ${percentile}th`, MARGIN, y, { lineBreak: false });
      doc.fillColor(GREY).font('Helvetica')
         .text(`  (scored higher than ${percentile}% of students)`, MARGIN + 90, y, { lineBreak: false });
      y += 14;
      doc.rect(MARGIN, y, CW, 8).fill('#e0e0e0');
      doc.rect(MARGIN, y, Math.max(4, Math.round((percentile / 100) * CW)), 8).fill(barColor);
      y += 20;
    }

    // ── Subjects (optional) ───────────────────────────────────────────────────
    if (result.subjects && result.subjects.length > 0) {
      if (y + 22 + result.subjects.length * 18 > bodyBottom(doc)) {
        addPage(doc); y = MARGIN;
      }
      doc.rect(MARGIN, y, CW, 20).fill(TEAL);
      doc.fillColor(WHITE).fontSize(10).font('Helvetica-Bold')
         .text('Subject-wise Marks', MARGIN + 8, y + 5, { lineBreak: false });
      y += 20;
      result.subjects.forEach((sub, si) => {
        const subPct = sub.total > 0 ? ((sub.obtained / sub.total) * 100).toFixed(0) : 0;
        doc.rect(MARGIN, y, CW, 18).fill(si % 2 === 0 ? LIGHT : WHITE);
        doc.fillColor(DARK).fontSize(9).font('Helvetica')
           .text(sub.name, MARGIN + 8, y + 4, { width: 220, lineBreak: false });
        doc.fillColor(NAVY).font('Helvetica-Bold')
           .text(`${sub.obtained}/${sub.total}  (${subPct}%)`,
                 MARGIN + 230, y + 4, { width: CW - 238, align: 'right', lineBreak: false });
        y += 18;
      });
      y += 8;
    }


    // ── Answer sheet ──────────────────────────────────────────────────────────
    const sheet = result.answerSheet;
    if (Array.isArray(sheet) && sheet.length > 0) {
      if (y + 50 > bodyBottom(doc)) { addPage(doc); y = MARGIN; }

      doc.rect(MARGIN, y, CW, 20).fill(NAVY);
      doc.rect(MARGIN, y, 4, 20).fill(TEAL);
      doc.fillColor(WHITE).fontSize(10).font('Helvetica-Bold')
         .text('Answer Sheet', MARGIN + 12, y + 5, { lineBreak: false });
      y += 20;

      const COL = [22, 198, 132, 137];
      const CX  = COL.reduce((a, w, i) => { a.push(i === 0 ? MARGIN : a[i-1] + COL[i-1]); return a; }, []);
      const HEAD_H = 16;

      const drawAnsHeader = (ry) => {
        doc.rect(MARGIN, ry, CW, HEAD_H).fill('#c5cae9');
        doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold')
           .text('#',           CX[0] + 3, ry + 4, { width: COL[0] - 4, lineBreak: false })
           .text('Question',    CX[1] + 3, ry + 4, { width: COL[1] - 4, lineBreak: false })
           .text('Your Answer', CX[2] + 3, ry + 4, { width: COL[2] - 4, lineBreak: false })
           .text('Correct Ans', CX[3] + 3, ry + 4, { width: COL[3] - 4, lineBreak: false });
        return ry + HEAD_H;
      };

      y = drawAnsHeader(y);

      sheet.forEach((row, i) => {
        const rowH = Math.max(
          doc.heightOfString(row.questionText || '', { width: COL[1] - 8, fontSize: 8 }),
          doc.heightOfString(row.selectedText || '', { width: COL[2] - 8, fontSize: 8 }),
          doc.heightOfString(row.correctText  || '', { width: COL[3] - 8, fontSize: 8 }),
          14
        ) + 6;

        if (y + rowH > bodyBottom(doc)) {
          addPage(doc);
          y = MARGIN;
          y = drawAnsHeader(y);
        }

        doc.rect(MARGIN, y, CW, rowH).fill(i % 2 === 0 ? '#fafafa' : WHITE);
        doc.rect(MARGIN, y, 4, rowH).fill(row.isCorrect ? GREEN : RED);

        const qTxt = (row.questionText || '').length > 180
          ? (row.questionText || '').slice(0, 180) + '...' : (row.questionText || '');
        const icon = row.selectedText === 'Not Answered' ? '--' : row.isCorrect ? '[OK]' : '[X]';

        doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold')
           .text(`${row.qNum}`, CX[0] + 5, y + 4, { width: COL[0] - 6, lineBreak: false });
        doc.fillColor(DARK).fontSize(8).font('Helvetica')
           .text(qTxt, CX[1] + 3, y + 4, { width: COL[1] - 8, lineBreak: false });
        doc.fillColor(row.isCorrect ? GREEN : RED).fontSize(8).font('Helvetica-Bold')
           .text(`${icon} ${row.selectedText || '--'}`, CX[2] + 3, y + 4,
                 { width: COL[2] - 8, lineBreak: false });
        doc.fillColor(GREEN).fontSize(8).font('Helvetica')
           .text(row.correctText || '--', CX[3] + 3, y + 4,
                 { width: COL[3] - 8, lineBreak: false });
        doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + CW, y + rowH)
           .strokeColor('#e0e0e0').lineWidth(0.3).stroke();
        y += rowH;
      });
    }

    doc.end();
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// GROUP / CLASS LEADERBOARD PDF
// ═══════════════════════════════════════════════════════════════════════════════

async function sendGroupResultsPDF(groupId, data) {
  const buffer = await generateGroupResultsPDF(data);
  const safeTitle = data.examTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  const filename  = `Results_${safeTitle}.pdf`;
  const caption   =
    `*Results Report - ${data.examTitle}*\n` +
    `Date: ${data.date || new Date().toLocaleDateString('en-IN')}\n` +
    `PCCOER Education Platform`;
  const { sendBufferToGroup } = require('./group_sender');
  return sendBufferToGroup(groupId, buffer, 'application/pdf', filename, caption);
}

function generateGroupResultsPDF(data) {
  return new Promise((resolve, reject) => {
    // margin:0 — we manage all positioning manually to prevent PDFKit
    // auto-pagination from triggering when we draw near the page bottom
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    initFirstPage(doc);

    const W  = doc.page.width;
    const CW = W - MARGIN * 2;

    const sorted = [...data.results].sort((a, b) => b.percentage - a.percentage);
    const total  = sorted.length;
    const examDate = data.date || new Date().toLocaleDateString('en-IN');

    sorted.forEach((r, i) => {
      r._rank = i + 1;
      r._percentile = total > 1
        ? Math.round(((total - (i + 1)) / (total - 1)) * 100)
        : 100;
    });

    const avg     = total ? (sorted.reduce((s, r) => s + r.percentage, 0) / total).toFixed(1) : '0.0';
    const passing = sorted.filter(r => r.percentage >= 35).length;
    const highest = sorted[0]?.percentage?.toFixed(1) ?? '0.0';
    const lowest  = sorted[total - 1]?.percentage?.toFixed(1) ?? '0.0';

    drawPageHeader(doc, 'Class Results - Ranked Leaderboard');

    let y = 86;
    doc.rect(MARGIN, y, CW, 3).fill(TEAL); y += 8;
    doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold')
       .text(data.examTitle, MARGIN, y, { align: 'center', width: CW, lineBreak: false });
    y += 16;
    doc.fillColor(GREY).fontSize(9).font('Helvetica')
       .text(`Date: ${examDate}   |   Total Students: ${total}`,
             MARGIN, y, { align: 'center', width: CW, lineBreak: false });
    y += 16;

    // Stats bar
    doc.rect(MARGIN, y, CW, 26).fill(NAVY);
    doc.rect(MARGIN, y, CW, 3).fill(TEAL);
    const stats = [`Avg: ${avg}%`, `Pass: ${passing}/${total}`, `Highest: ${highest}%`, `Lowest: ${lowest}%`];
    const sw    = CW / stats.length;
    stats.forEach((txt, si) => {
      doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
         .text(txt, MARGIN + si * sw, y + 9,
               { width: sw, align: 'center', lineBreak: false });
    });
    y += 32;

    // Table columns: Rank(36) Name(172) Score(58) Percentile(72) Grade(52) Result(75)
    const COL_W = [36, 172, 58, 72, 52, 75];
    const COL_X = COL_W.reduce((acc, w, i) => {
      acc.push(i === 0 ? MARGIN : acc[i - 1] + COL_W[i - 1]);
      return acc;
    }, []);
    const ROW_H = 20;
    const HDR_H = 22;

    const drawTableHeader = (ry) => {
      doc.rect(MARGIN, ry, CW, HDR_H).fill(NAVY);
      ['Rank', 'Student Name', 'Score', 'Percentile', 'Grade', 'Result'].forEach((h, hi) => {
        doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold')
           .text(h, COL_X[hi] + 3, ry + 6,
                 { width: COL_W[hi] - 4, align: hi > 1 ? 'center' : 'left', lineBreak: false });
      });
      return ry + HDR_H;
    };

    y = drawTableHeader(y);

    sorted.forEach((r, i) => {
      if (y + ROW_H > bodyBottom(doc)) {
        addPage(doc);
        y = MARGIN;
        y = drawTableHeader(y);
      }

      const pass   = r.percentage >= 35;
      const grade  = r.percentage >= 90 ? 'A+' : r.percentage >= 75 ? 'A'
                   : r.percentage >= 60 ? 'B'  : r.percentage >= 45 ? 'C'
                   : r.percentage >= 35 ? 'D'  : 'F';
      const gColor = pass ? GREEN : RED;
      const accent = r._rank <= 3 ? GOLD : (pass ? TEAL : RED);
      const rowBg  = r._rank === 1 ? '#fffde7' : r._rank === 2 ? '#f5f5f5'
                   : r._rank === 3 ? '#fff8e1'  : i % 2 === 0 ? '#fafafa' : WHITE;

      doc.rect(MARGIN, y, CW, ROW_H).fill(rowBg);
      doc.rect(MARGIN, y, 4, ROW_H).fill(accent);

      const rankStr   = r._rank === 1 ? '1st' : r._rank === 2 ? '2nd'
                      : r._rank === 3 ? '3rd' : `${r._rank}`;
      const rankColor = r._rank <= 3 ? '#bf6f00' : GREY;

      const cells = [
        { t: rankStr,                       c: rankColor, b: r._rank <= 3, a: 'center' },
        { t: r.studentName || '--',         c: DARK,      b: r._rank <= 3, a: 'left'   },
        { t: `${r.score}/${r.totalMarks}`,  c: NAVY,      b: false,        a: 'center' },
        { t: `${r._percentile}th`,          c: gColor,    b: true,         a: 'center' },
        { t: grade,                         c: gColor,    b: true,         a: 'center' },
        { t: pass ? 'PASS' : 'FAIL',        c: gColor,    b: true,         a: 'center' },
      ];

      cells.forEach((cell, ci) => {
        doc.fillColor(cell.c).fontSize(8)
           .font(cell.b ? 'Helvetica-Bold' : 'Helvetica')
           .text(cell.t, COL_X[ci] + 4, y + 6,
                 { width: COL_W[ci] - 6, align: cell.a, ellipsis: true, lineBreak: false });
      });

      doc.moveTo(MARGIN + 4, y + ROW_H).lineTo(MARGIN + CW, y + ROW_H)
         .strokeColor('#e0e0e0').lineWidth(0.3).stroke();
      y += ROW_H;
    });

    doc.end();
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE PDF
// ═══════════════════════════════════════════════════════════════════════════════

async function sendAttendancePDF(phone, data) {
  const buffer = await generateAttendancePDF(data);
  const filename = `Attendance_${data.studentName.replace(/\s+/g, '_')}_${data.month}_${data.year}.pdf`;
  const present  = data.records.filter(r => r.status === 'present').length;
  const total    = data.records.length;
  const caption  =
    `*Attendance Report - ${data.month} ${data.year}*\n` +
    `Student: *${data.studentName}*\n` +
    `Present: *${present}/${total}* days`;
  return sendBuffer(phone, buffer, 'application/pdf', filename, caption);
}

function generateAttendancePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    initFirstPage(doc);

    const W  = doc.page.width;
    const CW = W - MARGIN * 2;

    drawPageHeader(doc, `Attendance Report - ${data.month} ${data.year}`);

    let y = 86;
    const present = data.records.filter(r => r.status === 'present').length;
    const absent  = data.records.filter(r => r.status === 'absent').length;

    doc.rect(MARGIN, y, CW, 3).fill(TEAL); y += 8;
    [['Student', data.studentName], ['Batch', data.batch || '--']].forEach(([l, v], li) => {
      doc.rect(MARGIN, y, CW, 18).fill(li % 2 === 0 ? LIGHT : WHITE);
      doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold')
         .text(l + ':', MARGIN + 8, y + 4, { width: 70, lineBreak: false });
      doc.fillColor(DARK).fontSize(9).font('Helvetica')
         .text(v, MARGIN + 82, y + 4, { width: CW - 90, lineBreak: false });
      y += 18;
    });

    y += 8;
    doc.rect(MARGIN, y, CW, 26).fill(NAVY);
    doc.fillColor(WHITE).fontSize(10).font('Helvetica-Bold')
       .text(`Present: ${present}   |   Absent: ${absent}   |   Total: ${data.records.length}`,
             MARGIN, y + 8, { align: 'center', width: CW, lineBreak: false });
    y += 34;

    doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold')
       .text('Daily Attendance', MARGIN, y, { lineBreak: false }); y += 14;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CW, y).strokeColor(TEAL).lineWidth(1.5).stroke(); y += 6;

    const COLS   = 4;
    const CELL_W = Math.floor(CW / COLS);
    data.records.forEach((r, i) => {
      const col   = i % COLS;
      const rowN  = Math.floor(i / COLS);
      const cx    = MARGIN + col * CELL_W;
      const cy    = y + rowN * 20;
      const color = r.status === 'present' ? GREEN : RED;
      const mark  = r.status === 'present' ? '[P]' : '[A]';
      doc.fillColor(GREY).fontSize(8).font('Helvetica')
         .text(r.date, cx, cy, { width: CELL_W * 0.55, lineBreak: false });
      doc.fillColor(color).fontSize(8).font('Helvetica-Bold')
         .text(mark, cx + CELL_W * 0.58, cy, { width: CELL_W * 0.4, lineBreak: false });
    });

    doc.end();
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  sendResultPDF,
  sendAttendancePDF,
  generateResultPDF,
  generateAttendancePDF,
  sendGroupResultsPDF,
  generateGroupResultsPDF,
};
