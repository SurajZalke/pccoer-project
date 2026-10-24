import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getDatabase, ref, get, set, onValue, off } from 'firebase/database';
import { Quiz } from '@/types';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { avatars } from '@/utils/avatars';
import { app } from '@/lib/firebaseConfig';
import { saveSharedUrlGameHistory } from '@/utils/gameHistoryUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PdfDownloadOverlay from '@/components/PdfDownloadOverlay';
import VIPAdminEntryAnimation from '@/components/VIPAdminEntryAnimation';
import { VIP_ADMIN_ROLL, isVIPRoll, lookupPlayer } from '@/utils/vipAdmin';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
  accuracy: number;
  correctAnswersCount: number;
  totalQuestions: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LogoHeader: React.FC = () => (
  <div className="mb-6 flex flex-col items-center">
    <img
      src="/msplogo.jpg"
      alt="PCCOER Education Platform Logo"
      width={80}
      height={80}
      loading="lazy"
      decoding="async"
      className="h-20 w-20 object-contain rounded-full shadow-lg border-2 border-white/50"
    />
    <h2 className="font-bold text-xl mt-3 text-white drop-shadow-md tracking-wide">
      PCCOER Education Platform
    </h2>
  </div>
);

const rankBg = ['bg-yellow-400/20 border-yellow-400/40', 'bg-gray-300/20 border-gray-300/40', 'bg-amber-600/20 border-amber-600/40'];
const rankIcons = ['🥇', '🥈', '🥉'];

interface LiveLeaderboardProps {
  quizId: string;
  currentPlayerId?: string | null;
}

