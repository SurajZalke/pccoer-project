import React, { useState } from "react";
import { Quiz, Folder } from "@/types";
import { Trash2, Play, Download, Share2, FolderInput, Edit2, BookOpen, Tag, Zap, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import PdfDownloadOverlay from './PdfDownloadOverlay';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QuizCardProps {
  quiz: Quiz;
  folders?: Folder[];
  onStart: (quizId: string) => void;
  onSelectQuiz: (quiz: Quiz) => void;
  onEditQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quizId: string) => void;
  onShareQuiz: (quizId: string) => void;
  onMoveToFolder?: (quizId: string, folderId: string | null) => void;
}

// Deterministic color accent per subject
const subjectAccent = (subject: string): string => {
  const map: Record<string, string> = {
    chemistry:  'from-cyan-500 to-teal-500',
    physics:    'from-blue-500 to-indigo-500',
    biology:    'from-green-500 to-emerald-500',
    maths:      'from-orange-500 to-amber-500',
    mathematics:'from-orange-500 to-amber-500',
    english:    'from-pink-500 to-rose-500',
  };
  return map[subject?.toLowerCase()] ?? 'from-purple-500 to-indigo-500';
};

const QuizCard: React.FC<QuizCardProps> = ({
  quiz, folders = [],
  onStart, onSelectQuiz, onEditQuiz, onDeleteQuiz, onShareQuiz, onMoveToFolder
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // ── Pure jsPDF exam paper generator (no HTML rendering, no blank pages) ──
  const handleDownloadPDF = async () => {
    setPdfGenerating(true);
    try {
      const OPTS_LTR = ['A', 'B', 'C', 'D', 'E'];

      // Sanitize: jsPDF Helvetica maps Unicode sub/superscripts to wrong glyphs — convert to ASCII
      const sanitize = (t: string): string =>
        t
          .replace(/\]™/g, ']n').replace(/\)™/g, ')n').replace(/™/g, 'n')
          .replace(/®/g, '').replace(/©/g, '')
          // Subscripts → plain digits (CO₂ → CO2, Fe₂O₃ → Fe2O3)
          .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3')
          .replace(/₄/g, '4').replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7')
          .replace(/₈/g, '8').replace(/₉/g, '9').replace(/ₙ/g, 'n').replace(/ₐ/g, 'a')
          // Superscripts → ^n
          .replace(/⁰/g, '^0').replace(/¹/g, '^1').replace(/²/g, '^2').replace(/³/g, '^3')
          .replace(/⁴/g, '^4').replace(/⁵/g, '^5').replace(/⁶/g, '^6').replace(/⁷/g, '^7')
          .replace(/⁸/g, '^8').replace(/⁹/g, '^9').replace(/ⁿ/g, '^n')
          .replace(/\u00B2/g, '^2').replace(/\u00B3/g, '^3').replace(/\u00B9/g, '^1')
          .replace(/°/g, ' deg').replace(/\u00B0/g, ' deg')
          .replace(/→/g, '->').replace(/←/g, '<-').replace(/↑/g, '^').replace(/↓/g, 'v')
          .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≠/g, '!=').replace(/±/g, '+/-')
          .replace(/∞/g, 'inf').replace(/√/g, 'sqrt').replace(/≈/g, '~=')
          .replace(/α/g, 'alpha').replace(/β/g, 'beta').replace(/γ/g, 'gamma')
          .replace(/δ/g, 'delta').replace(/μ/g, 'mu').replace(/σ/g, 'sigma')
          .replace(/π/g, 'pi').replace(/Δ/g, 'Delta').replace(/Σ/g, 'Sigma')
          .replace(/λ/g, 'lambda').replace(/θ/g, 'theta').replace(/φ/g, 'phi')
          .replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/¾/g, '3/4')
          .replace(/['']/g, "'").replace(/[""]/g, '"').replace(/[–—]/g, '-')
          .replace(/…/g, '...').replace(/•/g, '*').replace(/·/g, '.')
          .replace(/[^\x00-\x7F]/g, '');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();   // 210 mm
      const PH = doc.internal.pageSize.getHeight();  // 297 mm
      const M  = 14; // margins

      const totalMarks = quiz.questions.reduce((s, q) => s + ((q as any).Marks || 1), 0);
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      // ── Shared footer ───────────────────────────────────────────────────
      const drawFooter = () => {
        const ph = doc.internal.pageSize.getHeight();
        doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
        doc.line(M, ph - 9, PW - M, ph - 9);
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
        doc.text('PCCOER Education Platform  ·  Exam Paper  ·  Auto-generated', PW / 2, ph - 5, { align: 'center' });
        doc.text(`Page ${doc.getNumberOfPages()}`, PW - M, ph - 5, { align: 'right' });
        doc.text('Created by Mr. Suraj Zalke', M, ph - 5);
      };

      // ── Header band ─────────────────────────────────────────────────────
      doc.setFillColor(30, 27, 75);
      doc.rect(0, 0, PW, 30, 'F');
      try { doc.addImage('/msplogo.jpg', 'JPEG', M, 3, 22, 22); } catch (_) {}
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('PCCOER EDUCATION PLATFORM', PW / 2, 11, { align: 'center' });
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(199, 210, 254);
      doc.text(`Exam Paper  ·  ${quiz.title}`, PW / 2, 19, { align: 'center' });
      doc.text(today, PW / 2, 25, { align: 'center' });

      // ── Exam info box ────────────────────────────────────────────────────
      let y = 34;
      doc.setFillColor(243, 244, 246); doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3);
      doc.rect(M, y, PW - M * 2, 22, 'FD');
      [['Subject', quiz.subject || '-'], ['Grade', quiz.grade || '-'], ['Topic', quiz.topic || '-']].forEach(([l, v], i) => {
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
        doc.text(`${l}:`, M + 3, y + 6 + i * 6);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
        doc.text(String(v), M + 26, y + 6 + i * 6);
      });
      const rx = PW / 2 + 5;
      [['Total Questions', String(quiz.questions.length)], ['Total Marks', String(totalMarks)]].forEach(([l, v], i) => {
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
        doc.text(`${l}:`, rx, y + 6 + i * 6);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
        doc.text(String(v), rx + 33, y + 6 + i * 6);
      });
      if (quiz.hasNegativeMarking) {
        doc.setFontSize(7.5); doc.setTextColor(220, 38, 38); doc.setFont('helvetica', 'bold');
        doc.text(`Negative Marking: -${quiz.negativeMarkingValue ?? 25}% per wrong answer`, M + 3, y + 20);
      }
      y += 27;

      // ── Instructions bar ─────────────────────────────────────────────────
      doc.setFillColor(254, 243, 199); doc.rect(M, y, PW - M * 2, 7, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(146, 64, 14);
      doc.text('INSTRUCTIONS: Choose the best answer. Each Q carries marks shown. Write only on answer sheet.', M + 2, y + 4.5);
      y += 11;

      // ── Questions loop — 2-col options when short, single-col when long ──
      quiz.questions.forEach((q, i) => {
        const qMarks    = (q as any).Marks || 1;
        const colW      = (PW - M * 2) / 2;
        const qClean    = sanitize(q.text);
        const optClean  = q.options.map(o => sanitize(o.text));

        // Check if all options fit in half-width (using sanitized text)
        const allShort = optClean.every(t => {
          return doc.getStringUnitWidth(`A)  ` + t) * 9.5 / doc.internal.scaleFactor < colW - 10;
        });

        const optData = optClean.map((t, oi) => ({
          label: `${OPTS_LTR[oi]})`,
          lines: doc.splitTextToSize(t, allShort ? colW - 16 : PW - M * 2 - 16),
        }));

        const qLines = doc.splitTextToSize(`${i + 1}.  ${qClean}`, PW - M * 2 - 12);
        let optH = 0;
        const ROW_H = 4.8;  // tight exam-paper line height
        if (allShort) {
          for (let p = 0; p < optData.length; p += 2) {
            optH += Math.max(optData[p]?.lines.length || 0, optData[p+1]?.lines.length || 0) * ROW_H + 0.5;
          }
        } else {
          optH = optData.reduce((s, o) => s + o.lines.length * ROW_H + 0.5, 0);
        }
        const blockH = qLines.length * 5.0 + 0.5 + optH + 3.5;

        if (y + blockH > PH - 16) { drawFooter(); doc.addPage(); y = 14; }

        // Question text — bold
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
        doc.text(qLines, M + 3, y);
        doc.setFontSize(7); doc.setTextColor(99, 102, 241);
        doc.text(`[${qMarks} mark${qMarks > 1 ? 's' : ''}]`, PW - M - 1, y, { align: 'right' });
        y += qLines.length * 5.0 + 0.5;  // question-to-first-option gap

        if (allShort) {
          // 2-column layout: A/C on left, B/D on right
          for (let p = 0; p < optData.length; p += 2) {
            const left  = optData[p];
            const right = optData[p + 1];
            const maxL  = Math.max(left?.lines.length || 0, right?.lines.length || 0);

            if (left) {
              doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 41, 59);
              doc.text(left.label, M + 8, y);
              const lw = doc.getTextWidth(`${left.label}  `);
              doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
              left.lines.forEach((ln: string, li: number) => doc.text(ln, M + 8 + lw, y + li * ROW_H));
            }
            if (right) {
              const rx = M + colW + 4;
              doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 41, 59);
              doc.text(right.label, rx, y);
              const lw = doc.getTextWidth(`${right.label}  `);
              doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
              right.lines.forEach((ln: string, li: number) => doc.text(ln, rx + lw, y + li * ROW_H));
            }
            y += maxL * ROW_H + 0.5;  // minimal gap between option rows
          }
        } else {
          // Single-column layout
          optData.forEach(({ label, lines }) => {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 41, 59);
            doc.text(label, M + 8, y);
            const lw = doc.getTextWidth(`${label}  `);
            doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
            lines.forEach((ln: string, li: number) => doc.text(ln, M + 8 + lw, y + li * ROW_H));
            y += lines.length * ROW_H + 0.5;  // minimal gap between single-col options
          });
        }
        y += 4; // gap between questions
      });
      drawFooter();

      // ── Answer Key page ──────────────────────────────────────────────────
      doc.addPage(); y = 14;
      doc.setFillColor(30, 27, 75); doc.rect(0, 0, PW, 16, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text('ANSWER KEY', PW / 2, 11, { align: 'center' });
      y = 24;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
      doc.text(quiz.title, PW / 2, y, { align: 'center' });
      y += 10;

      // Build groups of 10
      const CHUNK = 10;
      const groups: { hdr: string[]; ans: string[] }[] = [];
      let hdr = ['Q'], ans = ['Ans'];
      quiz.questions.forEach((q, i) => {
        const ci = q.options.findIndex(o => o.id === q.correctOption);
        hdr.push(String(i + 1));
        ans.push(ci >= 0 ? OPTS_LTR[ci] : '?');
        if (hdr.length === CHUNK + 1 || i === quiz.questions.length - 1) {
          groups.push({ hdr: [...hdr], ans: [...ans] });
          hdr = ['Q']; ans = ['Ans'];
        }
      });

      groups.forEach(g => {
        autoTable(doc, {
          startY: y,
          head: [g.hdr],
          body: [g.ans],
          theme: 'grid',
          styles: { fontSize: 9.5, cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 2 }, halign: 'center', valign: 'middle', lineWidth: 0.2, lineColor: [209, 213, 219] },
          headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 9 },
          bodyStyles: { textColor: [22, 163, 74], fontStyle: 'bold', fontSize: 11 },
          columnStyles: { 0: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold', fontSize: 9 } },
          margin: { left: M, right: M },
        });
        y = (doc as any).lastAutoTable.finalY + 7;
      });

      drawFooter();
      doc.save(`${quiz.title.replace(/[^a-zA-Z0-9]/g, '_')}_ExamPaper.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({ title: 'PDF Error', description: 'Failed to generate PDF. Please try again.', variant: 'destructive' });
    } finally {
      setTimeout(() => setPdfGenerating(false), 400);
    }
  };

  const accent = subjectAccent(quiz.subject);

  const handleEdit = () => navigate("/create-quiz", { state: { quizId: quiz.id } });

  const handleShare = async () => {
    const quizLink = `${window.location.origin}/play-quiz/${quiz.id}`;
    if (navigator.share) {
      await navigator.share({ title: quiz.title, text: `Join my quiz: ${quiz.title}`, url: quizLink });
      toast({ title: "Shared!", description: "Quiz link shared successfully." });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent('Join my Quiz: ' + quiz.title + ' ' + quizLink)}`, '_blank');
      toast({ title: "Opening WhatsApp…" });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5, rotateX: 2, rotateY: -2, transition: { duration: 0.2 } }}
      style={{ transformPerspective: 800 }}
      className="relative group rounded-2xl overflow-hidden"
    >
      <PdfDownloadOverlay visible={pdfGenerating} label="Generating quiz PDF…" />
      {/* Glow ring on hover */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl pointer-events-none`} />

      {/* Card body */}
      <div className="relative bg-gray-900/80 backdrop-blur-md border border-white/10 group-hover:border-white/20 rounded-2xl transition-all duration-300 overflow-hidden">

        {/* Top accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />

        {/* Main content */}
        <div className="p-3.5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r ${accent} text-white shadow-sm`}>
              <BookOpen className="h-3 w-3" />
              {quiz.grade} · {quiz.subject}
            </span>
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-2 py-0.5 rounded-full transition-all duration-200 shrink-0"
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-white leading-snug line-clamp-1 mb-1 font-display">
            {quiz.title}
          </h3>

          {/* Description */}
          <p className="text-gray-400 text-xs line-clamp-1 mb-2 leading-relaxed">
            {quiz.description || 'No description provided.'}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
            <span className="flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
              {quiz.questions.length} Qs
            </span>
            {quiz.topic && (
              <span className="flex items-center gap-1 text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full max-w-[110px]">
                <Tag className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{quiz.topic}</span>
              </span>
            )}
            {quiz.hasNegativeMarking && (
              <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-0.5 rounded-full">
                <Zap className="h-2.5 w-2.5" />
                -{quiz.negativeMarkingValue}%
              </span>
            )}
          </div>

          {/* Primary CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onStart(quiz.id)}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${accent} hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-200 mb-1`}
          >
            <Play className="h-4 w-4" /> Start Quiz
          </motion.button>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors duration-200 py-0.5"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Less' : 'More actions'}
          </button>

          {/* Expanded actions */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-1.5 pt-2">
                  <ActionBtn icon={pdfGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} label="PDF" color="indigo" onClick={handleDownloadPDF} />
                  <ActionBtn icon={<Share2 className="h-3.5 w-3.5" />} label="Share" color="purple" onClick={handleShare} />
                  {onMoveToFolder ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-300 text-[10px] font-medium transition-all duration-200">
                          <FolderInput className="h-3.5 w-3.5" />
                          Move
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-gray-900 border border-gray-700 text-white text-xs shadow-2xl rounded-xl">
                        <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer rounded-lg" onClick={() => onMoveToFolder(quiz.id, null)}>
                          📂 Root (No Folder)
                        </DropdownMenuItem>
                        {folders.map(folder => (
                          <DropdownMenuItem key={folder.id} className="hover:bg-gray-800 cursor-pointer rounded-lg" onClick={() => onMoveToFolder(quiz.id, folder.id)}>
                            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: folder.color || '#6366f1' }} />
                            {folder.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : <div />}
                </div>
                {/* Delete — full width, separate row */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onDeleteQuiz(quiz.id)}
                  className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 text-[11px] font-medium transition-all duration-200"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Quiz
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </motion.div>
  );
};

// Small action button helper
const ActionBtn: React.FC<{ icon: React.ReactNode; label: string; color: 'indigo' | 'purple' | 'green'; onClick: () => void }> = ({ icon, label, color, onClick }) => {
  const colors = {
    indigo: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 text-indigo-300',
    purple: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20 text-purple-300',
    green:  'bg-green-500/10  hover:bg-green-500/20  border-green-500/20  text-green-300',
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl border text-[10px] font-medium transition-all duration-200 ${colors[color]}`}
    >
      {icon}
      {label}
    </button>
  );
};

export default QuizCard;
