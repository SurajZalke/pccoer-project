/**
 * omrPdfService.ts
 * Generates OMR answer sheets and result PDFs entirely on the frontend.
 * No backend required — works from any device on any network.
 *
 * Uses:  jspdf + jspdf-autotable + qrcode
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SheetStudent {
  studentName: string;
  rollNo: string;
  sheetCode: string;
}

export interface OMRSheetOptions {
  examTitle: string;
  examCode: string;
  className: string;
  totalQuestions: number;
  optionsCount: number;   // 3-5
  students: SheetStudent[];
}

export interface ResultStudent {
  studentName: string;
  rollNo: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  detectedAnswers: string[];
}

export interface OMRResultOptions {
  examTitle: string;
  examCode: string;
  className: string;
  answerKey: string[];
  marksPerQuestion: number;
  negativeMarks: number;
  totalQuestions: number;
  student: ResultStudent;          // single student
}

export interface OMRBulkResultOptions extends Omit<OMRResultOptions, 'student'> {
  results: ResultStudent[];        // all students
}

const OPTION_LTRS = ['A', 'B', 'C', 'D', 'E'];

// ─── QR helper — generates a small PNG data URL ───────────────────────────────
async function qrDataUrl(text: string, size = 80): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1, width: size, errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// ─── Trigger browser download ─────────────────────────────────────────────────
function downloadPDF(doc: jsPDF, filename: string) {
  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  GENERATE OMR ANSWER SHEETS
// ─────────────────────────────────────────────────────────────────────────────
export async function generateOMRSheetsPDF(opts: OMRSheetOptions): Promise<void> {
  const { examTitle, examCode, className, totalQuestions, optionsCount, students } = opts;
  const OPTS = Math.min(Math.max(optionsCount, 3), 5);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW   = doc.internal.pageSize.getWidth();   // 210
  const PH   = doc.internal.pageSize.getHeight();  // 297
  const M    = 10; // margin mm

  for (let si = 0; si < students.length; si++) {
    const s = students[si];
    if (si > 0) doc.addPage();

    // ── Header band ──────────────────────────────────────────────────────────
    doc.setFillColor(30, 27, 75);                 // indigo-900
    doc.rect(0, 0, PW, 28, 'F');

    doc.setTextColor(165, 180, 252);              // indigo-300
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('PCCOER EDUCATION PLATFORM', M, 7);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.text(examTitle, M, 15);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(199, 210, 254);              // indigo-200
    doc.text(`Class: ${className}   ·   Code: ${examCode}`, M, 21);
    doc.text(`Student: ${s.studentName}   ·   Roll No: ${s.rollNo}`, M, 26);

    // ── QR code (top-right) ──────────────────────────────────────────────────
    try {
      const qr = await qrDataUrl(s.sheetCode || `${examCode}|${s.rollNo}`, 200);
      doc.setFillColor(255, 255, 255);
      doc.rect(PW - M - 26, 1, 25, 25, 'F');
      doc.addImage(qr, 'PNG', PW - M - 25, 2, 23, 23);
    } catch { /* skip QR if generation fails */ }

    // ── Instructions ─────────────────────────────────────────────────────────
    const instrY = 32;
    doc.setFillColor(254, 243, 199);              // amber-100
    doc.rect(M, instrY, PW - M * 2, 6, 'F');
    doc.setTextColor(146, 64, 14);               // amber-800
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(
      'INSTRUCTIONS: Use BLACK/BLUE pen. Fill bubble COMPLETELY. Do NOT fold. Do NOT use tick or cross.',
      M + 1, instrY + 4
    );

    // ── Answer bubble grid ───────────────────────────────────────────────────
    const gridTop   = instrY + 9;
    const COLS      = 2;
    const colW      = (PW - M * 2) / COLS;
    const ROW_H     = 6.5;  // mm per row
    const Q_LBL_W   = 8;    // mm for question number
    const OPT_GAP   = Math.min(8, (colW - Q_LBL_W - 4) / OPTS); // mm between bubble centres
    const BUBBLE_R  = 2.2;  // radius mm
    const questPerCol = Math.ceil(totalQuestions / COLS);

    // Column header labels
    for (let c = 0; c < COLS; c++) {
      const cx = M + c * colW;
      doc.setFillColor(30, 27, 75);
      doc.rect(cx, gridTop, colW - 1, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('Q', cx + 1, gridTop + 3.5);
      for (let o = 0; o < OPTS; o++) {
        const bx = cx + Q_LBL_W + 2 + o * OPT_GAP + OPT_GAP / 2;
        doc.text(OPTION_LTRS[o], bx - 1, gridTop + 3.5);
      }
    }

    const rowsStart = gridTop + 6;

    for (let q = 0; q < totalQuestions; q++) {
      const col = q < questPerCol ? 0 : 1;
      const row = q < questPerCol ? q : q - questPerCol;
      const qx  = M + col * colW;
      const qy  = rowsStart + row * ROW_H;

      // Zebra striping
      if (row % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(qx, qy - 0.5, colW - 1, ROW_H - 0.5, 'F');
      }

      // Question number
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${q + 1}`, qx + Q_LBL_W - 1, qy + ROW_H / 2 + 1, { align: 'right' });

      // Bubbles
      for (let o = 0; o < OPTS; o++) {
        const bx = qx + Q_LBL_W + 2 + o * OPT_GAP + OPT_GAP / 2;
        const by = qy + ROW_H / 2;
        doc.setDrawColor(51, 65, 85);
        doc.setLineWidth(0.3);
        doc.circle(bx, by, BUBBLE_R);
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text(OPTION_LTRS[o], bx, by + 1.8, { align: 'center' });
      }
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 8, PW - M, PH - 8);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Dhole Sir Coaching Classes  ·  ${examTitle}  ·  Roll: ${s.rollNo}  ·  DO NOT FOLD`,
      PW / 2, PH - 4.5, { align: 'center' }
    );
    // Sheet code small text
    doc.setFontSize(5);
    doc.setTextColor(148, 163, 184);
    doc.text(s.sheetCode || examCode, PW / 2, PH - 1.5, { align: 'center' });
  }

  downloadPDF(doc, `OMR_Sheets_${examCode}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  GENERATE SINGLE STUDENT RESULT PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateResultPDF(opts: OMRResultOptions): Promise<void> {
  const { examTitle, examCode, className, answerKey, marksPerQuestion, negativeMarks, totalQuestions, student } = opts;
  await _renderResultPages([student], { examTitle, examCode, className, answerKey, marksPerQuestion, negativeMarks, totalQuestions }, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  GENERATE BULK (ALL STUDENTS) RESULT PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateBulkResultPDF(opts: OMRBulkResultOptions): Promise<void> {
  const { results, ...rest } = opts;
  if (!results.length) return;
  await _renderResultPages(results, rest, true);
}

// ─── Internal shared renderer ─────────────────────────────────────────────────
async function _renderResultPages(
  students: ResultStudent[],
  meta: Omit<OMRResultOptions, 'student'>,
  bulk: boolean
): Promise<void> {
  const { examTitle, examCode, className, answerKey, marksPerQuestion, negativeMarks, totalQuestions } = meta;
  const sorted = [...students].sort((a, b) => b.percentage - a.percentage);
  const maxMarks = totalQuestions * marksPerQuestion;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const M  = 10;

  for (let ri = 0; ri < sorted.length; ri++) {
    const r   = sorted[ri];
    const pct = Math.max(0, r.percentage);
    const pass = pct >= 35;

    if (ri > 0) doc.addPage();

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, PW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('OMR RESULT CARD', PW / 2, 9, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(199, 210, 254);
    doc.text(`${examTitle}  ·  Class: ${className}  ·  Code: ${examCode}`, PW / 2, 16, { align: 'center' });
    doc.text(
      `${bulk ? `#${ri + 1} Rank  ·  ` : ''}${r.studentName}  ·  Roll: ${r.rollNo}  ·  ${new Date().toLocaleDateString('en-IN')}`,
      PW / 2, 22, { align: 'center' }
    );

    // ── Score summary boxes ───────────────────────────────────────────────────
    let y = 30;
    const boxW = (PW - M * 2) / 3;
    const summaryItems = [
      { label: 'Obtained', value: `${r.obtainedMarks}/${maxMarks}`, color: [74, 222, 128] as [number,number,number] },
      { label: 'Percentage', value: `${pct.toFixed(1)}%`, color: (pass ? [74, 222, 128] : [248, 113, 113]) as [number,number,number] },
      { label: 'Result', value: pass ? 'PASS' : 'FAIL', color: (pass ? [74, 222, 128] : [248, 113, 113]) as [number,number,number] },
    ];
    summaryItems.forEach((item, idx) => {
      const bx = M + idx * boxW;
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, y, boxW - 2, 18, 1.5, 1.5, 'FD');
      doc.setFillColor(...item.color);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...item.color);
      doc.text(item.value, bx + (boxW - 2) / 2, y + 10, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(item.label, bx + (boxW - 2) / 2, y + 15.5, { align: 'center' });
    });
    y += 22;

    // ── Progress bar ─────────────────────────────────────────────────────────
    const barW = (PW - M * 2) * Math.min(1, Math.max(0, r.obtainedMarks / maxMarks));
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(M, y, PW - M * 2, 5, 2, 2, 'F');
    doc.setFillColor(...(pass ? [74, 222, 128] : [248, 113, 113]) as [number,number,number]);
    if (barW > 0) doc.roundedRect(M, y, barW, 5, 2, 2, 'F');
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(`${pct.toFixed(1)}% — ${pass ? 'PASS' : 'FAIL'}`, PW / 2, y + 3.5, { align: 'center' });
    y += 9;

    // ── Q-wise breakdown table ────────────────────────────────────────────────
    const breakdown = answerKey.map((correct, i) => {
      const studentAns = (r.detectedAnswers?.[i] || '?').toUpperCase();
      const isBlank    = studentAns === '?';
      const isCorrect  = !isBlank && studentAns === correct.toUpperCase();
      const awarded    = isCorrect ? marksPerQuestion : (isBlank ? 0 : -negativeMarks);
      return [
        String(i + 1),
        correct,
        studentAns,
        isCorrect ? '✓ Correct' : isBlank ? '— Blank' : '✗ Wrong',
        awarded >= 0 ? `+${awarded}` : String(awarded),
      ];
    });

    autoTable(doc, {
      head: [['Q.No', 'Correct', 'Student Ans', 'Status', 'Marks']],
      body: breakdown,
      startY: y,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, valign: 'middle' },
      headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 22, halign: 'center', textColor: [22, 163, 74], fontStyle: 'bold' },
        2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 40, halign: 'center' },
        4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const status = data.row.raw as string[];
          if (data.column.index === 3) {
            if (status[3].includes('✓')) data.cell.styles.textColor = [22, 163, 74];
            else if (status[3].includes('✗')) data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = [217, 119, 6];
          }
          if (data.column.index === 4) {
            const v = parseFloat(status[4]);
            data.cell.styles.textColor = v > 0 ? [22, 163, 74] : v < 0 ? [220, 38, 38] : [107, 114, 128];
          }
          if (data.column.index === 2) {
            if (status[3].includes('✓')) data.cell.styles.textColor = [22, 163, 74];
            else if (status[3].includes('✗')) data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = [156, 163, 175];
          }
        }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: M, right: M },
      didDrawPage: (data) => {
        // Footer on each page
        const ph = doc.internal.pageSize.getHeight();
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(M, ph - 8, PW - M, ph - 8);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text('Dhole Sir Coaching Classes — OMR Result Card — Auto-generated', PW / 2, ph - 4, { align: 'center' });
        if (bulk) doc.text(`Card ${ri + 1} / ${sorted.length}`, PW - M, ph - 4, { align: 'right' });
      },
    });
  }

  const filename = bulk
    ? `AllResults_${examCode}.pdf`
    : `Result_${sorted[0]?.rollNo}_${examCode}.pdf`;

  downloadPDF(doc, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  GENERATE RANDOMLY-FILLED SAMPLE OMR SHEET (for testing scanning)
//     Each bubble is randomly filled — useful for verifying the scan pipeline.
// ─────────────────────────────────────────────────────────────────────────────
export interface SampleFilledSheetOptions {
  examTitle: string;
  examCode: string;
  className: string;
  totalQuestions: number;
  optionsCount: number;
  studentName: string;
  rollNo: string;
  sheetCode: string;
}

export async function generateSampleFilledSheetPDF(opts: SampleFilledSheetOptions): Promise<void> {
  const { examTitle, examCode, className, totalQuestions, optionsCount, studentName, rollNo, sheetCode } = opts;
  const OPTS = Math.min(Math.max(optionsCount, 3), 5);

  // Generate random filled answers
  const filledAnswers: number[] = Array.from(
    { length: totalQuestions },
    () => Math.random() < 0.92             // 92% chance of answering (8% blank)
      ? Math.floor(Math.random() * OPTS)   // random option index
      : -1                                 // -1 = blank
  );

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();
  const M   = 10;

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, PW, 28, 'F');

  doc.setTextColor(165, 180, 252);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('PCCOER EDUCATION PLATFORM', M, 7);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(examTitle, M, 15);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text(`Class: ${className}   ·   Code: ${examCode}`, M, 21);
  doc.text(`Student: ${studentName}   ·   Roll No: ${rollNo}   ·   [SAMPLE - RANDOMLY FILLED]`, M, 26);

  // ── QR code ────────────────────────────────────────────────────────────────
  try {
    const qr = await qrDataUrl(sheetCode || `${examCode}|${rollNo}`, 200);
    doc.setFillColor(255, 255, 255);
    doc.rect(PW - M - 26, 1, 25, 25, 'F');
    doc.addImage(qr, 'PNG', PW - M - 25, 2, 23, 23);
  } catch { /* skip */ }

  // ── Sample watermark diagonal ───────────────────────────────────────────────
  doc.saveGraphicsState();
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
  doc.text('SAMPLE', PW / 2, PH / 2, { align: 'center', angle: 45 });
  doc.restoreGraphicsState();

  // ── Instructions ──────────────────────────────────────────────────────────
  const instrY = 32;
  doc.setFillColor(254, 243, 199);
  doc.rect(M, instrY, PW - M * 2, 6, 'F');
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('SAMPLE SHEET — Randomly filled for testing. Scan this to verify the OMR pipeline.', M + 1, instrY + 4);

  // ── Answer bubble grid ─────────────────────────────────────────────────────
  const gridTop    = instrY + 9;
  const COLS       = 2;
  const colW       = (PW - M * 2) / COLS;
  const ROW_H      = 6.5;
  const Q_LBL_W    = 8;
  const OPT_GAP    = Math.min(8, (colW - Q_LBL_W - 4) / OPTS);
  const BUBBLE_R   = 2.2;
  const questPerCol = Math.ceil(totalQuestions / COLS);

  // Column headers
  for (let c = 0; c < COLS; c++) {
    const cx = M + c * colW;
    doc.setFillColor(30, 27, 75);
    doc.rect(cx, gridTop, colW - 1, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Q', cx + 1, gridTop + 3.5);
    for (let o = 0; o < OPTS; o++) {
      const bx = cx + Q_LBL_W + 2 + o * OPT_GAP + OPT_GAP / 2;
      doc.text(OPTION_LTRS[o], bx - 1, gridTop + 3.5);
    }
  }

  const rowsStart = gridTop + 6;

  for (let q = 0; q < totalQuestions; q++) {
    const col     = q < questPerCol ? 0 : 1;
    const row     = q < questPerCol ? q : q - questPerCol;
    const qx      = M + col * colW;
    const qy      = rowsStart + row * ROW_H;
    const filled  = filledAnswers[q]; // -1 = blank, 0-4 = option index

    // Zebra stripe
    if (row % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(qx, qy - 0.5, colW - 1, ROW_H - 0.5, 'F');
    }

    // Question number
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${q + 1}`, qx + Q_LBL_W - 1, qy + ROW_H / 2 + 1, { align: 'right' });

    for (let o = 0; o < OPTS; o++) {
      const bx = qx + Q_LBL_W + 2 + o * OPT_GAP + OPT_GAP / 2;
      const by = qy + ROW_H / 2;

      if (filled === o) {
        // Filled (solid dark) bubble
        doc.setFillColor(15, 23, 42);    // very dark navy
        doc.setDrawColor(15, 23, 42);
        doc.circle(bx, by, BUBBLE_R, 'FD');
        // White letter on filled bubble
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(OPTION_LTRS[o], bx, by + 1.6, { align: 'center' });
      } else {
        // Empty bubble
        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.28);
        doc.circle(bx, by, BUBBLE_R);
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text(OPTION_LTRS[o], bx, by + 1.8, { align: 'center' });
      }
    }
  }

  // ── Answer legend (bottom) ─────────────────────────────────────────────────
  const legendY = PH - 20;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(M, legendY, PW - M, legendY);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text('Randomly selected answers:', M, legendY + 4);

  // Print the answer key legend in small font
  const answers = filledAnswers.map((f, i) => `${i + 1}:${f >= 0 ? OPTION_LTRS[f] : '—'}`);
  const chunks: string[][] = [];
  for (let i = 0; i < answers.length; i += 20) chunks.push(answers.slice(i, i + 20));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(71, 85, 105);
  chunks.forEach((chunk, ci) => {
    doc.text(chunk.join('  '), M, legendY + 8 + ci * 4);
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Dhole Sir Coaching Classes  ·  SAMPLE  ·  Roll: ${rollNo}  ·  ${sheetCode}`,
    PW / 2, PH - 3, { align: 'center' }
  );

  downloadPDF(doc, `SAMPLE_Filled_${rollNo}_${examCode}.pdf`);
}
