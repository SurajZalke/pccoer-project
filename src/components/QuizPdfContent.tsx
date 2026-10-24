/**
 * QuizPdfContent.tsx — A4 Exam Paper layout for react-to-pdf
 *
 * Rules:
 *  • Questions rendered with hard page-break safety (no cut options)
 *  • Options always stay with their question
 *  • Answer key: ONE unified table, all questions in a single consistent grid
 *  • No correct answers shown in the question section
 */
import React from 'react';
import { Quiz } from '@/types';

interface Props {
  quiz: Quiz;
  hostName: string;
  hostAvatarUrl?: string;
}

const ALPHA = ['A', 'B', 'C', 'D', 'E'];

// ─── colour tokens ────────────────────────────────────────────────────────────
const INDIGO   = '#1e1b4b';
const INDIGO_L = '#c7d2fe';
const GRAY_50  = '#f9fafb';
const GRAY_100 = '#f3f4f6';
const GRAY_200 = '#e5e7eb';
const GRAY_500 = '#6b7280';
const GRAY_700 = '#374151';
const DARK     = '#0f172a';
const GREEN    = '#16a34a';
const VIOLET   = '#6366f1';

// ─── shared utility: page footer row ─────────────────────────────────────────
const Footer = () => (
  <div style={{
    borderTop: `1px solid ${GRAY_200}`,
    marginTop: '8mm',
    paddingTop: '2mm',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '6.5pt',
    color: '#94a3b8',
  }}>
    <span>PCCOER Education Platform  ·  Auto-generated</span>
    <span>Created by Mr. Suraj Zalke</span>
  </div>
);

// ─── Header band ──────────────────────────────────────────────────────────────
const Header: React.FC<{ quiz: Quiz; hostName: string; today: string }> = ({ quiz, hostName, today }) => (
  <>
    <div style={{
      background: `linear-gradient(135deg, ${INDIGO} 0%, #312e81 100%)`,
      borderRadius: '7px',
      padding: '9px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <img src="/msplogo.jpg" alt="logo" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
        <div>
          <p style={{ margin: 0, color: '#fff', fontSize: '13pt', fontWeight: 'bold', lineHeight: 1.2 }}>
            PCCOER Education Platform
          </p>
          <p style={{ margin: 0, color: INDIGO_L, fontSize: '7pt' }}>Digras  ·  Exam Paper</p>
        </div>
      </div>
      <div style={{ textAlign: 'right', color: INDIGO_L, fontSize: '7pt', lineHeight: 1.6 }}>
        <div>{today}</div>
        <div>Host: {hostName}</div>
        <div style={{ color: '#a5b4fc' }}>Created by Mr. Suraj Zalke</div>
      </div>
    </div>

    {/* Quiz title */}
    <div style={{ textAlign: 'center', marginBottom: '6px' }}>
      <h2 style={{ margin: '0 0 2px 0', fontSize: '14pt', fontWeight: 'bold', color: INDIGO }}>{quiz.title}</h2>
      {quiz.description && <p style={{ margin: 0, color: GRAY_500, fontSize: '7.5pt' }}>{quiz.description}</p>}
    </div>
  </>
);

// ─── Info bar ─────────────────────────────────────────────────────────────────
const InfoBar: React.FC<{ quiz: Quiz; totalMarks: number }> = ({ quiz, totalMarks }) => (
  <>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      background: GRAY_100,
      border: `1px solid ${GRAY_200}`,
      borderRadius: '5px',
      padding: '5px 10px',
      fontSize: '8pt',
      marginBottom: '4px',
    }}>
      <span>
        <b>Subject:</b> {quiz.subject || '—'}{'   '}
        <b>Grade:</b> {quiz.grade || '—'}{'   '}
        <b>Topic:</b> {quiz.topic || '—'}
      </span>
      <span>
        <b>Questions:</b> {quiz.questions.length}{'   '}
        <b>Total Marks:</b> {totalMarks}
      </span>
    </div>
    {quiz.hasNegativeMarking && (
      <p style={{ margin: '0 0 4px 0', color: '#dc2626', fontSize: '7.5pt', fontWeight: 'bold' }}>
        ⚠ Negative Marking: -{quiz.negativeMarkingValue ?? 25}% per wrong answer
      </p>
    )}
    <div style={{
      background: '#fef3c7',
      border: '1px solid #fcd34d',
      borderRadius: '4px',
      padding: '3px 9px',
      fontSize: '6.8pt',
      fontWeight: 'bold',
      color: '#92400e',
      marginBottom: '8px',
    }}>
      INSTRUCTIONS: Read each question carefully and choose the ONE best answer.
      Mark your responses on the separate answer sheet. Do not write on the question paper.
    </div>
  </>
);

