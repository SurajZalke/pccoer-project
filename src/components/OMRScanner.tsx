/**
 * OMRScanner.tsx — OMR Exam Management
 *
 * Key behaviours:
 *  1. Print OMR sheets as proper PDF (server-side, with QR + bubbles)
 *  2. Upload one PDF or multiple images → auto-detect student from QR code
 *     (no manual student selection needed)
 *  3. Batch process — one upload can contain many students' sheets
 *  4. Manual answer correction grid
 *  5. Save scored results → Realtime DB
 *  6. Download individual or all-students result PDF
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDatabase, ref as dbRef, get, set, push, remove } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';
import { useToast } from '@/components/ui/use-toast';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Badge }    from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Printer, Upload, CheckCircle2, XCircle,
  Plus, Trash2, Eye, Download, RefreshCw, Scan, ClipboardList,
  ChevronRight, BookOpen, Users, AlertCircle, BarChart2, QrCode,
  Image as ImageIcon, FilePlus, MessageCircle,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';
import jsQR from 'jsqr';
import { generateOMRSheetsPDF, generateResultPDF, generateBulkResultPDF, generateSampleFilledSheetPDF } from '@/services/omrPdfService';
import { sendOMRResult, sendOMRGroupSummary, listGroups, isBackendConfigured } from '@/services/whatsappWebService';
import PdfDownloadOverlay from './PdfDownloadOverlay';

// ─── Config ───────────────────────────────────────────────────────────────────
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
  || `http://${window.location.hostname}:3001`;
const OPTION_LTRS = ['A', 'B', 'C', 'D', 'E'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const genExamCode = () =>
  `OMR-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// ─── Local types ─────────────────────────────────────────────────────────────
interface OMRExam {
  id: string; title: string; examCode: string; classId: string;
  answerKey: string[]; totalQuestions: number; optionsCount: number;
  marksPerQuestion: number; negativeMarks: number; createdAt: string;
  sheetsGenerated: boolean; status: 'draft' | 'active' | 'completed';
}
interface OMRSheet {
  id: string; examId: string; examCode: string; studentId: string;
  studentName: string; rollNo: string; classId: string; sheetCode: string; createdAt: string;
}
interface QResult {
  qNo: number; correct: string; student: string;
  isCorrect: boolean; isBlank: boolean; marks: number;
}
interface OMRResult {
  id: string; examId: string; examCode: string; examTitle: string;
  studentId: string; studentName: string; rollNo: string; classId: string;
  detectedAnswers: string[]; obtainedMarks: number; totalMarks: number;
  percentage: number; questionResults: QResult[]; scannedAt: string;
}
interface PlayerRec { rollNo: string; name: string; classId: string; mobile?: string; parentPhone?: string; }

/** One page from an uploaded scan — may have a detected sheet code and answers */
interface ScannedPage {
  pageIndex: number;
  imageDataUrl: string;       // canvas-rendered preview
  sheetCode: string | null;   // from QR decode
  rollNo: string | null;      // parsed from sheetCode
  studentName: string | null; // looked up from sheets
  detectedAnswers: string[];
  editedAnswers: string[];
  status: 'pending' | 'scanning' | 'ready' | 'saved' | 'error';
  error?: string;
}

// ─── Realtime DB helpers ─────────────────────────────────────────────────────
const db = getDatabase(app);
async function rtGet<T>(path: string): Promise<T | null> {
  const snap = await get(dbRef(db, path));
  return snap.exists() ? (snap.val() as T) : null;
}
const rtSet    = (path: string, val: any) => set(dbRef(db, path), val);
async function rtPush(path: string, val: any): Promise<string> {
  const r = await push(dbRef(db, path), val);
  return r.key!;
}
const rtRemove = (path: string) => remove(dbRef(db, path));

// ─── Score calculator ────────────────────────────────────────────────────────
function calcScore(answers: string[], exam: Pick<OMRExam, 'answerKey' | 'totalQuestions' | 'marksPerQuestion' | 'negativeMarks'>) {
  let obtained = 0;
  const qResults: QResult[] = exam.answerKey.map((correct, i) => {
    const student   = (answers[i] || '?').toUpperCase();
    const isBlank   = student === '?';
    const isCorrect = !isBlank && student === correct.toUpperCase();
    const marks     = isCorrect ? exam.marksPerQuestion : (isBlank ? 0 : -exam.negativeMarks);
    obtained += marks;
    return { qNo: i + 1, correct, student, isCorrect, isBlank, marks };
  });
  const totalMarks = exam.totalQuestions * exam.marksPerQuestion;
  return { obtained: Math.max(0, obtained), totalMarks, percentage: totalMarks > 0 ? Math.max(0, (obtained / totalMarks) * 100) : 0, qResults };
}

// ─── QR decode from canvas ImageData ────────────────────────────────────────
function decodeQRFromCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const result = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
  return result?.data || null;
}

// ─── PDF rendering — loads pdfjs v3 from CDN (avoids all bundler/worker issues) ──
// CDN script sets window.pdfjsLib. Returns one canvas per page.
async function renderAllPDFPages(file: File, scale = 2.0): Promise<HTMLCanvasElement[]> {
  const PDFJS_VERSION = '3.11.174';
  const PDFJS_CDN     = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

  // Load script if not already present
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      // Check if script tag already exists (avoids duplicate loads)
      if (document.querySelector(`script[src="${PDFJS_CDN}/pdf.min.js"]`)) {
        resolve(); return;
      }
      const s    = document.createElement('script');
      s.src      = `${PDFJS_CDN}/pdf.min.js`;
      s.onload   = () => resolve();
      s.onerror  = () => reject(new Error('Failed to load PDF.js from CDN. Check your internet connection.'));
      document.head.appendChild(s);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF.js did not load correctly.');

  // Set worker only once
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  }

  const rawBuf = await file.arrayBuffer();
  const pdf    = await pdfjsLib.getDocument({ data: new Uint8Array(rawBuf) }).promise;
  const canvases: HTMLCanvasElement[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page   = await pdf.getPage(p);
    const vp     = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx    = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    canvases.push(canvas);
  }

  return canvases;
}