const LiveLeaderboard: React.FC<LiveLeaderboardProps> = ({ quizId, currentPlayerId }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    const db = getDatabase(app);
    const playersRef = ref(db, `sharedQuizResults/${quizId}/players`);

    const unsub = onValue(playersRef, (snap) => {
      if (!snap.exists()) { setEntries([]); return; }
      const data = snap.val();
      const list: LeaderboardEntry[] = Object.entries(data).map(([pid, p]: [string, any]) => ({
        playerId: pid,
        nickname: p.nickname || 'Anonymous',
        avatar: p.avatar || '',
        score: Number(p.score) || 0,
        accuracy: Number(p.accuracy) || 0,
        correctAnswersCount: Number(p.correctAnswersCount) || 0,
        totalQuestions: Number(p.totalQuestions) || 0,
      }));
      list.sort((a, b) => b.score - a.score);
      setEntries(list);
    });

    return () => off(playersRef, 'value', unsub);
  }, [quizId]);

  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl mx-auto mt-4"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/10 border border-purple-300/20 backdrop-blur-sm text-white font-bold hover:bg-white/15 transition-all"
      >
        <span className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Live Leaderboard
          <span className="text-xs font-normal text-white/60 ml-1">{entries.length} player{entries.length !== 1 ? 's' : ''}</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl bg-black/30 border border-purple-300/20 backdrop-blur-sm overflow-hidden">
              {entries.slice(0, 10).map((entry, idx) => {
                const isMe = entry.playerId === currentPlayerId;
                const medal = rankIcons[idx] || `#${idx + 1}`;
                return (
                  <motion.div
                    key={entry.playerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-all
                      ${isMe ? 'bg-purple-500/30 border-l-4 border-l-purple-400' : ''}
                      ${idx < 3 ? rankBg[idx] + ' border-l-4' : ''}
                    `}
                  >
                    <span className="text-xl w-8 text-center flex-shrink-0">{medal}</span>
                    {entry.avatar ? (
                      <img src={entry.avatar} alt={entry.nickname} width={32} height={32} loading="lazy" decoding="async" className="w-8 h-8 rounded-full border border-white/20 flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                        {entry.nickname[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${isMe ? 'text-purple-200' : 'text-white'}`}>
                        {entry.nickname} {isMe && <span className="text-xs text-purple-300">(You)</span>}
                      </p>
                      <p className="text-xs text-white/50">{entry.correctAnswersCount}/{entry.totalQuestions} correct · {entry.accuracy.toFixed(0)}%</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`font-black text-lg ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-white'}`}>
                        {entry.score}
                      </p>
                      <p className="text-xs text-white/40">pts</p>
                    </div>
                  </motion.div>
                );
              })}
              {entries.length > 10 && (
                <div className="text-center py-2 text-white/40 text-xs">
                  +{entries.length - 10} more players
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

const PlayQuizPage: React.FC = () => {
  const { id: paramId } = useParams<{ id: string }>();
  const { toast } = useToast();

  // Quiz data
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [ownerAiExplanationEnabled, setOwnerAiExplanationEnabled] = useState<boolean | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // Player setup
  const [playerReady, setPlayerReady] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  // Quiz gameplay
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [nextButtonText] = useState('Next Question ⏭️');

  const withPdfLoading = async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } finally {
      setLoading(false);
    }
  };

  // VIP admin easter egg
  const [showVIPPlay, setShowVIPPlay] = useState(false);
  const vipPlayShownRef = useRef(false);

  // ── Fetch quiz ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!paramId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      setLoading(true);
      const db = getDatabase(app);

      try {
        // 1. Try global path first (fast)
        const globalRef = ref(db, `quizzes/${paramId}`);
        const globalSnap = await get(globalRef);

        if (globalSnap.exists()) {
          const data = globalSnap.val() as Quiz;
          const fetchedQuiz: Quiz = { id: paramId, ...data };
          await loadQuiz(fetchedQuiz, db);
          return;
        }

        // 2. Fallback: scan all users' quizzes (handles legacy data)
        const usersSnap = await get(ref(db, 'users'));
        if (usersSnap.exists()) {
          const usersData = usersSnap.val();
          for (const uid of Object.keys(usersData)) {
            const quizData = usersData[uid]?.quizzes?.[paramId];
            if (quizData) {
              const fetchedQuiz: Quiz = { id: paramId, ...quizData };
              // Migrate to global path so future loads are fast
              try {
                await set(ref(db, `quizzes/${paramId}`), quizData);
              } catch (_) {/* non-critical */}
              await loadQuiz(fetchedQuiz, db);
              return;
            }
          }
        }

        // Nothing found
        setNotFound(true);
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [paramId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuiz = async (fetchedQuiz: Quiz, db: any) => {
    // Load owner AI explanation flag
    if (fetchedQuiz.createdBy) {
      try {
        const snap = await get(
          ref(db, `users/${fetchedQuiz.createdBy}/profile/aiExplanationEnabled`)
        );
        if (snap.exists()) setOwnerAiExplanationEnabled(Boolean(snap.val()));
      } catch (_) {/* non-critical */}
    }

    setQuiz(fetchedQuiz);
    setAnswers(new Array(fetchedQuiz.questions.length).fill(''));
  };

  // ── Restore session from localStorage ─────────────────────────────────────

  useEffect(() => {
    if (!paramId) return;

    const storedPlayerId = localStorage.getItem(`quiz_player_id_${paramId}`);
    const storedRollNo   = localStorage.getItem(`quiz_roll_no_${paramId}`);
    const storedAvatar   = localStorage.getItem(`quiz_avatar_${paramId}`);
    const storedClassId  = localStorage.getItem(`quiz_class_id_${paramId}`);

    if (storedPlayerId && storedRollNo && storedAvatar && storedClassId) {
      const restore = async () => {
        try {
          const db = getDatabase(app);
          const snap = await get(ref(db, `players/${storedClassId}/${storedRollNo}`));
          if (snap.exists()) {
            setPlayerId(storedPlayerId);
            setRollNo(storedRollNo);
            setClassId(storedClassId);
            setSelectedAvatar(storedAvatar);
            setNickname(snap.val().name);
            setPlayerReady(true);
          } else {
            // Stale session — clear it
            ['quiz_player_id_', 'quiz_roll_no_', 'quiz_avatar_', 'quiz_class_id_'].forEach(
              key => localStorage.removeItem(`${key}${paramId}`)
            );
          }
        } catch (err) {
          console.error('Error restoring session:', err);
        }
      };
      restore();
    }
  }, [paramId]);

  // ── Player setup ───────────────────────────────────────────────────────────

  const handlePlayerSetup = async () => {
    if (rollNo.length !== 6 || !/^\d+$/.test(rollNo)) {
      toast({ title: 'Error', description: 'Please enter a valid 6-digit roll number.', variant: 'destructive' });
      return;
    }
    if (!selectedAvatar) {
      toast({ title: 'Error', description: 'Please select an avatar.', variant: 'destructive' });
      return;
    }

    const playerInfo = await lookupPlayer(rollNo);
    if (!playerInfo?.name || !playerInfo?.classId) {
      toast({ title: 'Error', description: 'Roll number not found. Please enter a valid 6-digit roll number.', variant: 'destructive' });
      return;
    }

    const { name: fetchedName, classId: foundClassId } = playerInfo;
    setClassId(foundClassId);
    setNickname(fetchedName);

    const result = await saveSharedUrlGameHistory(
      paramId!, quiz!.title, quiz!.createdBy,
      fetchedName, selectedAvatar, 0,
      undefined, undefined, quiz!.questions.length
    );

    if (result.success) {
      setPlayerId(result.playerId!);
      localStorage.setItem(`quiz_player_id_${paramId}`, result.playerId!);
      localStorage.setItem(`quiz_roll_no_${paramId}`, rollNo);
      localStorage.setItem(`quiz_class_id_${paramId}`, foundClassId);
      localStorage.setItem(`quiz_avatar_${paramId}`, selectedAvatar);

      if (isVIPRoll(rollNo) && !vipPlayShownRef.current) {
        vipPlayShownRef.current = true;
        setShowVIPPlay(true);
      }
      setPlayerReady(true);
      toast({ title: 'Success', description: 'Player setup complete! Starting quiz...' });
    } else {
      toast({ title: 'Error', description: 'Failed to save player data. Please try again.', variant: 'destructive' });
    }
  };

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!playerReady || !quiz || hasAnswered) {
      setTimeLeft(null);
      return;
    }

    const limit = Number(quiz.questions[currentQuestionIndex]?.timeLimit) || 30;
    setTimeLeft(limit);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setHasAnswered(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz, currentQuestionIndex, playerReady]); // eslint-disable-line react-hooks/exhaustive-deps



  // ── Answer handling ────────────────────────────────────────────────────────

  function handleAnswerSelect(_questionId: string, optionId: string) {
    setSelectedAnswer(optionId);
    setHasAnswered(true);

    setAnswers(prev => {
      const next = [...prev];
      next[currentQuestionIndex] = optionId;
      return next;
    });

    const currentQ = quiz?.questions[currentQuestionIndex];
    if (!currentQ) return;

    if (optionId === currentQ.correctOption) {
      setScore(prev => prev + (currentQ.Marks || 1));
    } else if (quiz?.hasNegativeMarking) {
      const neg = (currentQ.Marks || 1) * ((quiz.negativeMarkingValue ?? 0) / 100);
      setScore(prev => prev - neg);
      toast({ title: 'Negative Marking', description: `-${neg} mark(s) for wrong answer.`, variant: 'destructive' });
    }
  }

  function handleNextQuestion() {
    setHasAnswered(false);
    setSelectedAnswer(null);
    if (!quiz) return;

    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizCompleted(true);
    }
  }

  // ── Save final score ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!quizCompleted || !playerId || !paramId || !quiz) return;

    const save = async () => {
      try {
        const formattedAnswers = quiz.questions.map((q, i) => ({
          optionId: answers[i] || '',
          correct: answers[i] === q.correctOption,
        }));
        await saveSharedUrlGameHistory(
          paramId, quiz.title, quiz.createdBy,
          nickname, selectedAvatar!, score,
          formattedAnswers, undefined, quiz.questions.length
        );
        localStorage.setItem(`quiz_roll_no_${paramId}`, rollNo);
        localStorage.setItem(`quiz_class_id_${paramId}`, classId);
        localStorage.setItem(`quiz_avatar_${paramId}`, selectedAvatar!);
        toast({ title: 'Quiz Completed', description: 'Your score has been saved!' });

        // ── Auto-send result via WhatsApp ─────────────────────────────────
        const ADMIN_PHONE = '918554096571';
        const autoSendWhatsApp = async () => {
          const correct   = formattedAnswers.filter(a => a.correct).length;
          const total     = quiz.questions.length;
          const totalMark = quiz.questions.reduce((s, q) => s + (q.Marks || 1), 0);
          const acc       = total > 0 ? ((correct / total) * 100).toFixed(1) : '0';
          const date      = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const quizLink  = `${window.location.origin}/play-quiz/${paramId}`;

          const studentMsg =
            `*📊 Quiz Result — ${quiz.title}*\n\n` +
            `Student: *${nickname}*\n` +
            (rollNo  ? `Roll No: ${rollNo}\n`  : '') +
            (classId ? `Class: ${classId}\n`   : '') +
            `\nScore: *${score} / ${totalMark}*\n` +
            `Correct: ${correct}/${total}  |  Accuracy: *${acc}%*\n\n` +
            `${quizLink}\n${date} | PCCOER Education Platform 🎓`;

          const adminMsg =
            `*[Quiz Alert] ${quiz.title}*\n` +
            `Student: *${nickname}*` +
            (rollNo  ? ` | Roll: ${rollNo}`   : '') +
            (classId ? ` | Class: ${classId}` : '') +
            `\nScore: *${score}/${totalMark}*  Accuracy: *${acc}%*\n${date}`;

          try {
            const { isBackendConfigured, sendDirectMessage } =
              await import('@/services/whatsappWebService');

            if (isBackendConfigured()) {
              // Look up student mobile from Firebase
              if (rollNo) {
                const { getDatabase, ref: dbRef, get: dbGet } = await import('firebase/database');
                const { app: fbApp } = await import('@/lib/firebaseConfig');
                const db = getDatabase(fbApp);
                const snap = await dbGet(dbRef(db, `players/${classId || ''}/${rollNo}`)).catch(() => null);
                const mobile: string = snap?.val()?.mobile || snap?.val()?.phone || '';
                if (mobile) await sendDirectMessage(mobile, studentMsg).catch(() => {});
              }
              // Always notify admin
              await sendDirectMessage(ADMIN_PHONE, adminMsg).catch(() => {});
              console.log('[PlayQuiz] ✅ WhatsApp result sent');
              return;
            }
          } catch (waErr) {
            console.warn('[PlayQuiz] Backend send failed, using wa.me fallback:', waErr);
          }

          // Fallback: wa.me link to admin (opens silently in background tab)
          try {
            window.open(
              `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(adminMsg)}`,
              '_blank', 'noopener'
            );
          } catch { /* browser blocked popup — acceptable */ }
        };

        autoSendWhatsApp(); // fire-and-forget
        // ─────────────────────────────────────────────────────────────────
      } catch (err) {
        console.error('Error saving score:', err);
        toast({ title: 'Error', description: 'Failed to save your score. Please try again.', variant: 'destructive' });
      }
    };

    save();
  }, [quizCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Renders ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 p-4">
        <LogoHeader />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 p-4">
        <LogoHeader />
        <Card className="w-full max-w-md rounded-xl shadow-2xl border border-purple-300/20 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90">
          <CardHeader className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
            <CardTitle className="text-center text-2xl font-bold">Quiz Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center p-8">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-lg mb-6 text-gray-700 dark:text-gray-300">
              This quiz does not exist or the link has expired.
            </p>
            <Button
              onClick={() => (window.location.href = '/')}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium px-6 py-2 rounded-full shadow-md"
            >
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quiz) return null;

  if (!playerReady) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 p-4">
        <LogoHeader />
        <Card className="w-full max-w-md rounded-xl shadow-2xl border border-purple-300/20 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90">
          <CardHeader className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
            <CardTitle className="text-center text-2xl font-bold">Enter Your Details</CardTitle>
            <p className="text-center text-white/80 text-sm mt-1">{quiz.title}</p>
          </CardHeader>
          <CardContent className="text-center p-8">
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Enter 6-digit Roll Number"
                value={rollNo}
                onChange={e => setRollNo(e.target.value)}
                maxLength={6}
                className={`w-full p-3 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent shadow-md text-center text-xl tracking-widest ${
                  rollNo === VIP_ADMIN_ROLL
                    ? 'border-yellow-400 bg-gradient-to-r from-yellow-900/60 to-purple-900/60 ring-2 ring-yellow-400 animate-pulse'
                    : 'border-gray-700 bg-gray-800 focus:ring-purple-500'
                }`}
              />
              {rollNo === VIP_ADMIN_ROLL && (
                <p className="text-yellow-400 font-black text-sm mt-1 animate-pulse">👑 VIP Admin Detected! 👑</p>
              )}
            </div>
            <div className="mb-6 grid grid-cols-3 gap-2">
              {avatars.map((avatar, index) => (
                <div
                  key={index}
                  className={`cursor-pointer p-2 rounded-full ${
                    selectedAvatar === avatar ? 'border-4 border-purple-500' : 'border-2 border-transparent'
                  }`}
                  onClick={() => setSelectedAvatar(avatar)}
                >
                  <Avatar className="w-16 h-16 mx-auto">
                    <img src={avatar} alt={`Avatar ${index + 1}`} className="rounded-full" />
                  </Avatar>
                </div>
              ))}
            </div>
            <Button
              onClick={handlePlayerSetup}
              disabled={rollNo.length !== 6 || !/^\d+$/.test(rollNo) || !selectedAvatar}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium px-6 py-2 rounded-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quizCompleted) {
    const totalMarks = quiz.questions.reduce((sum, q) => sum + (q.Marks || 1), 0);
    const OPTS_LTR   = ['A', 'B', 'C', 'D', 'E'];

    // ── Text sanitizer: jsPDF Helvetica maps Unicode sub/superscripts to wrong glyphs ──
    // (₂ → comma, ₃ → f, etc.) — must convert all to plain ASCII.
    const sanitize = (text: string): string =>
      text
        // ™ in polymer formulas = subscript n encoding artifact
        .replace(/\]™/g, ']n').replace(/\)™/g, ')n').replace(/™/g, 'n')
        .replace(/®/g, '').replace(/©/g, '')
        // Subscripts → plain digits (Fe₂O₃ → Fe2O3, CO₂ → CO2)
        .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3')
        .replace(/₄/g, '4').replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7')
        .replace(/₈/g, '8').replace(/₉/g, '9').replace(/ₙ/g, 'n').replace(/ₐ/g, 'a')
        // Superscripts → plain with ^ (x² → x^2)
        .replace(/⁰/g, '^0').replace(/¹/g, '^1').replace(/²/g, '^2').replace(/³/g, '^3')
        .replace(/⁴/g, '^4').replace(/⁵/g, '^5').replace(/⁶/g, '^6').replace(/⁷/g, '^7')
        .replace(/⁸/g, '^8').replace(/⁹/g, '^9').replace(/ⁿ/g, '^n')
        .replace(/\u00B2/g, '^2').replace(/\u00B3/g, '^3').replace(/\u00B9/g, '^1')
        // Degree
        .replace(/°/g, ' deg').replace(/\u00B0/g, ' deg')
        // Arrows
        .replace(/→/g, '->').replace(/←/g, '<-').replace(/↑/g, '^').replace(/↓/g, 'v')
        // Math
        .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≠/g, '!=').replace(/±/g, '+/-')
        .replace(/∞/g, 'inf').replace(/√/g, 'sqrt').replace(/≈/g, '~=').replace(/∴/g, ':.')
        // Greek
        .replace(/α/g, 'alpha').replace(/β/g, 'beta').replace(/γ/g, 'gamma')
        .replace(/δ/g, 'delta').replace(/μ/g, 'mu').replace(/σ/g, 'sigma')
        .replace(/π/g, 'pi').replace(/Δ/g, 'Delta').replace(/Σ/g, 'Sigma')
        .replace(/λ/g, 'lambda').replace(/θ/g, 'theta').replace(/φ/g, 'phi')
        // Fractions
        .replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/¾/g, '3/4')
        // Typography
        .replace(/['']/g, "'").replace(/[""]/g, '"').replace(/[–—]/g, '-')
        .replace(/…/g, '...').replace(/•/g, '*').replace(/·/g, '.')
        // Strip ALL remaining non-ASCII (no exceptions)
        .replace(/[^\x00-\x7F]/g, '');

    /* shared helpers */
    const drawPageFooter = (doc: jsPDF, PW: number, M: number) => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
      doc.line(M, ph - 9, PW - M, ph - 9);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
      doc.text('PCCOER Education Platform  ·  Auto-generated', PW / 2, ph - 5, { align: 'center' });
      doc.text(`Page ${doc.getNumberOfPages()}`, PW - M, ph - 5, { align: 'right' });
      doc.text('Created by Mr. Suraj Zalke', M, ph - 5);
    };
    const drawBrandHeader = (doc: jsPDF, PW: number, M: number, sub: string) => {
      doc.setFillColor(30, 27, 75); doc.rect(0, 0, PW, 30, 'F');
      try { doc.addImage('/msplogo.jpg', 'JPEG', M, 3, 22, 22); } catch (_) {}
      doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('PCCOER EDUCATION PLATFORM', PW / 2, 11, { align: 'center' });
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(199, 210, 254);
      doc.text(sub, PW / 2, 19, { align: 'center' });
      doc.text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), PW / 2, 25, { align: 'center' });
    };

    /* ── PDF 1: EXAM PAPER (questions only + answer key at end) ─── */
    const generateExamPaperPDF = async () => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M  = 14;

      drawBrandHeader(doc, PW, M, `Exam Paper  ·  ${quiz.title}`);

      let y = 34;
      // Exam info box
      doc.setFillColor(243, 244, 246); doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3);
      doc.rect(M, y, PW - M * 2, 22, 'FD');
      [['Subject', quiz.subject||'—'], ['Grade', quiz.grade||'—'], ['Topic', quiz.topic||'—']].forEach(([l,v],i)=>{
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
        doc.text(`${l}:`, M+3, y+6+i*6); doc.setFont('helvetica','normal'); doc.text(String(v), M+26, y+6+i*6);
      });
      [['Total Questions', String(quiz.questions.length)], ['Total Marks', String(totalMarks)]].forEach(([l,v],i)=>{
        const rx = PW/2+5;
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
        doc.text(`${l}:`, rx, y+6+i*6); doc.setFont('helvetica','normal'); doc.text(String(v), rx+33, y+6+i*6);
      });
      if (quiz.hasNegativeMarking) {
        doc.setFontSize(7.5); doc.setTextColor(220,38,38); doc.setFont('helvetica','bold');
        doc.text(`Negative Marking: -${quiz.negativeMarkingValue??25}% per wrong answer`, M+3, y+20);
      }
      y += 27;

      // Instructions bar
      doc.setFillColor(254,243,199); doc.rect(M, y, PW-M*2, 7, 'F');
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(146,64,14);
      doc.text('INSTRUCTIONS: Choose the best answer. Each Q carries the marks shown. Write only on answer sheet.', M+2, y+4.5);
      y += 11;

      // Questions loop
      quiz.questions.forEach((q, i) => {
        const qMarks = q.Marks || 1;
        const OPTS   = OPTS_LTR;
        const colW   = (PW - M * 2) / 2; // half-page column width for 2-col options

        // Sanitize question text and options for Helvetica font compatibility
        const qTextClean = sanitize(q.text);
        const optTexts   = q.options.map(opt => sanitize(opt.text));

        // Decide layout: 2-col if all options fit in half-width, else single-col
        const allShort = optTexts.every(t => {
          const lbl = `A)  `;
          return doc.getStringUnitWidth(lbl + t) * 9.5 / doc.internal.scaleFactor < colW - 10;
        });

        // Pre-compute option line arrays
        const optCols = optTexts.map((t, oi) => ({
          label: `${OPTS[oi]})`,
          lines: doc.splitTextToSize(t, allShort ? colW - 16 : PW - M * 2 - 16),
        }));

        // Estimate block height (using same values as render below)
        const qLines = doc.splitTextToSize(`${i+1}.  ${qTextClean}`, PW-M*2-10);
        let optH = 0;
        const ROW_H_EXAM = 4.8;
        if (allShort) {
          for (let p = 0; p < optCols.length; p += 2) {
            const left  = optCols[p]?.lines.length   || 0;
            const right = optCols[p+1]?.lines.length || 0;
            optH += Math.max(left, right) * ROW_H_EXAM + 0.5;
          }
        } else {
          optH = optCols.reduce((s, o) => s + o.lines.length * ROW_H_EXAM + 0.5, 0);
        }
        const blockH = qLines.length * 5.0 + 0.5 + optH + 3.5;

        if (y + blockH > PH - 16) { drawPageFooter(doc, PW, M); doc.addPage(); y = 14; }

        // ── Question number + text (bold) ──
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
        doc.text(qLines, M + 3, y);
        doc.setFontSize(7); doc.setTextColor(99, 102, 241);
        doc.text(`[${qMarks} mark${qMarks>1?'s':''}]`, PW-M-1, y, { align: 'right' });
        y += qLines.length * 5.0 + 0.5;

        // ── Options ──
        if (allShort) {
          // 2-column: A left, B right / C left, D right
          const rowH = ROW_H_EXAM;
          for (let p = 0; p < optCols.length; p += 2) {
            const left  = optCols[p];
            const right = optCols[p + 1];
            const maxLines = Math.max(left?.lines.length || 0, right?.lines.length || 0);

            // Left option
            if (left) {
              doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 41, 59);
              doc.text(`${left.label}`, M + 8, y);
              const lblW = doc.getTextWidth(`${left.label}  `);
              doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
              left.lines.forEach((line: string, li: number) => {
                doc.text(line, M + 8 + lblW, y + li * rowH);
              });
            }

            // Right option (starts at mid-page)
            if (right) {
              const rx = M + colW + 4;
              doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 41, 59);
              doc.text(`${right.label}`, rx, y);
              const lblW = doc.getTextWidth(`${right.label}  `);
              doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
              right.lines.forEach((line: string, li: number) => {
                doc.text(line, rx + lblW, y + li * rowH);
              });
            }

            y += maxLines * rowH + 0.5;
          }
        } else {
          // Single column
          optCols.forEach(({ label, lines }) => {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 41, 59);
            doc.text(label, M + 8, y);
            const lblW = doc.getTextWidth(`${label}  `);
            doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
            lines.forEach((line: string, li: number) => {
              doc.text(line, M + 8 + lblW, y + li * ROW_H_EXAM);
            });
            y += lines.length * ROW_H_EXAM + 0.5;
          });
        }
        y += 4; // gap between questions
      });
      drawPageFooter(doc, PW, M);

      // Answer key page
      doc.addPage(); y = 14;
      doc.setFillColor(30,27,75); doc.rect(0, 0, PW, 16, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont('helvetica','bold');
      doc.text('ANSWER KEY', PW/2, 11, { align: 'center' }); y = 22;
      doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(55,65,81);
      doc.text(quiz.title, PW/2, y, { align: 'center' }); y += 8;

      // Build rows: groups of up to 10
      const CHUNK = 10;
      const allGroups: { hdr: string[]; ans: string[] }[] = [];
      let hdr = ['Q'], ans = ['Ans'];
      quiz.questions.forEach((q, i) => {
        const ci = q.options.findIndex(o => o.id === q.correctOption);
        hdr.push(String(i+1)); ans.push(ci>=0 ? OPTS_LTR[ci] : '?');
        if (hdr.length === CHUNK+1 || i === quiz.questions.length-1) {
          allGroups.push({ hdr: [...hdr], ans: [...ans] });
          hdr = ['Q']; ans = ['Ans'];
        }
      });
      allGroups.forEach(g => {
        autoTable(doc, {
          startY: y, head: [g.hdr], body: [g.ans], theme: 'grid',
          styles: { fontSize: 9, cellPadding: {top:3,bottom:3,left:2,right:2}, halign: 'center', valign: 'middle', lineWidth: 0.2, lineColor: [209,213,219] },
          headStyles: { fillColor: [30,27,75], textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
          bodyStyles: { textColor: [22,163,74], fontStyle: 'bold', fontSize: 10 },
          columnStyles: { 0: { fillColor: [243,244,246], textColor: [55,65,81], fontStyle: 'bold' } },
          margin: { left: M, right: M },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      });
      drawPageFooter(doc, PW, M);
      doc.save(`${quiz.title.replace(/[^a-zA-Z0-9]/g, '_')}_ExamPaper.pdf`);
    };

    /* ── PDF 2: RESULT CARD (question-wise review) ─────────────────── */
    const generateResultPDF = async () => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();
      const M  = 12;

      const totalCorrect = quiz.questions.filter((q, i) => answers[i] === q.correctOption).length;
      const totalQs      = quiz.questions.length;
      const pct          = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
      const passed       = pct >= 35;

      drawBrandHeader(doc, PW, M, 'Quiz Result Card  ·  Digras');

      let y = 34;
      doc.setFillColor(243,244,246); doc.setDrawColor(209,213,219); doc.setLineWidth(0.3);
      doc.rect(M, y, PW-M*2, 18, 'FD');
      [['Student', nickname||'—'], ['Quiz', quiz.title]].forEach(([l,v],i)=>{
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
        doc.text(`${l}:`, M+3, y+6+i*7); doc.setFont('helvetica','normal');
        doc.text(doc.splitTextToSize(String(v), 70), M+(l==='Student'?22:17), y+6+i*7);
      });
      [['Total Questions', String(totalQs)], ['Total Marks', String(totalMarks)]].forEach(([l,v],i)=>{
        const rx = PW/2+5;
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
        doc.text(`${l}:`, rx, y+6+i*7); doc.setFont('helvetica','normal'); doc.text(String(v), rx+33, y+6+i*7);
      });
      y += 22;

      const boxW = (PW-M*2)/4;
      const boxes = [
        { label:'Score',      value:`${score}/${totalMarks}`, color:[99,102,241]   as [number,number,number] },
        { label:'Correct',    value:`${totalCorrect}/${totalQs}`, color:[34,197,94] as [number,number,number] },
        { label:'Percentage', value:`${pct}%`, color:(passed?[34,197,94]:[239,68,68]) as [number,number,number] },
        { label:'Result',     value:passed?'PASS':'FAIL', color:(passed?[34,197,94]:[239,68,68]) as [number,number,number] },
      ];
      boxes.forEach(({label,value,color},idx)=>{
        const bx = M+idx*boxW;
        doc.setFillColor(249,250,251); doc.setDrawColor(229,231,235); doc.setLineWidth(0.3);
        doc.roundedRect(bx, y, boxW-2, 20, 2,2,'FD');
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...color);
        doc.text(value, bx+(boxW-2)/2, y+11, { align:'center' });
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(107,114,128);
        doc.text(label, bx+(boxW-2)/2, y+17, { align:'center' });
      });
      y += 24;

      const barW = Math.max(0, Math.min(1, pct/100)) * (PW-M*2);
      doc.setFillColor(229,231,235); doc.roundedRect(M, y, PW-M*2, 5, 2,2,'F');
      doc.setFillColor(...(passed?[34,197,94]:[239,68,68]) as [number,number,number]);
      if (barW>0) doc.roundedRect(M, y, barW, 5, 2,2,'F');
      doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(55,65,81);
      doc.text(`${pct}% — ${passed?'PASS':'FAIL'}`, PW/2, y+3.5, { align:'center' });
      y += 10;

      doc.setFillColor(30,27,75); doc.rect(M, y, PW-M*2, 7, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(8.5); doc.setFont('helvetica','bold');
      doc.text('QUESTION-WISE REVIEW', PW/2, y+5, { align:'center' }); y += 10;

      const showExplanation = Boolean(quiz?.aiExplanationEnabled ?? ownerAiExplanationEnabled ?? false);

      const tableBody = quiz.questions.map((q, i) => {
        const sAns      = answers[i];
        const isCorrect = sAns === q.correctOption;
        const isBlank   = !sAns;
        const awarded   = isCorrect ? (q.Marks||1) : isBlank ? 0 : (quiz.hasNegativeMarking ? -((q.Marks||1)*((quiz.negativeMarkingValue??0)/100)) : 0);
        const ci = q.options.findIndex(o => o.id === q.correctOption);
        const si = q.options.findIndex(o => o.id === sAns);
        const cText = ci>=0 ? `${OPTS_LTR[ci]}) ${sanitize(q.options[ci].text)}` : '—';
        const sText = isBlank ? '—' : si>=0 ? `${OPTS_LTR[si]}) ${sanitize(q.options[si].text)}` : sAns;
        const status = isCorrect ? 'CORRECT' : isBlank ? 'BLANK' : 'WRONG';
        const marksStr = awarded>0 ? `+${awarded}` : String(awarded===0?'0':awarded);
        return { qNo:String(i+1), qText:sanitize(q.text), cText, sText, status, marksStr, isCorrect, isBlank, expl:showExplanation?(q.explanation||''):'' };
      });

      autoTable(doc, {
        startY: y,
        head: [['#','Question','Correct Answer','Your Answer','Status','Marks']],
        body: tableBody.map(r => [r.qNo, r.qText, r.cText, r.sText, r.status, r.marksStr]),
        theme: 'grid',
        styles: { fontSize:7.5, cellPadding:{top:2.5,bottom:2.5,left:2.5,right:2.5}, valign:'middle', lineWidth:0.2, lineColor:[209,213,219] },
        headStyles: { fillColor:[30,27,75], textColor:[255,255,255], fontStyle:'bold', halign:'center', fontSize:8 },
        columnStyles: {
          0: { cellWidth: 9,  halign:'center', fontStyle:'bold' },       // #
          1: { cellWidth: 60 },                                           // Question (wider)
          2: { cellWidth: 35, fontStyle:'bold' },                        // Correct Answer
          3: { cellWidth: 35, fontStyle:'bold' },                        // Your Answer
          4: { cellWidth: 20, halign:'center', fontStyle:'bold', fontSize:7 }, // Status
          5: { cellWidth: 13, halign:'center', fontStyle:'bold' },       // Marks
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          const row = tableBody[data.row.index]; if (!row) return;
          if (data.column.index===4) {
            if (row.isCorrect) data.cell.styles.textColor=[22,163,74];
            else if (row.isBlank) data.cell.styles.textColor=[217,119,6];
            else data.cell.styles.textColor=[220,38,38];
          }
          if (data.column.index===2) data.cell.styles.textColor=[22,163,74];
          if (data.column.index===3) {
            if (row.isCorrect) data.cell.styles.textColor=[22,163,74];
            else if (!row.isBlank) data.cell.styles.textColor=[220,38,38];
          }
          if (data.column.index===5) {
            const v = parseFloat(row.marksStr);
            data.cell.styles.textColor = v>0?[22,163,74]:v<0?[220,38,38]:[107,114,128];
          }
          if (row.isCorrect) data.cell.styles.fillColor=[240,253,244];
          else if (!row.isBlank) data.cell.styles.fillColor=[255,241,242];
        },
        alternateRowStyles: { fillColor:[248,250,252] },
        margin: { left:M, right:M },
        didDrawPage: () => drawPageFooter(doc, PW, M),
      });

      if (showExplanation) {
        const explRows = tableBody.filter(r => r.expl);
        if (explRows.length > 0) {
          doc.addPage();
          doc.setFillColor(30,27,75); doc.rect(0,0,PW,16,'F');
          doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont('helvetica','bold');
          doc.text('AI EXPLANATIONS', PW/2, 11, { align:'center' });
          autoTable(doc, {
            startY:22, head:[['Q','Question','AI Explanation']], body:explRows.map(r=>[r.qNo,r.qText,r.expl]),
            theme:'striped',
            styles:{ fontSize:7.5, cellPadding:{top:2.5,bottom:2.5,left:3,right:3}, valign:'top' },
            headStyles:{ fillColor:[99,102,241], textColor:[255,255,255], fontStyle:'bold', fontSize:8 },
            columnStyles:{ 0:{cellWidth:9,halign:'center',fontStyle:'bold'}, 1:{cellWidth:55}, 2:{cellWidth:'auto',fontStyle:'italic',textColor:[55,65,81]} },
            margin:{ left:M, right:M },
            didDrawPage: () => drawPageFooter(doc, PW, M),
          });
        }
      }
      doc.save(`${quiz.title.replace(/[^a-zA-Z0-9]/g,'_')}_Result.pdf`);
    };

    // ── PDF loading state handled at component top level (Rules of Hooks) ──

    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 p-4">
        <PdfDownloadOverlay visible={loading} />
        <LogoHeader />
        <Card className="w-full max-w-md rounded-xl shadow-2xl border border-purple-300/20 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90">
          <CardHeader className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
            <CardTitle className="text-center text-2xl font-bold">Quiz Completed! 🎉</CardTitle>
            {nickname && selectedAvatar && (
              <div className="flex items-center justify-center mt-2">
                <Avatar className="w-8 h-8 mr-2">
                  <img src={selectedAvatar} alt="Avatar" className="rounded-full" />
                </Avatar>
                <p className="text-sm font-semibold">{nickname}</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="text-center p-8">
            <div className="text-3xl font-bold mb-2 mt-4">Your Score</div>
            <div className="text-5xl font-bold mb-6 text-purple-700">
              {score} <span className="text-2xl text-gray-500">/ {totalMarks}</span>
            </div>
            {quiz.hasNegativeMarking && (
              <div className="mb-4 text-red-600 font-semibold text-sm">
                Negative marking was applied for wrong answers.
              </div>
            )}
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 mt-6">
              <Button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 py-2 rounded-full shadow-md"
              >
                Play Again
              </Button>
              <Button
                onClick={() => (window.location.href = '/')}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-5 py-2 rounded-full shadow-md"
              >
                Go Home
              </Button>
              <Button
                disabled={loading}
                onClick={() => withPdfLoading(generateExamPaperPDF)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2 rounded-full shadow-md disabled:opacity-60"
              >
                📄 Exam Paper PDF
              </Button>
              <Button
                disabled={loading}
                onClick={() => withPdfLoading(generateResultPDF)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-5 py-2 rounded-full shadow-md disabled:opacity-60"
              >
                🧾 Result Card PDF
              </Button>
            </div>
          </CardContent>
        </Card>
        <LiveLeaderboard quizId={paramId!} currentPlayerId={playerId} />
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 p-4">
      <VIPAdminEntryAnimation
        show={showVIPPlay}
        adminNickname={nickname || 'VIVEK SIR'}
        onDone={() => setShowVIPPlay(false)}
      />

      <Card className="w-full max-w-2xl rounded-xl shadow-2xl border border-purple-300/20 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90">
        <CardHeader className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
          <CardTitle className="text-2xl font-bold">{quiz.title}</CardTitle>
          <p className="text-sm text-white/80">
            Question {currentQuestionIndex + 1} of {quiz.questions.length}
          </p>
        </CardHeader>
        <CardContent>
          <QuestionDisplay
            question={currentQuestion}
            onAnswer={handleAnswerSelect}
            showCorrectAnswer={hasAnswered || timeLeft === 0}
            selectedAnswer={selectedAnswer}
            timeLeft={timeLeft}
            disableOptions={hasAnswered || timeLeft === 0}
            aiExplanationEnabled={Boolean(quiz?.aiExplanationEnabled ?? ownerAiExplanationEnabled ?? false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex justify-start mt-4"
          >
            <Button
              onClick={handleNextQuestion}
              disabled={!hasAnswered && timeLeft !== 0}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium px-6 py-2 rounded-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {nextButtonText}
            </Button>
          </motion.div>
        </CardContent>
      </Card>
      {/* Live leaderboard during quiz — shows other players' scores in real time */}
      <LiveLeaderboard quizId={paramId!} currentPlayerId={playerId} />
    </div>
  );
};

export default PlayQuizPage;