// ─── Single question block ────────────────────────────────────────────────────
const QuestionBlock: React.FC<{ q: Quiz['questions'][0]; idx: number }> = ({ q, idx }) => {
  const qMarks = (q as any).Marks || 1;
  // Use 2-column option grid only when ALL options are short (≤ 35 chars)
  const allShort = q.options.every(o => o.text.length <= 35);

  return (
    <div style={{
      marginBottom: '10px',
      pageBreakInside: 'avoid',
      breakInside: 'avoid',
    }}>
      {/* Question text + marks badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
        <p style={{
          margin: 0,
          fontWeight: 'bold',
          fontSize: '10pt',
          color: DARK,
          lineHeight: '1.45',
          flex: 1,
        }}>
          {idx + 1}.{'  '}{q.text}
        </p>
        <span style={{
          marginLeft: '8px',
          flexShrink: 0,
          fontSize: '6.8pt',
          color: VIOLET,
          fontWeight: 'bold',
          paddingTop: '2px',
        }}>
          [{qMarks} mark{qMarks > 1 ? 's' : ''}]
        </span>
      </div>

      {/* Options */}
      {allShort ? (
        // 2-column grid for short options
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: '12px',
          rowGap: '1px',
          marginLeft: '14px',
        }}>
          {q.options.map((opt, oi) => (
            <span key={opt.id} style={{ fontSize: '9pt', color: GRAY_700, lineHeight: '1.5' }}>
              <b>{ALPHA[oi]})</b>{'  '}{opt.text}
            </span>
          ))}
        </div>
      ) : (
        // Single-column for long options
        <div style={{ marginLeft: '14px' }}>
          {q.options.map((opt, oi) => (
            <div key={opt.id} style={{ fontSize: '9pt', color: GRAY_700, lineHeight: '1.5', marginBottom: '1px' }}>
              <b>{ALPHA[oi]})</b>{'  '}{opt.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Answer Key ───────────────────────────────────────────────────────────────
// Renders a single unified table — all questions, up to 10 per row-group.
// Each "group" = one header row (Q numbers) + one answer row (letters).
const AnswerKey: React.FC<{ quiz: Quiz; answerKey: { qNo: number; letter: string }[] }> = ({ quiz, answerKey }) => {
  const COLS = 10; // answers per row-group
  const groups: typeof answerKey[] = [];
  for (let i = 0; i < answerKey.length; i += COLS) {
    groups.push(answerKey.slice(i, i + COLS));
  }

  const cellBase: React.CSSProperties = {
    padding: '5px 3px',
    textAlign: 'center',
    fontSize: '9pt',
    border: `1px solid ${GRAY_200}`,
    minWidth: '22px',
  };
  const hdrCell: React.CSSProperties = {
    ...cellBase,
    background: INDIGO,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '8pt',
  };
  const labelCell: React.CSSProperties = {
    ...cellBase,
    background: GRAY_100,
    color: GRAY_700,
    fontWeight: 'bold',
    fontSize: '8pt',
  };
  const ansCell: React.CSSProperties = {
    ...cellBase,
    color: GREEN,
    fontWeight: 'bold',
    fontSize: '10pt',
    background: '#f0fdf4',
  };

  return (
    <div style={{
      fontFamily: '"Arial", "Helvetica Neue", sans-serif',
      background: '#fff',
      padding: '0 16mm 16mm 16mm',
      pageBreakBefore: 'always',
    }}>
      {/* Header band */}
      <div style={{
        background: INDIGO,
        margin: '0 -16mm',
        padding: '10px 20mm',
        textAlign: 'center',
        marginBottom: '12px',
      }}>
        <h2 style={{ color: '#fff', margin: 0, fontSize: '14pt', fontWeight: 'bold', letterSpacing: '1px' }}>
          ANSWER KEY
        </h2>
      </div>

      <p style={{ textAlign: 'center', color: GRAY_700, fontSize: '9pt', marginBottom: '12px', fontWeight: 'bold' }}>
        {quiz.title}
      </p>

      {/* One table per row-group of 10 */}
      {groups.map((group, gi) => (
        <table key={gi} style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '8px',
          tableLayout: 'fixed',
        }}>
          <tbody>
            {/* Row 1: Q numbers */}
            <tr>
              <td style={{ ...hdrCell, background: '#374151', width: '40px' }}>Q</td>
              {group.map(item => (
                <td key={item.qNo} style={hdrCell}>{item.qNo}</td>
              ))}
              {/* Fill empty cells so last row aligns with full rows */}
              {Array.from({ length: COLS - group.length }).map((_, ei) => (
                <td key={`eh${ei}`} style={{ ...hdrCell, background: GRAY_50 }} />
              ))}
            </tr>
            {/* Row 2: Answer letters */}
            <tr>
              <td style={labelCell}>Ans</td>
              {group.map(item => (
                <td key={item.qNo} style={ansCell}>{item.letter}</td>
              ))}
              {Array.from({ length: COLS - group.length }).map((_, ei) => (
                <td key={`ea${ei}`} style={{ ...ansCell, background: '#fff', color: 'transparent' }}>—</td>
              ))}
            </tr>
          </tbody>
        </table>
      ))}

      <div style={{
        borderTop: `1px solid ${GRAY_200}`,
        marginTop: '12px',
        paddingTop: '3px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '6.5pt',
        color: '#94a3b8',
      }}>
        <span>PCCOER Education Platform  ·  Answer Key  ·  Auto-generated</span>
        <span>Created by Mr. Suraj Zalke</span>
      </div>
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────
const QuizPdfContent: React.FC<Props> = ({ quiz, hostName }) => {
  const today     = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const totalMarks = quiz.questions.reduce((s, q) => s + ((q as any).Marks || 1), 0);

  const answerKey = quiz.questions.map((q, i) => {
    const ci = q.options.findIndex(o => o.id === q.correctOption);
    return { qNo: i + 1, letter: ci >= 0 ? ALPHA[ci] : '?' };
  });

  return (
    <>
      {/* ── EXAM PAPER ── */}
      <div style={{
        width: '210mm',
        padding: '12mm 16mm 16mm 16mm',
        fontFamily: '"Arial", "Helvetica Neue", sans-serif',
        background: '#fff',
        boxSizing: 'border-box',
        color: DARK,
      }}>
        <Header quiz={quiz} hostName={hostName} today={today} />
        <InfoBar quiz={quiz} totalMarks={totalMarks} />

        {/* Questions — each block has breakInside:avoid so options never split */}
        {quiz.questions.map((q, i) => (
          <QuestionBlock key={q.id} q={q} idx={i} />
        ))}

        <Footer />
      </div>

      {/* ── ANSWER KEY (new page) ── */}
      <AnswerKey quiz={quiz} answerKey={answerKey} />
    </>
  );
};

export default QuizPdfContent;