// ─── OMR Bubble Detector ─────────────────────────────────────────────────────
// Uses exact same grid layout as generateOMRSheetsPDF in omrPdfService.ts.
// All measurements in mm, converted to canvas pixels by scale factor.
//
// Sheet layout (A4 = 210×297mm, margin=10mm):
//   Header band:  0–28mm
//   Instructions: 32–38mm
//   Grid header:  41–46mm  (gridTop = 41)
//   Rows start:   47mm     (rowsStart = gridTop+6)
//   ROW_H:        6.5mm
//   COLS:         2
//   colW:         (210-20)/2 = 95mm
//   Q_LBL_W:      8mm
//   OPT_GAP:      min(8, (colW-Q_LBL_W-4)/opts)
//   BUBBLE_R:     2.2mm
function detectBubblesFromCanvas(
  canvas: HTMLCanvasElement,
  totalQuestions: number,
  optionsCount: number
): string[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return Array(totalQuestions).fill('?');

  const PW_MM = 210;
  const PH_MM = 297;
  // Scale factor: canvas pixels per mm
  const scaleX = canvas.width  / PW_MM;
  const scaleY = canvas.height / PH_MM;

  const M         = 10;
  const COLS      = 2;
  const OPTS      = Math.min(Math.max(optionsCount, 3), 5);
  const colW      = (PW_MM - M * 2) / COLS;       // 95mm
  const ROW_H     = 6.5;
  const Q_LBL_W   = 8;
  const OPT_GAP   = Math.min(8, (colW - Q_LBL_W - 4) / OPTS);
  const BUBBLE_R  = 2.2;
  const gridTop   = 41;  // mm
  const rowsStart = gridTop + 6;
  const questPerCol = Math.ceil(totalQuestions / COLS);

  // Sample radius for darkness check (pixels) — slightly smaller than bubble
  const sampleR = Math.max(2, Math.floor(BUBBLE_R * scaleX * 0.7));

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Average grayscale in a circle around (cx, cy) in canvas pixels
  function avgDark(cxPx: number, cyPx: number, rPx: number): number {
    let sum = 0; let count = 0;
    const x0 = Math.max(0, Math.floor(cxPx - rPx));
    const x1 = Math.min(canvas.width  - 1, Math.ceil(cxPx + rPx));
    const y0 = Math.max(0, Math.floor(cyPx - rPx));
    const y1 = Math.min(canvas.height - 1, Math.ceil(cyPx + rPx));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cxPx; const dy = y - cyPx;
        if (dx * dx + dy * dy > rPx * rPx) continue;
        const i   = (y * canvas.width + x) * 4;
        // Luminance (lower = darker)
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += lum; count++;
      }
    }
    return count > 0 ? sum / count : 255;
  }

  const answers: string[] = [];

  for (let q = 0; q < totalQuestions; q++) {
    const col = q < questPerCol ? 0 : 1;
    const row = q < questPerCol ? q : q - questPerCol;

    // MM coordinates of bubble centres for each option
    const qxMM = M + col * colW;
    const qyMM = rowsStart + row * ROW_H + ROW_H / 2;  // vertical centre of row

    let darkestOpt  = -1;
    let darkestLum  = 255;  // lower = darker = more filled

    for (let o = 0; o < OPTS; o++) {
      // Centre of this bubble in mm
      const bxMM = qxMM + Q_LBL_W + 2 + o * OPT_GAP + OPT_GAP / 2;
      const byMM = qyMM;

      // Convert to canvas pixels
      const bxPx = bxMM * scaleX;
      const byPx = byMM * scaleY;

      const lum = avgDark(bxPx, byPx, sampleR);
      if (lum < darkestLum) {
        darkestLum = lum;
        darkestOpt = o;
      }
    }

    // Accept as filled if clearly darker than empty bubble (~220 lum)
    // Digital PDF: filled ≈ 15, empty ≈ 220+
    // Printed+scanned: filled ≈ 60-150, empty ≈ 190+
    // Generous threshold of 180 handles both cases
    const FILL_THRESHOLD = 180;
    if (darkestOpt >= 0 && darkestLum < FILL_THRESHOLD) {
      answers.push(OPTION_LTRS[darkestOpt]);
    } else {
      answers.push('?');
    }
  }

  return answers;
}
const AnswerGrid: React.FC<{
  total: number; opts: number; value: string[];
  onChange?: (v: string[]) => void; readOnly?: boolean; compare?: string[];
}> = ({ total, opts, value, onChange, readOnly, compare }) => {
  const letters = OPTION_LTRS.slice(0, opts);
  const cols = Math.min(4, Math.ceil(total / 8));
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: total }, (_, i) => {
        const det = compare?.[i]; const ans = value[i] || '';
        const ok  = det && ans && det !== '?' && det.toUpperCase() === ans.toUpperCase();
        const bad = det && ans && det !== '?' && det.toUpperCase() !== ans.toUpperCase();
        return (
          <div key={i} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
            ${ok ? 'bg-green-900/50' : bad ? 'bg-red-900/50' : 'bg-gray-800/60'}`}>
            <span className="text-gray-500 w-5 text-right shrink-0">{i + 1}.</span>
            {readOnly ? (
              <span className={`font-bold w-5 text-center ${ok ? 'text-green-300' : bad ? 'text-red-300' : 'text-white'}`}>
                {ans || '–'}
              </span>
            ) : (
              <Select value={ans} onValueChange={v => { const n = [...value]; n[i] = v; onChange?.(n); }}>
                <SelectTrigger className="h-5 w-14 text-[11px] bg-gray-700/80 border-gray-600 text-white px-1 py-0">
                  <SelectValue placeholder="?" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-white min-w-[3rem]">
                  {letters.map(l => <SelectItem key={l} value={l} className="text-xs py-1">{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {det && det !== '?' && !readOnly && (
              <span className={`font-bold text-[10px] ${ok ? 'text-green-400' : 'text-red-400'}`}>{det}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Stat: React.FC<{ label: string; val: string | number; color?: string; icon?: React.ReactNode }> = ({ label, val, color = 'text-white', icon }) => (
  <motion.div 
    whileHover={{ scale: 1.03, y: -1 }}
    className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-3 flex flex-col gap-0.5 backdrop-blur-sm shadow-md"
  >
    <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">{icon}{label}</div>
    <div className={`text-2xl font-black ${color}`}>{val}</div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const OMRScanner: React.FC = () => {
  const { toast } = useToast();

  // ── data ──────────────────────────────────────────────────────────────────
  const [exams,    setExams]    = useState<OMRExam[]>([]);
  const [sheets,   setSheets]   = useState<OMRSheet[]>([]);
  const [results,  setResults]  = useState<OMRResult[]>([]);
  const [players,  setPlayers]  = useState<Record<string, PlayerRec[]>>({});
  const [classIds, setClassIds] = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);

  const [sel,     setSel]     = useState<OMRExam | null>(null);
  const [section, setSection] = useState<'sheets' | 'scan' | 'results'>('sheets');

  // ── create exam ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({
    title: '', classId: '', totalQuestions: 30, optionsCount: 4,
    marksPerQuestion: 1, negativeMarks: 0, answerKey: [] as string[],
  });

  // ── sheets ────────────────────────────────────────────────────────────────
  const [genSheets, setGenSheets] = useState(false);
  const [printPDF,  setPrintPDF]  = useState(false);

  // ── scan state — batch pages ──────────────────────────────────────────────
  const [scannedPages,   setScannedPages]   = useState<ScannedPage[]>([]);
  const [batchScanning,  setBatchScanning]  = useState(false);
  const [batchProgress,  setBatchProgress]  = useState(0);
  const [savingBatch,    setSavingBatch]    = useState(false);
  const [activePage,     setActivePage]     = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── result view / download ────────────────────────────────────────────────
  const [viewRes,  setViewRes]  = useState<OMRResult | null>(null);
  const [dlPDF,    setDlPDF]    = useState<string | null>(null);
  const [dlBulk,   setDlBulk]  = useState(false);
  const [sendingWA, setSendingWA] = useState<string | null>(null);
  const [sendingWABulk, setSendingWABulk] = useState(false);
  const [whatsappGroups, setWhatsappGroups] = useState<any[]>([]);
  const [showSendDialog, setShowSendDialog] = useState<'individual' | 'bulk' | 'group' | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // ─── load players ─────────────────────────────────────────────────────────
  const loadPlayers = useCallback(async () => {
    const raw = await rtGet<Record<string, Record<string, any>>>('players');
    if (!raw) { setPlayers({}); setClassIds([]); return; }
    const grouped: Record<string, PlayerRec[]> = {};
    for (const cid of Object.keys(raw)) {
      grouped[cid] = Object.entries(raw[cid]).map(([roll, v]) => ({ rollNo: roll, name: v.name || '', classId: cid, mobile: v.mobile || '', parentPhone: v.parentPhone || '' }));
    }
    setPlayers(grouped);
    setClassIds(Object.keys(grouped).sort());
  }, []);

  // ─── load exams ───────────────────────────────────────────────────────────
  const loadExams = useCallback(async () => {
    setLoading(true);
    const raw = await rtGet<Record<string, any>>('omrExams');
    if (raw) {
      const list = Object.entries(raw).map(([id, v]) => ({ ...(v as object), id } as OMRExam));
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setExams(list);
    } else setExams([]);
    setLoading(false);
  }, []);

  // ─── load sheets+results for selected exam ────────────────────────────────
  const loadDetail = useCallback(async (examId: string) => {
    const [rawS, rawR] = await Promise.all([
      rtGet<Record<string, any>>(`omrSheets/${examId}`),
      rtGet<Record<string, any>>(`omrResults/${examId}`),
    ]);
    setSheets(rawS ? Object.entries(rawS).map(([id, v]) => ({ ...(v as object), id } as OMRSheet)) : []);
    setResults(rawR ? Object.entries(rawR).map(([id, v]) => ({ ...(v as object), id } as OMRResult)) : []);
  }, []);

  useEffect(() => { loadExams(); loadPlayers(); }, [loadExams, loadPlayers]);

  const selectExam = (exam: OMRExam) => {
    setSel(exam); setScannedPages([]); setBatchProgress(0);
    setSection('sheets'); loadDetail(exam.id);
  };

  // ─── Create exam ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    if (!form.classId)      { toast({ title: 'Select a class', variant: 'destructive' }); return; }
    if (form.answerKey.filter(Boolean).length < form.totalQuestions) {
      toast({ title: `Fill all ${form.totalQuestions} answers`, variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const code = genExamCode();
      const exam: Omit<OMRExam, 'id'> = {
        title: form.title.trim(), examCode: code, classId: form.classId,
        answerKey: form.answerKey.slice(0, form.totalQuestions),
        totalQuestions: form.totalQuestions, optionsCount: form.optionsCount,
        marksPerQuestion: form.marksPerQuestion, negativeMarks: form.negativeMarks,
        createdAt: new Date().toISOString(), sheetsGenerated: false, status: 'draft',
      };
      const id = await rtPush('omrExams', exam);
      toast({ title: 'Exam created!', description: `Code: ${code}` });
      setCreateOpen(false);
      setForm({ title: '', classId: '', totalQuestions: 30, optionsCount: 4, marksPerQuestion: 1, negativeMarks: 0, answerKey: [] });
      await loadExams();
      selectExam({ ...exam, id });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this OMR exam and all its data?')) return;
    await Promise.all([rtRemove(`omrExams/${id}`), rtRemove(`omrSheets/${id}`), rtRemove(`omrResults/${id}`)]);
    toast({ title: 'Exam deleted' });
    if (sel?.id === id) { setSel(null); setSheets([]); setResults([]); }
    loadExams();
  };

  // ─── Generate sheets ──────────────────────────────────────────────────────
  const handleGenSheets = async () => {
    if (!sel) return;
    const classPlayers = players[sel.classId] || [];
    if (!classPlayers.length) {
      toast({ title: 'No students', description: 'Add students in Player Management first.', variant: 'destructive' }); return;
    }
    setGenSheets(true);
    try {
      const batch: Record<string, any> = {};
      for (const p of classPlayers) {
        const sheetCode = `${sel.examCode}|${p.rollNo}|${p.rollNo}`;
        batch[p.rollNo] = {
          examId: sel.id, examCode: sel.examCode,
          studentId: p.rollNo, studentName: p.name,
          rollNo: p.rollNo, classId: sel.classId,
          sheetCode, createdAt: new Date().toISOString(),
        };
      }
      await rtSet(`omrSheets/${sel.id}`, batch);
      await rtSet(`omrExams/${sel.id}/sheetsGenerated`, true);
      await rtSet(`omrExams/${sel.id}/status`, 'active');
      setSel(prev => prev ? { ...prev, sheetsGenerated: true, status: 'active' } : prev);
      await loadDetail(sel.id);
      toast({ title: `${classPlayers.length} sheets generated!` });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    setGenSheets(false);
  };

  // ─── Print sheets PDF — 100% frontend, no backend ────────────────────────
  const handlePrintPDF = async () => {
    if (!sel || !sheets.length) return;
    setPrintPDF(true);
    try {
      await generateOMRSheetsPDF({
        examTitle: sel.title,
        examCode: sel.examCode,
        className: sel.classId,
        totalQuestions: sel.totalQuestions,
        optionsCount: sel.optionsCount,
        students: sheets.map(s => ({ studentName: s.studentName, rollNo: s.rollNo, sheetCode: s.sheetCode })),
      });
      toast({ title: 'OMR Sheets downloaded!', description: `${sheets.length} pages` });
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }); }
    setPrintPDF(false);
  };

  // ─── Process uploaded files → pages → QR decode + bubble scan ────────────
  const processFiles = async (files: FileList | File[]) => {
    if (!sel) { toast({ title: 'Select an exam first', variant: 'destructive' }); return; }
    setBatchScanning(true);
    setBatchProgress(0);
    setScannedPages([]);

    try {
      const fileArr = Array.from(files);
      const pages: ScannedPage[] = [];

      // Step 1: expand all files to canvas pages
      for (const file of fileArr) {
        const isPDF = file.type === 'application/pdf' ||
                      file.name?.toLowerCase().endsWith('.pdf');
        if (isPDF) {
          try {
            const canvases = await renderAllPDFPages(file, 2.0);
            for (const canvas of canvases) {
              // Detect bubbles while we still have the raw canvas (before JPEG compression)
              const detected = detectBubblesFromCanvas(canvas, sel.totalQuestions, sel.optionsCount);
              pages.push({
                pageIndex: pages.length,
                imageDataUrl: canvas.toDataURL('image/jpeg', 0.9),
                sheetCode: null, rollNo: null, studentName: null,
                detectedAnswers: detected,
                editedAnswers: detected.map(a => a === '?' ? '?' : a),
                status: 'pending',
              });
            }
          } catch (pdfErr: any) {
            console.error('[OMR] PDF render error:', pdfErr);
            toast({ title: 'PDF read error', description: String(pdfErr?.message || pdfErr), variant: 'destructive' });
          }
        } else {
          // Image file — draw to canvas first so we can detect bubbles
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload  = e => resolve(e.target!.result as string);
            fr.onerror = () => reject(new Error('Failed to read image file'));
            fr.readAsDataURL(file);
          });

          // Draw to canvas for bubble detection
          const imgEl = new Image();
          const imgCanvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
            imgEl.onload = () => {
              const c = document.createElement('canvas');
              c.width  = imgEl.naturalWidth;
              c.height = imgEl.naturalHeight;
              c.getContext('2d')!.drawImage(imgEl, 0, 0);
              resolve(c);
            };
            imgEl.onerror = reject;
            imgEl.src = dataUrl;
          });

          const detected = detectBubblesFromCanvas(imgCanvas, sel.totalQuestions, sel.optionsCount);
          pages.push({
            pageIndex: pages.length, imageDataUrl: dataUrl,
            sheetCode: null, rollNo: null, studentName: null,
            detectedAnswers: detected,
            editedAnswers: detected.map(a => a === '?' ? '?' : a),
            status: 'pending',
          });
        }
      }

      if (pages.length === 0) {
        toast({ title: 'No pages extracted', description: 'Check that the file is a valid PDF or image.', variant: 'destructive' });
        setBatchScanning(false);
        return;
      }

      // Step 2: for each page, decode QR + attempt bubble scan
      const sheetsMap: Record<string, OMRSheet> = {};
      for (const s of sheets) sheetsMap[s.rollNo] = s;

      for (let i = 0; i < pages.length; i++) {
        const pg: ScannedPage = { ...pages[i], status: 'scanning' };
        pages[i]  = pg;
        setScannedPages([...pages]);
        setBatchProgress(Math.round(((i + 0.5) / pages.length) * 100));

        try {
          // ── Decode QR ──────────────────────────────────────────────────────
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload  = () => resolve();
            img.onerror = () => reject(new Error('Image load failed'));
            img.src     = pg.imageDataUrl;
          });
          const qrCanvas = document.createElement('canvas');
          qrCanvas.width  = img.naturalWidth;
          qrCanvas.height = img.naturalHeight;
          qrCanvas.getContext('2d')!.drawImage(img, 0, 0);
          const qrText = decodeQRFromCanvas(qrCanvas);

          if (qrText) {
            pg.sheetCode  = qrText;
            const parts   = qrText.split('|');
            const rollNo  = parts[1] || parts[0];
            pg.rollNo     = rollNo;
            const sheet   = sheetsMap[rollNo];
            pg.studentName = sheet?.studentName || `Roll: ${rollNo}`;
          }

          // ── Bubble answers already detected at canvas stage ────────────────
          // Use pre-detected answers; skip backend call (works offline too)
          if (pg.detectedAnswers.length > 0) {
            pg.editedAnswers = [...pg.detectedAnswers];
          } else {
            pg.detectedAnswers = [];
            pg.editedAnswers   = Array(sel.totalQuestions).fill('?');
          }

          pg.status = 'ready';
        } catch (e: any) {
          console.error('[OMR] Page process error:', e);
          pg.status         = 'ready';
          pg.detectedAnswers = [];
          pg.editedAnswers   = Array(sel.totalQuestions).fill('?');
          pg.error           = String(e?.message || e);
        }

        pages[i] = pg;
        setScannedPages([...pages]);
        setBatchProgress(Math.round(((i + 1) / pages.length) * 100));
      }

      setActivePage(0);
      toast({
        title:       `${pages.length} page(s) processed`,
        description: `${pages.filter(p => p.sheetCode).length} students identified via QR`,
      });
    } catch (fatal: any) {
      console.error('[OMR] Fatal processFiles error:', fatal);
      toast({ title: 'Processing failed', description: String(fatal?.message || fatal), variant: 'destructive' });
    } finally {
      setBatchScanning(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    await processFiles(e.dataTransfer.files);
  };

  const updatePageAnswers = (pageIdx: number, answers: string[]) => {
    setScannedPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, editedAnswers: answers } : p));
  };

  // ─── Save all ready pages as results ─────────────────────────────────────
  const handleSaveBatch = async () => {
    if (!sel) return;
    const readyPages = scannedPages.filter(p => p.status === 'ready');
    if (!readyPages.length) { toast({ title: 'No pages ready to save', variant: 'destructive' }); return; }

    // Check all have a rollNo identified
    const missing = readyPages.filter(p => !p.rollNo);
    if (missing.length) {
      toast({ title: `${missing.length} page(s) have no student identified. Assign manually or re-scan.`, variant: 'destructive' });
      return;
    }

    setSavingBatch(true);
    let saved = 0;
    for (const pg of readyPages) {
      try {
        const sheet = sheets.find(s => s.rollNo === pg.rollNo);
        const { obtained, totalMarks, percentage, qResults } = calcScore(pg.editedAnswers, sel);
        const result: Omit<OMRResult, 'id'> = {
          examId: sel.id, examCode: sel.examCode, examTitle: sel.title,
          studentId: pg.rollNo!, studentName: pg.studentName || pg.rollNo!,
          rollNo: pg.rollNo!, classId: sel.classId,
          detectedAnswers: pg.editedAnswers,
          obtainedMarks: obtained, totalMarks, percentage,
          questionResults: qResults, scannedAt: new Date().toISOString(),
        };
        await rtSet(`omrResults/${sel.id}/${pg.rollNo}`, result);
        // Mark page saved
        setScannedPages(prev => prev.map((p, i) => p.pageIndex === pg.pageIndex ? { ...p, status: 'saved' } : p));
        saved++;
      } catch (e: any) {
        setScannedPages(prev => prev.map(p => p.pageIndex === pg.pageIndex ? { ...p, status: 'error', error: e.message } : p));
      }
    }
    await loadDetail(sel.id);
    toast({ title: `${saved} result(s) saved!` });
    if (saved === readyPages.length) setSection('results');
    setSavingBatch(false);
  };

  // ─── Manual student assignment for a page ────────────────────────────────
  const assignStudentToPage = (pageIdx: number, rollNo: string) => {
    const sheet = sheets.find(s => s.rollNo === rollNo);
    setScannedPages(prev => prev.map((p, i) =>
      i === pageIdx ? { ...p, rollNo, studentName: sheet?.studentName || rollNo } : p
    ));
  };

  // ─── Download result PDFs — 100% frontend ────────────────────────────────
  const downloadResultPDF = async (result: OMRResult) => {
    if (!sel) return;
    setDlPDF(result.id);
    try {
      await generateResultPDF({
        examTitle: sel.title, examCode: sel.examCode, className: sel.classId,
        answerKey: sel.answerKey, marksPerQuestion: sel.marksPerQuestion,
        negativeMarks: sel.negativeMarks, totalQuestions: sel.totalQuestions,
        student: {
          studentName: result.studentName, rollNo: result.rollNo,
          obtainedMarks: result.obtainedMarks, totalMarks: result.totalMarks,
          percentage: result.percentage, detectedAnswers: result.detectedAnswers,
        },
      });
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }); }
    setDlPDF(null);
  };

  const downloadBulkPDF = async () => {
    if (!sel || !results.length) return;
    setDlBulk(true);
    try {
      await generateBulkResultPDF({
        examTitle: sel.title, examCode: sel.examCode, className: sel.classId,
        answerKey: sel.answerKey, marksPerQuestion: sel.marksPerQuestion,
        negativeMarks: sel.negativeMarks, totalQuestions: sel.totalQuestions,
        results: results.map(r => ({
          studentName: r.studentName, rollNo: r.rollNo,
          obtainedMarks: r.obtainedMarks, totalMarks: r.totalMarks,
          percentage: r.percentage, detectedAnswers: r.detectedAnswers,
        })),
      });
      toast({ title: 'Bulk PDF downloaded', description: `${results.length} result cards` });
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }); }
    setDlBulk(false);
  };

  const loadGroups = async () => {
    try {
      const res = await listGroups();
      setWhatsappGroups(res.groups || []);
    } catch (e: any) {
      console.error('Failed to load groups', e);
    }
  };

  const handleSendIndividualResult = async (result: OMRResult) => {
    if (!sel) return;
    if (!isBackendConfigured()) { toast({ title: 'WhatsApp not configured', variant: 'destructive' }); return; }
    const classStudents = players[sel.classId] || [];
    const student = classStudents.find(s => s.rollNo === result.rollNo);
    if (!student?.mobile && !student?.parentPhone) {
      toast({ title: 'No phone number for this student', variant: 'destructive' });
      return;
    }
    setSendingWA(result.id);
    try {
      const sortedResults = [...results].sort((a, b) => b.percentage - a.percentage);
      const rank = sortedResults.findIndex(r => r.id === result.id) + 1;
      await sendOMRResult({
        studentPhone: student?.mobile,
        parentPhone: student?.parentPhone,
        studentName: result.studentName,
        examTitle: sel.title,
        score: result.obtainedMarks,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        rank,
        totalStudents: results.length,
        batch: sel.classId,
        answerKey: sel.answerKey,
        detectedAnswers: result.detectedAnswers,
      });
      toast({ title: `✅ Result sent to ${result.studentName}` });
    } catch (e: any) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSendingWA(null);
    }
  };

  const handleSendBulkResults = async () => {
    if (!sel || !results.length) return;
    if (!isBackendConfigured()) { toast({ title: 'WhatsApp not configured', variant: 'destructive' }); return; }
    const classStudents = players[sel.classId] || [];
    const sortedResults = [...results].sort((a, b) => b.percentage - a.percentage);
    setSendingWABulk(true);
    let sent = 0;
    let failed = 0;
    try {
      for (let i = 0; i < sortedResults.length; i++) {
        const result = sortedResults[i];
        const student = classStudents.find(s => s.rollNo === result.rollNo);
        if (student?.mobile || student?.parentPhone) {
          try {
            await sendOMRResult({
              studentPhone: student?.mobile,
              parentPhone: student?.parentPhone,
              studentName: result.studentName,
              examTitle: sel.title,
              score: result.obtainedMarks,
              totalMarks: result.totalMarks,
              percentage: result.percentage,
              rank: i + 1,
              totalStudents: results.length,
              batch: sel.classId,
              answerKey: sel.answerKey,
              detectedAnswers: result.detectedAnswers,
            });
            sent++;
          } catch {
            failed++;
          }
          // Add small delay to respect rate limits
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      toast({ title: `Bulk send complete`, description: `${sent} sent, ${failed} failed` });
    } catch (e: any) {
      toast({ title: 'Bulk send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSendingWABulk(false);
      setShowSendDialog(null);
    }
  };

  const handleSendGroupSummary = async () => {
    if (!sel || !results.length || !selectedGroup) return;
    if (!isBackendConfigured()) { toast({ title: 'WhatsApp not configured', variant: 'destructive' }); return; }
    setSendingWABulk(true);
    try {
      await sendOMRGroupSummary({
        groupId: selectedGroup,
        examTitle: sel.title,
        date: new Date().toLocaleDateString('en-IN'),
        results: results.map(r => ({
          studentName: r.studentName,
          score: r.obtainedMarks,
          totalMarks: r.totalMarks,
          percentage: r.percentage
        }))
      });
      toast({ title: '✅ Group summary + PDF sent' });
    } catch (e: any) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSendingWABulk(false);
      setShowSendDialog(null);
    }
  };

  const [genSample, setGenSample] = useState(false);

  const handleGenSample = async () => {
    if (!sel) return;
    // Pick the first sheet (or a placeholder) for the sample
    const s = sheets[0] || { studentName: 'Sample Student', rollNo: '000001', sheetCode: `${sel.examCode}|000001|000001` };
    setGenSample(true);
    try {
      await generateSampleFilledSheetPDF({
        examTitle: sel.title, examCode: sel.examCode, className: sel.classId,
        totalQuestions: sel.totalQuestions, optionsCount: sel.optionsCount,
        studentName: s.studentName, rollNo: s.rollNo, sheetCode: s.sheetCode,
      });
      toast({ title: 'Sample PDF downloaded!', description: 'Print it, scan it back to test the pipeline.' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    setGenSample(false);
  };

  const classStudents = sel ? (players[sel.classId] || []) : [];
  const activePg = scannedPages[activePage] || null;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="text-white p-2 md:p-4 relative overflow-hidden">
      {/* PDF generation overlay — shown whenever any PDF is being generated */}
      <PdfDownloadOverlay
        visible={printPDF || !!dlPDF || dlBulk}
        label={printPDF ? 'Generating OMR sheets…' : dlBulk ? 'Generating bulk results…' : 'Generating result PDF…'}
      />
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1.5s'}} />
      </div>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 relative z-10"
      >
        <div>
          <h2 className="text-2xl font-black flex items-center gap-3 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            <span className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/30">
              <Scan className="w-6 h-6 text-white" />
            </span>
            OMR Scanner & Result System
          </h2>
          <p className="text-gray-400 text-xs mt-1 ml-12">Create exam → Print sheets → Upload scans → Auto-detect student via QR → Score → Download PDFs</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 flex items-center gap-1.5 text-sm shrink-0 border border-indigo-400/20">
          <Plus className="w-4 h-4" /> New OMR Exam
        </Button>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Exam list ── */}
        <div className="w-full lg:w-72 shrink-0 space-y-2">
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-[11px] text-indigo-400 uppercase tracking-widest font-bold">Exams ({exams.length})</p>
            {exams.length > 0 && <span className="text-[10px] text-gray-500">{exams.filter(e=>e.status==='active').length} active</span>}
          </div>
          {loading ? <div className="text-gray-500 text-sm text-center py-8 animate-pulse">Loading…</div>
          : exams.length === 0 ? (
            <div className="border border-dashed border-gray-700 rounded-xl p-6 text-center text-gray-500 text-sm">
              No exams yet. Click "New OMR Exam".
            </div>
          ) : exams.map(exam => (
            <motion.div key={exam.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className={`group cursor-pointer rounded-xl border p-3 transition-all backdrop-blur-sm
                ${sel?.id === exam.id 
                  ? 'bg-gradient-to-br from-indigo-900/60 to-purple-900/40 border-indigo-400/60 shadow-lg shadow-indigo-500/20' 
                  : 'bg-white/5 border-white/10 hover:border-indigo-500/40 hover:bg-white/10'}`}
              onClick={() => selectExam(exam)}>
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate text-white">{exam.title}</div>
                  <div className="text-[11px] text-gray-400">{exam.classId}</div>
                  <div className="font-mono text-[11px] text-indigo-400">{exam.examCode}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] border-gray-600 text-gray-400 py-0 px-1">
                      {exam.totalQuestions}Q · {exam.marksPerQuestion}M{exam.negativeMarks > 0 ? ` · -${exam.negativeMarks}` : ''}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] py-0 px-1 ${exam.status === 'completed' ? 'border-green-600 text-green-400' : exam.status === 'active' ? 'border-blue-600 text-blue-400' : 'border-gray-600 text-gray-400'}`}>
                      {exam.status}
                    </Badge>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); handleDelete(exam.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-1 transition-opacity shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {sel?.id === exam.id && <ChevronRight className="w-3 h-3 text-indigo-400 ml-auto mt-1" />}
            </motion.div>
          ))}
        </div>

        {/* ── Detail panel ── */}
        <div className="flex-1 min-w-0">
          {!sel ? (
            <div className="flex flex-col items-center justify-center h-64 bg-gradient-to-br from-indigo-950/30 to-purple-950/30 border border-dashed border-indigo-700/30 rounded-2xl text-gray-500">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 4 }}>
                <Scan className="w-12 h-12 mb-3 text-indigo-700/50" />
              </motion.div>
              <p className="text-sm font-medium text-gray-400">Select an exam to get started</p>
              <p className="text-xs text-gray-600 mt-1">or create a new OMR exam above</p>
            </div>
          ) : (
            <Tabs value={section} onValueChange={(v: any) => setSection(v)}>
              <TabsList className="bg-white/5 border border-white/10 rounded-xl mb-4 h-auto p-1 gap-1 backdrop-blur-sm">
                {[
                  { value: 'sheets', label: 'Sheets', icon: <Printer className="w-3.5 h-3.5" /> },
                  { value: 'scan',   label: 'Scan',   icon: <Scan className="w-3.5 h-3.5" /> },
                  { value: 'results',label: 'Results',icon: <BarChart2 className="w-3.5 h-3.5" /> },
                ].map(t => (
                  <TabsTrigger key={t.value} value={t.value}
                    className="flex items-center gap-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg px-3 py-1.5 text-gray-400 transition-all">
                    {t.icon}{t.label}
                    {t.value === 'scan' && scannedPages.length > 0 && (
                      <Badge className="ml-1 bg-indigo-500 text-white text-[10px] px-1 py-0">{scannedPages.length}</Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ══ SHEETS ══ */}
              <TabsContent value="sheets">
                <div className="bg-gradient-to-br from-gray-900/60 to-indigo-950/30 border border-indigo-700/20 rounded-2xl p-4 space-y-4 backdrop-blur-sm shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base">{sel.title}</h3>
                      <p className="text-gray-400 text-xs">
                        Class: <span className="text-indigo-300">{sel.classId}</span> · Code: <span className="font-mono text-indigo-300">{sel.examCode}</span> · {sel.totalQuestions}Q · {classStudents.length} students
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={handleGenSheets} disabled={genSheets || !classStudents.length}
                        className="bg-emerald-600 hover:bg-emerald-500 text-xs flex items-center gap-1.5">
                        {genSheets ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                        {genSheets ? 'Generating…' : sel.sheetsGenerated ? 'Regenerate Sheets' : `Generate ${classStudents.length} Sheets`}
                      </Button>
                      {sheets.length > 0 && (
                        <Button size="sm" onClick={handlePrintPDF} disabled={printPDF}
                          className="bg-indigo-600 hover:bg-indigo-500 text-xs flex items-center gap-1.5">
                          {printPDF ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                          {printPDF ? 'Generating PDF…' : `Download ${sheets.length} Sheets PDF`}
                        </Button>
                      )}
                    </div>
                  </div>

                  {!classStudents.length && (
                    <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700/40 rounded-xl p-3 text-yellow-300 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      No students in class "{sel.classId}". Add them in Player Management first.
                    </div>
                  )}

                  {sheets.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-gray-700/40 max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-700 hover:bg-transparent">
                            <TableHead className="text-gray-400 text-xs">Student</TableHead>
                            <TableHead className="text-gray-400 text-xs">Roll No</TableHead>
                            <TableHead className="text-gray-400 text-xs">Sheet Code (QR data)</TableHead>
                            <TableHead className="text-gray-400 text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sheets.map(s => {
                            const done = results.some(r => r.rollNo === s.rollNo);
                            return (
                              <TableRow key={s.id} className="border-gray-700/40 hover:bg-gray-700/20">
                                <TableCell className="text-sm text-white">{s.studentName}</TableCell>
                                <TableCell className="text-xs font-mono text-indigo-300">{s.rollNo}</TableCell>
                                <TableCell className="text-[10px] font-mono text-gray-500 max-w-[160px] truncate">{s.sheetCode}</TableCell>
                                <TableCell>
                                  {done
                                    ? <Badge className="bg-green-900/40 text-green-400 border-green-800 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-0.5" />Done</Badge>
                                    : <Badge className="bg-gray-700/40 text-gray-400 border-gray-600 text-[10px]">Pending</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ══ SCAN ══ */}
              <TabsContent value="scan">
                <div className="bg-gradient-to-br from-gray-900/60 to-indigo-950/30 border border-indigo-700/20 rounded-2xl p-4 space-y-4 backdrop-blur-sm shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <Scan className="w-4 h-4 text-indigo-400" /> Upload &amp; Scan OMR Sheets
                    </h3>
                    {scannedPages.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => { setScannedPages([]); setBatchProgress(0); }}
                        className="border-gray-600 text-gray-300 text-xs">Clear All</Button>
                    )}
                  </div>

                  {/* How it works info */}
                  <div className="bg-indigo-950/60 border border-indigo-700/40 rounded-xl p-3 text-indigo-300 text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> How it works:</p>
                    <p>1. Upload one PDF (multiple pages) or multiple images of filled OMR sheets.</p>
                    <p>2. The QR code on each sheet is auto-scanned to identify the student.</p>
                    <p>3. Bubbles are analysed to detect answers. Review &amp; correct if needed.</p>
                    <p>4. Click "Save All Results" to store scores for all students at once.</p>
                  </div>

                  {/* Generate sample filled PDF for testing */}
                  <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-700/30 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-emerald-300 text-xs font-semibold">Need a test sheet?</p>
                      <p className="text-gray-400 text-[11px] mt-0.5">Download a randomly-filled OMR sheet with all bubbles pre-filled. Use it to test the scan pipeline.</p>
                    </div>
                    <Button size="sm" onClick={handleGenSample} disabled={genSample || !sel}
                      className="bg-emerald-700 hover:bg-emerald-600 text-xs flex items-center gap-1.5 shrink-0">
                      {genSample ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      {genSample ? 'Generating…' : 'Sample Filled PDF'}
                    </Button>
                  </div>

                  {/* Drop zone */}
                  {!batchScanning && scannedPages.length === 0 && (
                    <div
                      onDrop={handleFileDrop} onDragOver={e => e.preventDefault()}
                      onClick={() => fileRef.current?.click()}
                      className="cursor-pointer border-2 border-dashed border-gray-600 hover:border-indigo-500
                        rounded-xl p-8 flex flex-col items-center gap-3 text-gray-400 hover:text-gray-300
                        transition-colors min-h-[160px] justify-center">
                      <Upload className="w-10 h-10 opacity-50" />
                      <p className="text-sm font-medium">Drop scanned OMR sheets here or click to browse</p>
                      <p className="text-xs">PDF (multi-page) or JPG/PNG images — multiple files allowed — max 20 MB each</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" className="hidden" multiple
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    onChange={e => { if (e.target.files?.length) processFiles(e.target.files); }} />

                  {/* Scanning progress */}
                  {batchScanning && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-300">
                        <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />Processing pages…</span>
                        <span>{batchProgress}%</span>
                      </div>
                      <Progress value={batchProgress} className="h-2" />
                    </div>
                  )}

                  {/* Results of scan — page navigator + detail */}
                  {scannedPages.length > 0 && !batchScanning && (
                    <div className="space-y-3">
                      {/* Page thumbnails / navigator */}
                      <div className="flex gap-2 flex-wrap">
                        {scannedPages.map((pg, idx) => (
                          <button key={idx} onClick={() => setActivePage(idx)}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all w-16 h-20
                              ${activePage === idx ? 'border-indigo-500' : 'border-gray-700/50 hover:border-gray-500'}`}>
                            <img src={pg.imageDataUrl} alt={`page ${idx + 1}`} className="w-full h-full object-cover" />
                            <div className={`absolute inset-0 flex items-end justify-center pb-1
                              ${pg.status === 'saved' ? 'bg-green-900/40' : pg.status === 'error' ? 'bg-red-900/40' : pg.sheetCode ? 'bg-indigo-900/30' : 'bg-gray-900/40'}`}>
                              <span className="text-[10px] font-bold text-white bg-black/60 px-1 rounded">
                                {pg.status === 'saved' ? '✓' : pg.status === 'error' ? '✗' : pg.sheetCode ? `${pg.rollNo?.slice(-4)}` : `P${idx + 1}`}
                              </span>
                            </div>
                          </button>
                        ))}
                        <button onClick={() => fileRef.current?.click()}
                          className="w-16 h-20 rounded-lg border-2 border-dashed border-gray-700 hover:border-indigo-500 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-indigo-400 transition-colors">
                          <FilePlus className="w-5 h-5" />
                          <span className="text-[10px]">Add more</span>
                        </button>
                      </div>

                      {/* Active page detail */}
                      {activePg && (
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Left: image */}
                          <div className="space-y-2">
                            <img src={activePg.imageDataUrl} alt="scan preview"
                              className="w-full rounded-xl border border-gray-700/50 object-contain max-h-64" />

                            {/* QR / student detection result */}
                            {activePg.sheetCode ? (
                              <div className="flex items-center gap-2 bg-green-900/40 border border-green-700/40 rounded-xl p-2.5 text-green-300 text-xs">
                                <QrCode className="w-4 h-4 shrink-0" />
                                <div>
                                  <div className="font-semibold">QR detected: {activePg.studentName}</div>
                                  <div className="text-green-400/70 font-mono">Roll: {activePg.rollNo}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-xl p-2.5 text-yellow-300 text-xs space-y-2">
                                <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> QR not detected — assign student manually:</div>
                                <Select value={activePg.rollNo || ''} onValueChange={v => assignStudentToPage(activePage, v)}>
                                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white text-xs h-7">
                                    <SelectValue placeholder="Select student…" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-600 text-white max-h-48">
                                    {classStudents.map(s => (
                                      <SelectItem key={s.rollNo} value={s.rollNo} className="text-xs">{s.name} — {s.rollNo}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          {/* Right: answer grid */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-gray-300">
                                Detected Answers
                                {(() => {
                                  const cnt = activePg.detectedAnswers.filter(a => a !== '?').length;
                                  return cnt > 0
                                    ? <span className="ml-1.5 text-xs font-normal"><span className="text-green-400">{cnt}</span><span className="text-gray-500">/{sel.totalQuestions} auto-detected</span></span>
                                    : <span className="ml-1.5 text-yellow-400 text-xs font-normal">— no bubbles detected, fill manually</span>;
                                })()}
                              </span>
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="outline"
                                  onClick={() => {
                                    // Re-run detection from the preview image with a lower threshold for scanned sheets
                                    const img = new Image();
                                    img.onload = () => {
                                      const c = document.createElement('canvas');
                                      c.width = img.naturalWidth; c.height = img.naturalHeight;
                                      c.getContext('2d')!.drawImage(img, 0, 0);
                                      const detected = detectBubblesFromCanvas(c, sel.totalQuestions, sel.optionsCount);
                                      setScannedPages(prev => prev.map((p, i) =>
                                        i === activePage ? { ...p, detectedAnswers: detected, editedAnswers: [...detected] } : p
                                      ));
                                    };
                                    img.src = activePg.imageDataUrl;
                                  }}
                                  className="border-indigo-600 text-indigo-400 text-[11px] h-6 px-2">
                                  <RefreshCw className="w-3 h-3 mr-1" />Re-detect
                                </Button>
                                <Button size="sm" variant="outline"
                                  onClick={() => updatePageAnswers(activePage, Array(sel.totalQuestions).fill('?'))}
                                  className="border-gray-600 text-gray-400 text-[11px] h-6 px-2">Reset</Button>
                              </div>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-700/40 rounded-xl p-2 max-h-52 overflow-y-auto">
                              <AnswerGrid total={sel.totalQuestions} opts={sel.optionsCount}
                                value={activePg.editedAnswers}
                                onChange={v => updatePageAnswers(activePage, v)}
                                compare={activePg.detectedAnswers.length ? activePg.detectedAnswers : undefined} />
                            </div>

                            {/* Score preview */}
                            {activePg.editedAnswers.filter(a => a && a !== '?').length > 0 && (() => {
                              const { obtained, totalMarks, percentage } = calcScore(activePg.editedAnswers, sel);
                              return (
                                <div className="grid grid-cols-3 gap-1.5">
                                  <Stat label="Score" val={`${obtained}/${totalMarks}`} color="text-white" icon={<BookOpen className="w-3 h-3"/>} />
                                  <Stat label="%" val={`${percentage.toFixed(1)}%`} color={percentage >= 35 ? 'text-green-400' : 'text-red-400'} />
                                  <Stat label={percentage >= 35 ? 'PASS' : 'FAIL'} val={activePg.editedAnswers.filter(a => a && a !== '?').length} color={percentage >= 35 ? 'text-green-400' : 'text-red-400'} />
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Batch summary */}
                      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-gray-700/40">
                        <div className="flex gap-3 text-xs text-gray-400">
                          <span className="text-green-400">{scannedPages.filter(p => p.sheetCode).length} identified</span>
                          <span className="text-yellow-400">{scannedPages.filter(p => !p.sheetCode).length} no QR</span>
                          <span className="text-blue-400">{scannedPages.filter(p => p.status === 'saved').length} saved</span>
                        </div>
                        <Button onClick={handleSaveBatch} disabled={savingBatch || scannedPages.filter(p => p.status === 'ready' && p.rollNo).length === 0}
                          className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 flex items-center gap-2 text-sm">
                          {savingBatch ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</>
                            : <><CheckCircle2 className="w-4 h-4" />Save All Results ({scannedPages.filter(p => p.status === 'ready' && p.rollNo).length})</>}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ══ RESULTS ══ */}
              <TabsContent value="results">
                <div className="bg-gradient-to-br from-gray-900/60 to-indigo-950/30 border border-indigo-700/20 rounded-2xl p-4 space-y-4 backdrop-blur-sm shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-indigo-400" /> Results — {sel.title}
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => loadDetail(sel.id)}
                        className="border-gray-600 text-gray-300 text-xs flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                      </Button>
                      {results.length > 0 && (
                        <Button size="sm" onClick={() => { loadGroups(); setShowSendDialog('bulk'); }}
                          disabled={sendingWABulk}
                          className="bg-green-700 hover:bg-green-600 text-xs flex items-center gap-1.5">
                          {sendingWABulk ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                            : <><MessageCircle className="w-3.5 h-3.5" /> Send All Results via WhatsApp</>}
                        </Button>
                      )}
                      {results.length > 0 && (
                        <Button size="sm" onClick={() => { loadGroups(); setShowSendDialog('group'); }}
                          disabled={sendingWABulk}
                          className="bg-blue-700 hover:bg-blue-600 text-xs flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" /> Send Group Summary
                        </Button>
                      )}
                      {results.length > 0 && (
                        <Button size="sm" onClick={downloadBulkPDF} disabled={dlBulk}
                          className="bg-purple-700 hover:bg-purple-600 text-xs flex items-center gap-1.5">
                          {dlBulk ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                            : <><Download className="w-3.5 h-3.5" /> Download All ({results.length}) PDFs</>}
                        </Button>
                      )}
                    </div>
                  </div>

                  {results.length > 0 && (() => {
                    const avg     = results.reduce((s, r) => s + r.percentage, 0) / results.length;
                    const passing = results.filter(r => r.percentage >= 35).length;
                    const top     = [...results].sort((a, b) => b.percentage - a.percentage)[0];
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Stat label="Submitted" val={results.length}         color="text-blue-400"  icon={<Users className="w-3.5 h-3.5"/>} />
                        <Stat label="Avg %"     val={`${avg.toFixed(1)}%`}  color="text-indigo-400" />
                        <Stat label="Passing"   val={passing}                color="text-green-400" icon={<CheckCircle2 className="w-3.5 h-3.5"/>} />
                        <Stat label="Topper"    val={top?.studentName?.split(' ')[0] ?? '—'} color="text-yellow-400" />
                      </div>
                    );
                  })()}

                  {results.length === 0 ? (
                    <div className="text-center text-gray-500 py-10 text-sm border border-dashed border-gray-700 rounded-xl">
                      No results yet — use the Scan tab to upload and process OMR sheets.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-700/40">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-700 hover:bg-transparent">
                            <TableHead className="text-gray-400 text-xs w-6">#</TableHead>
                            <TableHead className="text-gray-400 text-xs">Student</TableHead>
                            <TableHead className="text-gray-400 text-xs">Roll</TableHead>
                            <TableHead className="text-gray-400 text-xs">Score</TableHead>
                            <TableHead className="text-gray-400 text-xs">%</TableHead>
                            <TableHead className="text-gray-400 text-xs">Result</TableHead>
                            <TableHead className="text-gray-400 text-xs">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...results].sort((a, b) => b.percentage - a.percentage).map((r, i) => (
                            <TableRow key={r.id} className="border-gray-700/40 hover:bg-gray-700/20">
                              <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                              <TableCell className="text-sm text-white font-medium">{r.studentName}</TableCell>
                              <TableCell className="text-xs font-mono text-indigo-300">{r.rollNo}</TableCell>
                              <TableCell className="text-sm font-bold text-white">{r.obtainedMarks}/{r.totalMarks}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-14 bg-gray-700 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${r.percentage >= 35 ? 'bg-green-500' : 'bg-red-500'}`}
                                      style={{ width: `${Math.min(100, r.percentage)}%` }} />
                                  </div>
                                  <span className={`text-xs font-bold ${r.percentage >= 35 ? 'text-green-400' : 'text-red-400'}`}>
                                    {r.percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {r.percentage >= 35
                                  ? <Badge className="bg-green-900/40 text-green-400 border-green-800 text-[10px]">PASS</Badge>
                                  : <Badge className="bg-red-900/40 text-red-400 border-red-800 text-[10px]">FAIL</Badge>}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <button onClick={() => setViewRes(r)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => downloadResultPDF(r)} disabled={dlPDF === r.id}
                                    className="text-gray-400 hover:text-indigo-400 p-1 rounded hover:bg-gray-700 transition-colors">
                                    {dlPDF === r.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={() => handleSendIndividualResult(r)} disabled={sendingWA === r.id}
                                    className="text-gray-400 hover:text-green-400 p-1 rounded hover:bg-gray-700 transition-colors">
                                    {sendingWA === r.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* ── Create Exam Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-400" /> Create New OMR Exam</DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">Set parameters and fill the complete answer key.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-gray-300 text-xs">Exam Title *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Chapter 5 Test" className="bg-gray-800 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Class (from Player Management) *</Label>
              {classIds.length === 0 ? (
                <p className="text-yellow-400 text-xs mt-1">No classes found. Add students in Player Management first.</p>
              ) : (
                <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white mt-1"><SelectValue placeholder="Select class…" /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 text-white">
                    {classIds.map(c => <SelectItem key={c} value={c}>{c} ({players[c]?.length ?? 0} students)</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-gray-300 text-xs">Total Q *</Label>
                <Input type="number" min={1} max={200} value={form.totalQuestions}
                  onChange={e => { const n = parseInt(e.target.value) || 30; setForm(p => ({ ...p, totalQuestions: n, answerKey: Array(n).fill('') })); }}
                  className="bg-gray-800 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">Options</Label>
                <Select value={String(form.optionsCount)} onValueChange={v => setForm(p => ({ ...p, optionsCount: parseInt(v) }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 text-white">
                    {[3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300 text-xs">Marks/Q</Label>
                <Input type="number" min={0.5} step={0.5} value={form.marksPerQuestion}
                  onChange={e => setForm(p => ({ ...p, marksPerQuestion: parseFloat(e.target.value) || 1 }))}
                  className="bg-gray-800 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">Neg/Q</Label>
                <Input type="number" min={0} step={0.25} value={form.negativeMarks}
                  onChange={e => setForm(p => ({ ...p, negativeMarks: parseFloat(e.target.value) || 0 }))}
                  className="bg-gray-800 border-gray-600 text-white mt-1" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-gray-300 text-xs">Answer Key * — {form.answerKey.filter(Boolean).length}/{form.totalQuestions} filled</Label>
                <div className="flex gap-1">
                  {(['A', 'B', 'C', 'D'] as const).map(l => (
                    <button key={l} onClick={() => setForm(p => ({ ...p, answerKey: Array(p.totalQuestions).fill(l) }))}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300">All {l}</button>
                  ))}
                  <button onClick={() => setForm(p => ({ ...p, answerKey: Array(p.totalQuestions).fill('') }))}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 hover:bg-red-800 text-gray-400">Clear</button>
                </div>
              </div>
              <div className="bg-gray-950/50 border border-gray-700/40 rounded-xl p-2 max-h-52 overflow-y-auto">
                <AnswerGrid total={form.totalQuestions} opts={form.optionsCount}
                  value={form.answerKey} onChange={k => setForm(p => ({ ...p, answerKey: k }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-gray-600 text-gray-300">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500">
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-1" />Creating…</> : 'Create Exam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Result Detail Dialog ── */}
      <Dialog open={!!viewRes} onOpenChange={() => setViewRes(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-xl max-h-[92vh] overflow-y-auto">
          {viewRes && sel && (
            <>
              <DialogHeader>
                <DialogTitle>Result — {viewRes.studentName}</DialogTitle>
                <DialogDescription className="text-gray-400 text-xs">
                  Roll: {viewRes.rollNo} · {sel.title} · {new Date(viewRes.scannedAt).toLocaleDateString('en-IN')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Score"  val={`${viewRes.obtainedMarks}/${viewRes.totalMarks}`} />
                  <Stat label="%"      val={`${viewRes.percentage.toFixed(1)}%`} color={viewRes.percentage >= 35 ? 'text-green-400' : 'text-red-400'} />
                  <Stat label="Result" val={viewRes.percentage >= 35 ? 'PASS' : 'FAIL'} color={viewRes.percentage >= 35 ? 'text-green-400' : 'text-red-400'} />
                </div>
                <Progress value={viewRes.percentage} className="h-2" />
                <div className="overflow-x-auto rounded-xl border border-gray-700/40 max-h-56 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-transparent">
                        <TableHead className="text-gray-400 text-xs">Q</TableHead>
                        <TableHead className="text-gray-400 text-xs">Correct</TableHead>
                        <TableHead className="text-gray-400 text-xs">Student</TableHead>
                        <TableHead className="text-gray-400 text-xs">✓/✗</TableHead>
                        <TableHead className="text-gray-400 text-xs">Marks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewRes.questionResults.map(q => (
                        <TableRow key={q.qNo} className="border-gray-700/40 hover:bg-gray-700/20">
                          <TableCell className="text-xs text-gray-400">{q.qNo}</TableCell>
                          <TableCell className="text-xs font-bold text-green-400">{q.correct}</TableCell>
                          <TableCell className={`text-xs font-bold ${q.isCorrect ? 'text-green-400' : q.isBlank ? 'text-gray-500' : 'text-red-400'}`}>{q.student}</TableCell>
                          <TableCell>{q.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : q.isBlank ? <span className="text-gray-500 text-xs">–</span> : <XCircle className="w-3.5 h-3.5 text-red-400" />}</TableCell>
                          <TableCell className={`text-xs font-bold ${q.marks >= 0 ? 'text-green-400' : 'text-red-400'}`}>{q.marks >= 0 ? `+${q.marks}` : q.marks}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => downloadResultPDF(viewRes)} disabled={dlPDF === viewRes.id}
                  className="bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2">
                  {dlPDF === viewRes.id ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</> : <><Download className="w-4 h-4" />Download PDF</>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Send WhatsApp Dialog ── */}
      <Dialog open={!!showSendDialog} onOpenChange={() => { setShowSendDialog(null); setSelectedGroup(''); }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showSendDialog === 'bulk' ? 'Send All Results via WhatsApp' : 'Send Group Summary via WhatsApp'}
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-xs">
              {showSendDialog === 'bulk'
                ? `Results will be sent to ${results.length} students (and their parents if numbers are available).`
                : 'Select a WhatsApp group to send the results summary.'}
            </DialogDescription>
          </DialogHeader>
          {showSendDialog === 'group' && (
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">Select Group</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Choose a group" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-white">
                  {whatsappGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.participantCount} participants)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowSendDialog(null); setSelectedGroup(''); }}
              className="border-gray-600 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={showSendDialog === 'bulk' ? handleSendBulkResults : handleSendGroupSummary}
              disabled={sendingWABulk || (showSendDialog === 'group' && !selectedGroup)}
              className="bg-green-600 hover:bg-green-500">
              {sendingWABulk ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Sending…</> : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OMRScanner;
