import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ChevronDown, ChevronRight, FileText, Globe, Menu, Sparkles, Users, Video, PlusCircle, BookOpen, Play, Award, Plus, Home, LogOut, Trash2, Clock, Brain, Calendar, MessageCircle, Scan, Zap, TrendingUp, Activity, Star, Filter, Search, BarChart2, History, Share2, Youtube, Palette, X, ArrowUpRight, MoreHorizontal, Clock3, Eye, Download, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import Logo from "@/components/Logo";
import QuizCard from "@/components/QuizCard";
import { useGame } from "@/contexts/GameContext";
import { Quiz, ScienceSubject } from "@/types";
import { scienceSubjects } from "@/utils/gameUtils";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import StudentManagement, { ADMIN_UID } from '@/components/StudentManagement';
import YouTubeVideoManagement from '@/components/YouTubeVideoManagement';
import { motion, AnimatePresence } from 'framer-motion';
import { sendScoresToAllStudents, type PlayerScore } from '@/services/whatsappService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import BackgroundContainer from "@/components/BackgroundContainer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ProfileSetup from "@/components/ProfileSetup";
import { ref as databaseRef, remove, update } from "firebase/database";
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebaseConfig';
import { v4 as uuidv4 } from 'uuid';
import { generateSingleExplanation, generateQuizExplanations, QuestionForExplanation } from '@/services/aiExplanationService';
import AIExplanationStatus from "@/components/ui/AIExplanationStatus";
import { Badge } from "@/components/ui/badge";
import { SharedQuizResultsActions } from "@/components/SharedQuizResultsActions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatCard from "@/components/ui/StatCard";
import OrbitBackground from "@/components/ui/OrbitBackground";

// Heavy tabs — loaded only when the user clicks them (~7 MB saved on initial load)
const WhatsAppAdminDashboard    = lazy(() => import('@/components/WhatsAppAdminDashboard'));
const OMRScanner                = lazy(() => import('@/components/OMRScanner'));
const AdminPlayerManagementPage = lazy(() => import('./AdminPlayerManagementPage'));

async function getQuizById(quizId: string) {
  const quizRef = ref(database, `quizzes/${quizId}`);
  const snapshot = await get(quizRef);
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
}

interface GameHistory {
  id: string;
  quizTitle: string;
  startedAt: string;
  endedAt: string;
  playerCount: number;
  averageScore: number;
  players: Record<string, any>;
  quiz: Quiz | null;
}

interface SharedGameHistoryEntry {
  quiz: Quiz;
  quizId: string;
  quizTitle: string;
  players: Record<string, any>;
  createdBy: string;
}

const HostDashboardPage: React.FC = () => {
  useEffect(() => {
    document.body.classList.add('host-dashboard-page');
    return () => {
      document.body.classList.remove('host-dashboard-page');
    };
  }, []);
  const { currentUser, logout, loading } = useAuth();
  const { createGame, startGame } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<ScienceSubject[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set(['11', '12']));
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  // Sidebar folder selection: null = show recent quizzes, string = "grade|subject|topic" path
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [sharedQuizHistory, setSharedQuizHistory] = useState<Record<string, SharedGameHistoryEntry[]>>({});
  const [viewingQuizId, setViewingQuizId] = useState<string | null>(null);
  const [quizAudienceType, setQuizAudienceType] = useState<'college' | 'classes'>('college');
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);
  
  const [selectQuizDialogOpen, setSelectQuizDialogOpen] = useState(false);
  const [selectedQuizzesToDelete, setSelectedQuizzesToDelete] = useState<string[]>([]);
  const [oldQuizzes, setOldQuizzes] = useState<Quiz[]>([]);
  const [activeTab, setActiveTab] = useState("my-quizzes");
  const [viewPlayersDialogOpen, setViewPlayersDialogOpen] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, any> | null>(null);
  const [selectedQuizForPlayers, setSelectedQuizForPlayers] = useState<string>("");
  const [selectedQuizForViewPlayers, setSelectedQuizForViewPlayers] = useState<Quiz | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [whatsappSending, setWhatsappSending] = useState<string | null>(null);
  const [whatsappProgress, setWhatsappProgress] = useState<{ done: number; total: number } | null>(null);
  
  const [isGeneratingExplanations, setIsGeneratingExplanations] = useState(false);
  const [totalQuizzesNeedingExplanations, setTotalQuizzesNeedingExplanations] = useState(0);
  const [completedExplanations, setCompletedExplanations] = useState(0);
  const [showExplanationStatus, setShowExplanationStatus] = useState(false);
  const [showAudienceSelectionDialog, setShowAudienceSelectionDialog] = useState(false);
  const [aiExplanationEnabled, setAiExplanationEnabled] = useState(true);

  const [backgroundType, setBackgroundType] = useState<'default' | 'image'>('default');
  const [customBackground, setCustomBackground] = useState<string>('');

  const [selectedView, setSelectedView] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'questions'>('recent');

  const handleCreateGameClick = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    try {
      const gameRoom = await createGame(quiz, 'college');
      if (gameRoom) {
        toast({
          title: "Quiz Started",
          description: `${quiz.title} has started! Redirecting to game room...`,
          variant: "default"
        });
        navigate("/host-game-room");
      } else {
        toast({
          title: "Error",
          description: "Failed to create game room. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error starting quiz:", error);
      toast({
        title: "Error",
        description: "Failed to start quiz. Please try again.",
        variant: "destructive"
      });
    }
  };

  const confirmDeleteQuiz = (quizId: string) => {
    setQuizToDelete(quizId);
    setDeleteDialogOpen(true);
  };

  const handleSendWhatsAppReports = async (quizId: string, entries: SharedGameHistoryEntry[]) => {
    if (!entries[0]?.players) return;
    setWhatsappSending(quizId);
    setWhatsappProgress({ done: 0, total: 0 });

    try {
      const db = (await import('firebase/database')).getDatabase((await import('@/lib/firebaseConfig')).app);
      const { ref: fbRef, get: fbGet } = await import('firebase/database');
      const playersSnap = await fbGet(fbRef(db, 'players'));
      const mobileMap: Record<string, string> = {};
      if (playersSnap.exists()) {
        const all = playersSnap.val();
        for (const classId in all) {
          for (const rollNo in all[classId]) {
            const p = all[classId][rollNo];
            if (p.mobile) mobileMap[p.name?.toLowerCase().trim()] = p.mobile;
          }
        }
      }

      const rawPlayers = Object.values(entries[0].players) as any[];
      const sortedPlayers = [...rawPlayers].sort((a, b) => b.score - a.score);
      const maxScore = Math.max(...sortedPlayers.map(p => p.score), 0);

      const playerScores: PlayerScore[] = sortedPlayers.map((p, i) => {
        const correctCount = p.correctAnswersCount ?? (p.answers?.filter((a: any) => a.correct === true).length ?? 0);
        const totalQs = p.totalQuestions || entries[0].quiz?.questions?.length || 0;
        const acc = p.accuracy ?? (totalQs > 0 ? (correctCount / totalQs) * 100 : 0);
        return {
          name: p.nickname || 'Unknown',
          mobile: mobileMap[p.nickname?.toLowerCase().trim()] || '',
          rollNo: p.rollNo || '',
          score: p.score || 0,
          totalMarks: entries[0].quiz?.totalMarks || totalQs * 4,
          correct: correctCount,
          total: totalQs,
          accuracy: Number(acc.toFixed(1)),
          percentile: maxScore === 0 ? 1 : p.score >= maxScore ? 100 : Number(((p.score / maxScore) * 100).toFixed(1)),
          rank: i + 1,
          totalPlayers: sortedPlayers.length,
        };
      });

      const withMobile = playerScores.filter(p => p.mobile);
      setWhatsappProgress({ done: 0, total: withMobile.length });

      const quizTitle = entries[0].quizTitle || 'Quiz';
      const resolvedQuizId = entries[0].quizId || quizId;
      const quizLink = `${window.location.origin}/play-quiz/${resolvedQuizId}`;

      const result = await sendScoresToAllStudents(playerScores, quizTitle, quizLink, (done, total) => {
        setWhatsappProgress({ done, total });
      });

      toast({
        title: '✅ WhatsApp Reports Sent',
        description: `${result.sent} sent · ${result.failed} failed · ${result.skipped} skipped (no mobile)`,
      });
    } catch (err: any) {
      toast({ title: 'WhatsApp error', description: err.message, variant: 'destructive' });
    } finally {
      setWhatsappSending(null);
      setWhatsappProgress(null);
    }
  };

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadHostSettings = async () => {
      try {
        const profileRef = ref(database, `users/${currentUser.uid}/profile`);
        const snapshot = await get(profileRef);
        if (snapshot.exists()) {
          const profile = snapshot.val() || {};
          setAiExplanationEnabled(profile.aiExplanationEnabled ?? true);
        } else {
          setAiExplanationEnabled(true);
        }
      } catch (error) {
        console.error('Error loading host settings:', error);
        setAiExplanationEnabled(true);
      }
    };

    loadHostSettings();
  }, [currentUser?.uid]);

  useEffect(() => {
    const cleanupOldGames = async () => {
      if (!currentUser?.uid) return;

      try {
        const gamesRef = ref(database, 'games');
        const snapshot = await get(gamesRef);
        if (snapshot.exists()) {
          const gamesData = snapshot.val();
          const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);

          for (const gameId in gamesData) {
            const game = gamesData[gameId];
            if (game.hostId === currentUser.uid) {
              const startedAtTimestamp = new Date(game.startedAt).getTime();
              if (game.endedAt) {
                const endedAtTimestamp = new Date(game.endedAt).getTime();
                if (endedAtTimestamp < twoDaysAgo) {
                  console.log(`Deleting old ended game: ${gameId} (ended on ${game.endedAt})`);
                  await remove(ref(database, `games/${gameId}`));
                }
              } else if (startedAtTimestamp < twoDaysAgo) {
                console.log(`Deleting old unended game: ${gameId} (started on ${game.startedAt})`);
                await remove(ref(database, `games/${gameId}`));
              }
            }
          }
          const loadGameHistory = async () => {
            if (!currentUser?.uid) return;
            try {
              const gamesRef = ref(database, 'games');
              const snapshot = await get(gamesRef);
              if (snapshot.exists()) {
                const gamesData = snapshot.val();
                const userGames = Object.entries(gamesData)
                  .filter(([_, game]: [string, any]) => game.hostId === currentUser.uid)
                  .map(([id, game]: [string, any]) => ({
                    id,
                    quizTitle: game.quiz?.title || 'Untitled Quiz',
                    startedAt: game.startedAt || '',
                    endedAt: game.endedAt || '',
                    playerCount: Object.keys(game.players || {}).length,
                    averageScore: calculateAverageScore(game.players || {}),
                    players: game.players || {},
                    quiz: game.quiz || null
                  }))
                  .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
                setGameHistory(userGames);
              }
            } catch (error) {
              console.error('Error loading game history:', error);
            }
          };
          loadGameHistory();
        }
      } catch (error) {
        console.error('Error cleaning up old games:', error);
      }
    };

    cleanupOldGames();

    const loadSharedQuizHistory = async () => {
      try {
        const sharedQuizResultsRef = ref(database, 'sharedQuizResults');
        const snapshot = await get(sharedQuizResultsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const groupedHistory: Record<string, SharedGameHistoryEntry[]> = {};

          for (const quizId in data) {
            const quizData = data[quizId];
            const players = Object.values(quizData.players || {}).map((player: any) => ({
              ...player,
              avatar: player.avatar || ''
            }));

            if (Object.keys(players).length > 0) {
              const fullQuiz = await getQuizById(quizId);
              if (fullQuiz && currentUser && fullQuiz.createdBy === currentUser.uid) {
                if (!groupedHistory[quizId]) {
                  groupedHistory[quizId] = [];
                }
                groupedHistory[quizId].push({
                  quizId,
                  quizTitle: fullQuiz.title || 'Untitled Quiz',
                  players,
                  createdBy: fullQuiz.createdBy,
                  quiz: fullQuiz
                });
              }
            }
          }
          setSharedQuizHistory(groupedHistory);
        }
      } catch (error) {
        console.error('Error loading shared quiz history:', error);
      }
    };

    loadSharedQuizHistory();
  }, []);

  const calculateAverageScore = (players: any) => {
    if (!players || Object.keys(players).length === 0) return 0;
    const totalScore = Object.values(players).reduce((sum: number, player: any) => {
      return sum + (player.score || 0);
    }, 0);
    return Math.round((Number(totalScore) / Object.keys(players).length) * 100) / 100;
  };

  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser?.uid) return;
      try {
        const gamesRef = ref(database, 'games');
        const gamesSnapshot = await get(gamesRef);
        if (gamesSnapshot.exists()) {
          const gamesData = gamesSnapshot.val();
          const userGames = Object.entries(gamesData)
            .filter(([_, game]: [string, any]) => game.hostId === currentUser.uid)
            .map(([id, game]: [string, any]) => ({
              id,
              quizTitle: game.quiz?.title || 'Untitled Quiz',
              startedAt: game.startedAt || '',
              endedAt: game.endedAt || '',
              playerCount: Object.keys(game.players || {}).length,
              averageScore: calculateAverageScore(game.players || {}),
              players: game.players || {},
              quiz: game.quiz || null
            }))
            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
          setGameHistory(userGames);
        }

        const userProfileRef = ref(database, `users/${currentUser.uid}/profile`);
        const profileSnapshot = await get(userProfileRef);
        if (profileSnapshot.exists()) {
          const profileData = profileSnapshot.val();
          if (profileData.customBackground) {
            setCustomBackground(profileData.customBackground);
            setBackgroundType('image');
          } else {
            setBackgroundType('default');
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [currentUser?.uid]);

  useEffect(() => {
    setSubjects(scienceSubjects);
    
    const loadQuizzes = async () => {
      try {
        if (!currentUser?.uid) {
          if (!loading) {
            navigate("/host-login");
            toast({
              title: "Access Denied",
              description: "Please log in to view your quizzes.",
              variant: "destructive"
            });
          }
          return;
        }

        console.log('Loading quizzes for user:', currentUser.uid);
        const quizzesRef = ref(database, 'quizzes');
        const snapshot = await get(quizzesRef);
        
        let combinedQuizzes: Quiz[] = [];
        
        if (snapshot.exists()) {
          const firebaseData = snapshot.val() || {};
          const firebaseQuizzes = Object.entries(firebaseData).map(([key, quiz]: [string, any]): Quiz => {
            const questions = Array.isArray(quiz.questions) ? quiz.questions.map((q: any) => ({
              id: q.id || key + '_q' + Math.random().toString(36).substr(2, 9),
              text: q.text || '',
              options: Array.isArray(q.options) ? q.options.map((opt: any) => ({
                id: opt.id || key + '_opt' + Math.random().toString(36).substr(2, 9),
                text: opt.text || ''
              })) : [],
              correctOption: q.correctOption || '',
              Marks: typeof q.Marks === 'number' && !isNaN(q.Marks) ? q.Marks : 1,
              timeLimit: typeof q.timeLimit === 'number' && !isNaN(q.timeLimit) ? q.timeLimit : 30,
              imageUrl: typeof q.imageUrl === 'string' ? q.imageUrl : undefined,
              explanation: typeof q.explanation === 'string' ? q.explanation : undefined
            })) : [];

            const totalQuestions = questions.length;
            const totalMarks = questions.reduce((sum, q) => sum + (typeof q.Marks === 'number' ? q.Marks : 0), 0);

            return {
              id: quiz.id || key,
              title: typeof quiz.title === 'string' ? quiz.title : '',
              description: typeof quiz.description === 'string' ? quiz.description : '',
              subject: typeof quiz.subject === 'string' ? quiz.subject : '',
              grade: typeof quiz.grade !== 'undefined' ? String(quiz.grade).trim() : '11',
              topic: typeof quiz.topic === 'string' ? quiz.topic : undefined,
              createdBy: typeof quiz.createdBy === 'string' ? quiz.createdBy : '',
              createdAt: typeof quiz.createdAt === 'string' ? quiz.createdAt : new Date().toISOString(),
              questions,
              totalQuestions,
              totalMarks,
              hasNegativeMarking: typeof quiz.hasNegativeMarking === 'boolean' ? quiz.hasNegativeMarking : false,
              negativeMarkingValue: typeof quiz.negativeMarkingValue === 'number' ? quiz.negativeMarkingValue : 0,
              folderId: quiz.folderId || null
            };
          });
          
          combinedQuizzes = firebaseQuizzes.filter(quiz => quiz.createdBy === currentUser.uid);
        }
        
        setQuizzes(combinedQuizzes);
      } catch (error) {
        console.error("Error loading quizzes:", error);
        toast({
          title: "Error",
          description: "Failed to load quizzes. Please try again.",
          variant: "destructive"
        });
      }
    };

    loadQuizzes();
  }, [currentUser?.uid, loading, navigate, toast, database]);

  const filteredQuizzes = quizzes.filter(quiz => {
    try {
      const matchesSearch = !searchQuery || 
        quiz.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quiz.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSubject = selectedSubject === "all" || 
        (quiz.subject && quiz.subject.toLowerCase() === selectedSubject.toLowerCase());
      
      const matchesGrade = selectedGrade === "all" || 
        (quiz.grade && String(quiz.grade).replace(/[^\d]/g, '') === selectedGrade);
      
      return matchesSearch && matchesSubject && matchesGrade;
    } catch (error) {
      console.error("Error filtering quiz:", error, quiz);
      return false;
    }
  }).sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortBy === 'name') {
      return a.title.localeCompare(b.title);
    } else {
      return (b.questions?.length || 0) - (a.questions?.length || 0);
    }
  });

  const groupedQuizzes = filteredQuizzes.reduce((acc, quiz) => {
    const grade = quiz.grade || "Uncategorized";
    const subject = quiz.subject || "Uncategorized";
    const topic = quiz.topic || "Uncategorized";

    if (!acc[grade]) {
      acc[grade] = {};
    }
    if (!acc[grade][subject]) {
      acc[grade][subject] = {};
    }
    if (!acc[grade][subject][topic]) {
      acc[grade][subject][topic] = [];
    }
    acc[grade][subject][topic].push(quiz);
    return acc;
  }, {} as Record<string, Record<string, Record<string, Quiz[]>>>);

  const toggleGrade = (grade: string) => {
    setExpandedGrades(prev => {
      const newSet = new Set(prev);
      if (newSet.has(grade)) {
        newSet.delete(grade);
      } else {
        newSet.add(grade);
      }
      return newSet;
    });
  };

  const toggleSubject = (subject: string) => {
    setExpandedSubjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subject)) {
        newSet.delete(subject);
      } else {
        newSet.add(subject);
      }
      return newSet;
    });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      if (!currentUser?.uid) return;

      const quiz = quizzes.find(q => q.id === quizId);
      if (!quiz) return;

      await remove(ref(database, `/quizzes/${quizId}`));
      await remove(ref(database, `/users/${currentUser.uid}/quizzes/${quizId}`));

      setQuizzes(quizzes.filter(q => q.id !== quizId));
      
      toast({
        title: "Quiz Deleted",
        description: "Quiz has been deleted successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error deleting quiz:", error);
      toast({
        title: "Error",
        description: "Failed to delete quiz. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const prepareOldQuizzesForSelection = () => {
    try {
      if (!currentUser?.uid) return;
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const filteredOldQuizzes = quizzes.filter(quiz => {
        return quiz.createdAt && new Date(quiz.createdAt) < thirtyDaysAgo;
      });
      
      if (filteredOldQuizzes.length === 0) {
        toast({
          title: "No Old Quizzes",
          description: "There are no quizzes older than 30 days to select.",
          variant: "default"
        });
        return;
      }
      
      setOldQuizzes(filteredOldQuizzes);
      setSelectedQuizzesToDelete([]);
      setSelectQuizDialogOpen(true);
    } catch (error) {
      console.error("Error preparing old quizzes for selection:", error);
      toast({
        title: "Error",
        description: "Failed to prepare quizzes for selection. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteOldQuizzes = async () => {
    try {
      if (!currentUser?.uid) return;
      
      if (selectedQuizzesToDelete.length === 0) {
        toast({
          title: "No Quizzes Selected",
          description: "Please select at least one quiz to delete.",
          variant: "default"
        });
        return;
      }
      
      for (const quizId of selectedQuizzesToDelete) {
        try {
          await remove(ref(database, `/quizzes/${quizId}`));
          await remove(ref(database, `/users/${currentUser.uid}/quizzes/${quizId}`));
        } catch (error) {
          console.error(`Error deleting quiz ${quizId}:`, error);
        }
      }
      
      setQuizzes(quizzes.filter(quiz => !selectedQuizzesToDelete.includes(quiz.id)));
      setSelectQuizDialogOpen(false);
      setSelectedQuizzesToDelete([]);
      
      toast({
        title: "Selected Quizzes Deleted",
        description: `Successfully deleted ${selectedQuizzesToDelete.length} quizzes.`,
        variant: "default"
      });
    } catch (error) {
      console.error("Error deleting selected quizzes:", error);
      toast({
        title: "Error",
        description: "Failed to delete selected quizzes. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const toggleQuizSelection = (quizId: string) => {
    setSelectedQuizzesToDelete(prev => {
      if (prev.includes(quizId)) {
        return prev.filter(id => id !== quizId);
      } else {
        return [...prev, quizId];
      }
    });
  };

  const handleClearGameData = async () => {
    if (!currentUser?.uid) return;

    try {
      localStorage.removeItem("gameHistory");

      const gamesRef = ref(database, 'games');
      const gamesSnapshot = await get(gamesRef);
      if (gamesSnapshot.exists()) {
        const gamesData = gamesSnapshot.val();
        for (const gameId in gamesData) {
          if (gamesData[gameId].hostId === currentUser.uid) {
            await remove(ref(database, `games/${gameId}`));
          }
        }
      }

      setGameHistory([]);
      toast({
        title: "All User Data Cleared",
        description: "All your hosted games have been cleared successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error clearing game data:", error);
      toast({
        title: "Error",
        description: "Failed to clear game data. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleShareQuiz = async (quizId: string) => {
    const shareUrl = `${window.location.origin}/play-quiz/${quizId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Play Quiz',
          text: 'Join this quiz!',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: '🔗 Link Copied!',
          description: shareUrl,
          variant: 'default',
        });
      }
    } catch {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: '🔗 Link Copied!', description: shareUrl });
      } catch {
        toast({ title: 'Share Link', description: shareUrl });
      }
    }
  };

  const handleStartQuiz = async (quizId: string) => {
    if (!currentUser?.user_metadata?.name) {
      toast({
        title: "Profile Incomplete",
        description: "Please complete your profile before starting a quiz.",
        variant: "default",
      });
      navigate("/profile-setup");
      return;
    }
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz) {
      handleCreateGameClick(quiz);
    }
  };

  const handleClearSharedQuizHistory = async () => {
    if (!currentUser?.uid) {
      toast({
        title: 'Error',
        description: 'You must be logged in to clear shared quiz history.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const sharedQuizResultsRef = ref(database, 'sharedQuizResults');
      const snapshot = await get(sharedQuizResultsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        for (const quizId in data) {
          const fullQuiz = await getQuizById(quizId);
          if (fullQuiz && fullQuiz.createdBy === currentUser.uid) {
            await remove(ref(database, `sharedQuizResults/${quizId}`));
          }
        }
        toast({
          title: 'Success',
          description: 'Shared quiz history cleared successfully!',
        });
        setSharedQuizHistory({});
      }
    } catch (error) {
      console.error('Error clearing shared quiz history:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear shared quiz history. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleClearSharedQuizPlayers = async () => {
    if (!currentUser?.uid) {
      toast({
        title: 'Error',
        description: 'You must be logged in to clear shared quiz players.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const sharedQuizResultsRef = ref(database, 'sharedQuizResults');
      const snapshot = await get(sharedQuizResultsRef);
      if (snapshot.exists()) {
        const sharedQuizResults = snapshot.val();
        for (const quizId in sharedQuizResults) {
          const quizData = sharedQuizResults[quizId];
          const fullQuiz = await getQuizById(quizId);
          if (fullQuiz && fullQuiz.createdBy === currentUser.uid) {
            console.log(`Attempting to remove sharedQuizResults/${quizId}/players`);
            await remove(ref(database, `sharedQuizResults/${quizId}/players`));
            console.log(`Successfully removed sharedQuizResults/${quizId}/players`);
          }
        }
        toast({
          title: 'Success',
          description: 'Shared quiz players cleared successfully!',
        });
        setSharedQuizHistory({});
      }
    } catch (error) {
      console.error('Error clearing shared quiz players:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear shared quiz players. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAiExplanationToggle = async (checked: boolean) => {
    setAiExplanationEnabled(checked);
    if (!currentUser?.uid) return;

    try {
      await update(ref(database, `users/${currentUser.uid}/profile`), {
        aiExplanationEnabled: checked,
      });

      // Update ALL quizzes owned by this user in Firebase
      const batchUpdate: Record<string, boolean> = {};
      quizzes.forEach((quiz) => {
        if (quiz.createdBy === currentUser.uid) {
          batchUpdate[`quizzes/${quiz.id}/aiExplanationEnabled`] = checked;
        }
      });

      if (Object.keys(batchUpdate).length > 0) {
        await update(ref(database, '/'), batchUpdate);
      }

      // Update local state so UI reflects the change immediately
      setQuizzes(prev => prev.map(q => 
        q.createdBy === currentUser.uid ? { ...q, aiExplanationEnabled: checked } : q
      ));

      toast({
        title: checked ? 'AI Explanation Enabled' : 'AI Explanation Disabled',
        description: checked 
          ? 'AI explanations will be generated for new quizzes and shown in game rooms.' 
          : 'AI explanations are disabled. They will not be generated or displayed anywhere.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Failed to update AI explanation setting:', error);
      toast({
        title: 'Setting update failed',
        description: 'Unable to save the AI explanation preference right now.',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    logout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    navigate("/host-login");
    return null;
  }

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      'physics': 'from-blue-500 to-cyan-500',
      'chemistry': 'from-purple-500 to-pink-500',
      'biology': 'from-green-500 to-emerald-500',
      'mathematics': 'from-orange-500 to-red-500'
    };
    return colors[subject?.toLowerCase() as keyof typeof colors] || 'from-indigo-500 to-purple-500';
  };

  const getRecentQuizzes = () => {
    return [...quizzes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
  };

  const getTopPlayedQuizzes = () => {
    const quizPlayCount: Record<string, number> = {};
    gameHistory.forEach(game => {
      if (game.quiz) {
        quizPlayCount[game.quiz.id] = (quizPlayCount[game.quiz.id] || 0) + 1;
      }
    });
    
    return [...quizzes]
      .sort((a, b) => (quizPlayCount[b.id] || 0) - (quizPlayCount[a.id] || 0))
      .filter(q => (quizPlayCount[q.id] || 0) > 0)
      .slice(0, 5);
  };

  const getSubjectStats = () => {
    const stats: Record<string, { count: number, totalQuestions: number }> = {};
    quizzes.forEach(quiz => {
      const subject = quiz.subject || 'Uncategorized';
      if (!stats[subject]) {
        stats[subject] = { count: 0, totalQuestions: 0 };
      }
      stats[subject].count++;
      stats[subject].totalQuestions += quiz.questions?.length || 0;
    });
    return stats;
  };

  const subjectStats = getSubjectStats();
  const recentQuizzes = getRecentQuizzes();
  const topPlayedQuizzes = getTopPlayedQuizzes();

  return (
    <BackgroundContainer 
      backgroundImage={backgroundType === 'image' ? customBackground : undefined}
      backgroundStyle={backgroundType === 'image' ? 'image' : 'gradient'}
    >
      <div className="min-h-screen flex flex-col w-full overflow-x-hidden">
        <header className="relative overflow-hidden bg-white/5 backdrop-blur-xl border-b border-white/10">
          <OrbitBackground />
          <div className="container relative z-10 mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Logo />
                <div className="hidden md:flex items-center gap-3">
                  <div className="avatar-ring">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={currentUser.user_metadata?.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600">
                        {currentUser.user_metadata?.name?.charAt(0)?.toUpperCase() || 'H'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="text-white font-medium font-display">{currentUser.user_metadata?.name || 'Host'}</p>
                    <p className="text-gray-400 text-xs">Host Dashboard</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  <Brain className={`h-4 w-4 ${aiExplanationEnabled ? 'text-cyan-300' : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${aiExplanationEnabled ? 'text-cyan-200' : 'text-gray-500'}`}>
                    AI Explanation {aiExplanationEnabled ? '✨' : '(Off)'}
                  </span>
                  <Switch
                    checked={aiExplanationEnabled}
                    onCheckedChange={handleAiExplanationToggle}
                    className={aiExplanationEnabled ? 'data-[state=checked]:bg-cyan-500' : ''}
                  />
                </div>

                <Button
                  variant="ghost"
                  className="hidden md:flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/10"
                  onClick={() => navigate("/")}
                >
                  <Home className="h-4 w-4" />
                  Home
                </Button>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="hidden md:flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/10">
                      <Palette className="h-4 w-4" />
                      Customize
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-gray-900/95 backdrop-blur-xl border border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle>Customize Background</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Personalize your dashboard background
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <RadioGroup
                        value={backgroundType}
                        onValueChange={(value: 'default' | 'image') => setBackgroundType(value)}
                        className="space-y-3"
                      >
                        <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                          <RadioGroupItem value="default" id="bg-default" className="border-gray-500" />
                          <Label htmlFor="bg-default" className="text-white">Default Gradient Background</Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                          <RadioGroupItem value="image" id="bg-image" className="border-gray-500" />
                          <Label htmlFor="bg-image" className="text-white">Custom Image Background</Label>
                        </div>
                      </RadioGroup>

                      {backgroundType === 'image' && (
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="custom-bg-url" className="text-white">Image URL</Label>
                            <Input
                              id="custom-bg-url"
                              type="url"
                              placeholder="Enter image URL"
                              value={customBackground}
                              onChange={(e) => setCustomBackground(e.target.value)}
                              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                            />
                          </div>
                          
                          {customBackground && (
                            <div className="mt-4">
                              <p className="text-white text-sm mb-2">Preview:</p>
                              <div className="h-32 rounded-lg overflow-hidden" style={{ backgroundImage: `url(${customBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                            </div>
                          )}
                          
                          <Button 
                            onClick={() => {
                              if (currentUser) {
                                update(databaseRef(database, `users/${currentUser.uid}/profile`), { customBackground });
                                toast({ title: "Background Updated" });
                              }
                            }}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                          >
                            Save Background
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>

                <div className="md:hidden">
                  <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white">
                        <Menu className="h-6 w-6" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="bg-gray-900/95 backdrop-blur-xl border-r border-white/10">
                      <nav className="flex flex-col gap-4 p-4">
                        <Logo />
                        <Button
                          variant="ghost"
                          className="justify-start text-gray-300 hover:text-white"
                          onClick={() => {
                            navigate("/");
                            setMobileNavOpen(false);
                          }}
                        >
                          <Home className="h-4 w-4 mr-2" />
                          Home
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            handleLogout();
                            setMobileNavOpen(false);
                          }}
                          className="justify-start border-white/10 text-gray-300 hover:text-white"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </Button>
                      </nav>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1 container mx-auto px-6 py-8 w-full">
          {/* Dashboard Header with Stats */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div className="text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1 mb-3">
                  <Sparkles className="h-3 w-3" /> Science Learning Command Center
                </span>
                <h1 className="lab-heading text-3xl md:text-4xl lg:text-5xl mb-2">
                  Dashboard
                </h1>
                <p className="text-gray-400 text-base md:text-lg">Welcome back, {currentUser.user_metadata?.name || 'Host'}</p>
              </div>
              
              <div className="flex justify-center md:justify-start gap-3 w-full md:w-auto">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className="w-full md:w-auto"
                >
                  <Button 
                    onClick={() => navigate("/create-quiz")}
                    className="w-full md:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-purple-500/25 py-3 md:py-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Quiz
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<BookOpen className="h-5 w-5" />}
                label="Total Quizzes"
                value={quizzes.length}
                helperText={`+${quizzes.filter(q => new Date(q.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week`}
                gradient="from-indigo-500/10 to-purple-500/10"
                borderClass="border-indigo-500/20"
                iconGradient="from-indigo-500 to-purple-600"
                accentText="text-indigo-300"
                delay={0.1}
              />

              <StatCard
                icon={<Activity className="h-5 w-5" />}
                label="Games Hosted"
                value={gameHistory.length}
                helperText={`+${gameHistory.filter(g => new Date(g.startedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week`}
                gradient="from-blue-500/10 to-cyan-500/10"
                borderClass="border-blue-500/20"
                iconGradient="from-blue-500 to-cyan-500"
                accentText="text-blue-300"
                delay={0.2}
              />

              <StatCard
                icon={<FileText className="h-5 w-5" />}
                label="Total Questions"
                value={quizzes.reduce((sum, q) => sum + (q.questions?.length || 0), 0)}
                helperText={`across ${quizzes.length} quizzes`}
                helperPositive={false}
                gradient="from-emerald-500/10 to-green-500/10"
                borderClass="border-emerald-500/20"
                iconGradient="from-emerald-500 to-green-600"
                accentText="text-emerald-300"
                delay={0.3}
              />

              <StatCard
                icon={<Share2 className="h-5 w-5" />}
                label="Shared Quizzes"
                value={Object.keys(sharedQuizHistory).length}
                helperText="with students"
                helperPositive={false}
                gradient="from-purple-500/10 to-pink-500/10"
                borderClass="border-purple-500/20"
                iconGradient="from-purple-500 to-pink-500"
                accentText="text-purple-300"
                delay={0.4}
              />
            </div>
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="mb-6 lab-panel p-1.5 overflow-x-auto md:overflow-x-visible flex-nowrap md:flex-wrap gap-2">
              {[
                { value: 'my-quizzes', label: 'My Quizzes', icon: <BookOpen className="w-4 h-4" /> },
                { value: 'game-history', label: 'Game History', icon: <History className="w-4 h-4" /> },
                { value: 'shared-quiz-history', label: 'Shared History', icon: <Share2 className="w-4 h-4" /> },
                { value: 'youtube-videos', label: 'YouTube', icon: <Youtube className="w-4 h-4" /> },
                { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="w-4 h-4" /> },
                { value: 'omr-scanner', label: 'OMR Scanner', icon: <Scan className="w-4 h-4" /> },
                ...(currentUser?.uid === ADMIN_UID ? [
                  { value: 'student-management', label: 'Top Students', icon: <Award className="w-4 h-4" /> },
                  { value: 'player-management', label: 'Players', icon: <Users className="w-4 h-4" /> },
                ] : []),
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium font-display transition-all duration-300 text-gray-300 hover:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:via-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/25 whitespace-nowrap shrink-0"
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="omr-scanner">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <Suspense fallback={<div className="flex items-center justify-center h-40 text-white/60">Loading OMR Scanner...</div>}>
                  <OMRScanner />
                </Suspense>
              </motion.div>
            </TabsContent>

            <TabsContent value="player-management">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <Suspense fallback={<div className="flex items-center justify-center h-40 text-white/60">Loading Player Management...</div>}>
                  <AdminPlayerManagementPage />
                </Suspense>
              </motion.div>
            </TabsContent>

            <TabsContent value="my-quizzes">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">

                {/* Recent Quizzes */}
                {recentQuizzes.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-yellow-400" />
                      <h2 className="text-xl font-bold text-white">Recent Quizzes</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recentQuizzes.map((quiz, index) => (
                        <motion.div key={quiz.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.07 }}>
                          <Card className="bg-white/5 border border-white/10 backdrop-blur-xl hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 group">
                            <CardHeader className="pb-3">
                              <Badge className={`bg-gradient-to-r ${getSubjectColor(quiz.subject)} mb-2 text-xs w-fit`}>{quiz.subject || 'General'}</Badge>
                              <CardTitle className="text-white text-base group-hover:text-indigo-300 transition-colors leading-snug">{quiz.title}</CardTitle>
                              <CardDescription className="text-gray-400 text-xs line-clamp-2 mt-1">{quiz.description || 'No description'}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{quiz.questions?.length || 0} Q</span>
                                <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Grade {quiz.grade}</span>
                                {quiz.topic && <span className="text-indigo-400/70 truncate">{quiz.topic}</span>}
                              </div>
                            </CardContent>
                            <CardFooter className="flex gap-2 pt-0">
                              <Button size="sm" onClick={() => handleStartQuiz(quiz.id)} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs"><Play className="h-3.5 w-3.5 mr-1" />Start</Button>
                              <Button size="sm" variant="outline" onClick={() => navigate('/create-quiz', { state: { quizId: quiz.id } })} className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10 text-xs">Edit</Button>
                              <Button size="sm" variant="outline" onClick={() => handleShareQuiz(quiz.id)} className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10 text-xs px-2"><Share2 className="h-3.5 w-3.5" /></Button>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )}

                {/* All Quizzes: Sidebar + Panel */}
                <section>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-indigo-400" />
                      <h2 className="text-xl font-bold text-white">All Quizzes</h2>
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{filteredQuizzes.length}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[140px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
                        <Input placeholder="Search quizzes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 w-full h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
                      </div>
                      <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                        <SelectTrigger className="w-32 h-8 text-xs bg-white/5 border-white/10 text-white"><SelectValue placeholder="Subject" /></SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/10 text-white text-xs">
                          <SelectItem value="all">All Subjects</SelectItem>
                          {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                        <SelectTrigger className="w-24 h-8 text-xs bg-white/5 border-white/10 text-white"><SelectValue placeholder="Grade" /></SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/10 text-white text-xs">
                          <SelectItem value="all">All Grades</SelectItem>
                          <SelectItem value="11">Grade 11</SelectItem>
                          <SelectItem value="12">Grade 12</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={sortBy} onValueChange={setSortBy as any}>
                        <SelectTrigger className="w-24 h-8 text-xs bg-white/5 border-white/10 text-white"><SelectValue placeholder="Sort" /></SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/10 text-white text-xs">
                          <SelectItem value="recent">Recent</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="questions">Questions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {filteredQuizzes.length === 0 ? (
                    <Card className="bg-white/5 border border-white/10 backdrop-blur-xl">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <BookOpen className="h-16 w-16 text-gray-600 mb-4" />
                        <p className="text-gray-400 text-lg mb-1">No quizzes found</p>
                        <Button onClick={() => navigate('/create-quiz')} className="bg-gradient-to-r from-indigo-600 to-purple-600 mt-2"><Plus className="h-4 w-4 mr-2" />Create Quiz</Button>
                      </CardContent>
                    </Card>
                  ) : (() => {
                    const tree = filteredQuizzes.reduce((acc, quiz) => {
                      const g = quiz.grade || 'Uncategorized';
                      const s = quiz.subject || 'Uncategorized';
                      const t = quiz.topic || 'General';
                      if (!acc[g]) acc[g] = {};
                      if (!acc[g][s]) acc[g][s] = {};
                      if (!acc[g][s][t]) acc[g][s][t] = [];
                      acc[g][s][t].push(quiz);
                      return acc;
                    }, {} as Record<string, Record<string, Record<string, Quiz[]>>>);

                    let panelTitle = 'All Quizzes';
                    let panelQuizzes: Quiz[] = filteredQuizzes;
                    if (selectedFolderPath) {
                      const parts = selectedFolderPath.split('|||');
                      if (parts.length === 1) {
                        panelTitle = `Grade ${parts[0]}`;
                        panelQuizzes = filteredQuizzes.filter(q => (q.grade || 'Uncategorized') === parts[0]);
                      } else if (parts.length === 2) {
                        panelTitle = `${parts[1]} — Grade ${parts[0]}`;
                        panelQuizzes = filteredQuizzes.filter(q => (q.grade || 'Uncategorized') === parts[0] && (q.subject || 'Uncategorized') === parts[1]);
                      } else {
                        panelTitle = parts[2] === 'General' ? `${parts[1]} — Grade ${parts[0]}` : parts[2];
                        panelQuizzes = filteredQuizzes.filter(q => (q.grade || 'Uncategorized') === parts[0] && (q.subject || 'Uncategorized') === parts[1] && (q.topic || 'General') === parts[2]);
                      }
                    }

                    return (
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* ── Sidebar: on mobile = horizontal scrollable chips, on desktop = tree panel ── */}
                        <div className="lg:w-60 lg:shrink-0 lab-panel lg:overflow-hidden lg:flex lg:flex-col">

                          {/* Mobile: compact horizontal folder chip scroller */}
                          <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
                            <button
                              onClick={() => setSelectedFolderPath(null)}
                              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${!selectedFolderPath ? 'bg-indigo-600/40 border-indigo-400/60 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
                            >
                              <BookOpen className="h-3 w-3" /> All <span className="text-[10px] opacity-60">{filteredQuizzes.length}</span>
                            </button>
                            {Object.entries(tree).sort(([a],[b])=>a.localeCompare(b)).map(([grade, subs]) => {
                              const gCount = Object.values(subs).reduce((t,tops)=>t+Object.values(tops).reduce((tt,qs)=>tt+qs.length,0),0);
                              const gKey = grade;
                              return (
                                <div key={grade} className="contents">
                                  <button
                                    onClick={() => setSelectedFolderPath(gKey)}
                                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedFolderPath===gKey ? 'bg-indigo-600/40 border-indigo-400/60 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
                                  >
                                    <span>Gr {grade}</span><span className="text-[10px] opacity-60">{gCount}</span>
                                  </button>
                                  {Object.entries(subs).sort(([a],[b])=>a.localeCompare(b)).map(([subj, tops]) => {
                                    const sk = `${grade}|||${subj}`;
                                    const sCount = Object.values(tops).reduce((t,qs)=>t+qs.length,0);
                                    return (
                                      <button
                                        key={sk}
                                        onClick={() => setSelectedFolderPath(sk)}
                                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${selectedFolderPath===sk ? 'bg-purple-600/40 border-purple-400/60 text-purple-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
                                      >
                                        {subj}<span className="text-[10px] opacity-60">{sCount}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop: full tree panel */}
                          <div className="hidden lg:flex flex-col flex-1 overflow-hidden">
                            <button onClick={() => setSelectedFolderPath(null)} className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold font-display transition-all border-b border-white/5 ${!selectedFolderPath ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-600/20 text-cyan-300 border-l-2 border-l-cyan-400' : 'text-gray-300 hover:bg-white/5'}`}>
                              <BookOpen className="h-4 w-4 shrink-0" />
                              <span className="flex-1 text-left">All Quizzes</span>
                              <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{filteredQuizzes.length}</span>
                            </button>
                            <div className="overflow-y-auto flex-1 py-1">
                              {Object.entries(tree).sort(([a],[b])=>a.localeCompare(b)).map(([grade, subs]) => {
                                const gCount = Object.values(subs).reduce((t,tops)=>t+Object.values(tops).reduce((tt,qs)=>tt+qs.length,0),0);
                                const gExp = expandedGrades.has(grade);
                                return (
                                  <div key={grade}>
                                    <div className="flex items-center">
                                      <button onClick={()=>toggleGrade(grade)} className="p-1 pl-2 text-gray-500 hover:text-gray-300 shrink-0">{gExp?<ChevronDown className="h-3.5 w-3.5"/>:<ChevronRight className="h-3.5 w-3.5"/>}</button>
                                      <button onClick={()=>setSelectedFolderPath(grade)} className={`flex-1 flex items-center gap-1.5 px-1 py-2 text-sm font-medium truncate transition-all ${selectedFolderPath===grade?'text-indigo-300 bg-indigo-600/20':'text-gray-200 hover:bg-white/5'}`}>
                                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0 bg-gradient-to-br ${getSubjectColor(grade)} text-white`}>{grade.replace(/\D/g,'')||'U'}</div>
                                        <span className="truncate">Grade {grade}</span>
                                        <span className="ml-auto text-[10px] text-gray-600 pr-1">{gCount}</span>
                                      </button>
                                    </div>
                                    {gExp && Object.entries(subs).sort(([a],[b])=>a.localeCompare(b)).map(([subj, tops]) => {
                                      const sk = `${grade}|||${subj}`;
                                      const sCount = Object.values(tops).reduce((t,qs)=>t+qs.length,0);
                                      const sExp = expandedSubjects.has(sk);
                                      return (
                                        <div key={subj}>
                                          <div className="flex items-center pl-4">
                                            <button onClick={()=>{setExpandedSubjects(p=>{const n=new Set(p);n.has(sk)?n.delete(sk):n.add(sk);return n;})}} className="p-1 text-gray-600 hover:text-gray-400 shrink-0">{sExp?<ChevronDown className="h-3 w-3"/>:<ChevronRight className="h-3 w-3"/>}</button>
                                            <button onClick={()=>setSelectedFolderPath(sk)} className={`flex-1 flex items-center gap-1.5 px-1 py-1.5 text-xs font-medium truncate transition-all ${selectedFolderPath===sk?'text-indigo-300 bg-indigo-600/20':'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
                                              <span className="truncate capitalize">{subj}</span>
                                              <span className="ml-auto text-[10px] text-gray-600 pr-1">{sCount}</span>
                                            </button>
                                          </div>
                                          {sExp && Object.entries(tops).sort(([a],[b])=>a.localeCompare(b)).map(([topic, tqs]) => {
                                            const tk = `${grade}|||${subj}|||${topic}`;
                                            return (
                                              <button key={topic} onClick={()=>setSelectedFolderPath(tk)} className={`w-full flex items-center gap-2 pl-11 pr-3 py-1.5 text-xs truncate transition-all ${selectedFolderPath===tk?'text-indigo-300 bg-indigo-600/20 border-l-2 border-l-indigo-400':'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>
                                                <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0"/>
                                                <span className="truncate">{topic}</span>
                                                <span className="ml-auto text-[10px] text-gray-600">{tqs.length}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Main panel */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <h3 className="text-white font-semibold text-sm">{panelTitle}</h3>
                              <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{panelQuizzes.length}</span>
                            </div>
                            {selectedFolderPath && (
                              <button onClick={()=>setSelectedFolderPath(null)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                                <X className="h-3 w-3"/>Clear
                              </button>
                            )}
                          </div>
                          {panelQuizzes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 border border-dashed border-white/10 rounded-xl text-gray-600">
                              <BookOpen className="h-10 w-10 mb-2 opacity-30"/>
                              <p className="text-sm">No quizzes in this folder</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                              {panelQuizzes.map((quiz, index) => (
                                <motion.div key={quiz.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                                  <QuizCard
                                    quiz={quiz}
                                    folders={[]}
                                    onEditQuiz={(q) => navigate('/create-quiz', { state: { quizId: q.id } })}
                                    onDeleteQuiz={confirmDeleteQuiz}
                                    onShareQuiz={handleShareQuiz}
                                    onStart={handleStartQuiz}
                                    onSelectQuiz={(q) => navigate('/create-quiz', { state: { quizId: q.id } })}
                                    onMoveToFolder={() => {}}
                                  />
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </section>
              </motion.div>
            </TabsContent>

            <TabsContent value="game-history">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Game History</h2>
                  {gameHistory.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                          Clear All
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-gray-900 border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Clear Game History</AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-400">
                            Are you sure you want to clear all game history? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-0">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearGameData} className="bg-red-600 hover:bg-red-700">Clear</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {gameHistory.length === 0 ? (
                  <Card className="bg-white/5 border border-white/10 backdrop-blur-xl">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <History className="h-16 w-16 text-gray-500 mb-4" />
                      <p className="text-gray-400 text-lg">No games hosted yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {gameHistory.map((game, index) => (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="bg-white/10 border border-white/20 backdrop-blur-xl">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="text-white font-bold text-xl">{game.quizTitle}</h3>
                                <div className="flex items-center gap-6 mt-3 text-sm">
                                  <div className="flex items-center gap-2 text-indigo-300">
                                    <Users className="h-5 w-5" />
                                    <span className="font-semibold">{game.playerCount}</span>
                                    <span className="text-gray-400">players</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-green-300">
                                    <Award className="h-5 w-5" />
                                    <span className="font-semibold">Avg Score: {game.averageScore}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-300">
                                    <Clock className="h-5 w-5" />
                                    <span>{new Date(game.startedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedPlayers(game.players || {});
                                    setSelectedQuizForPlayers(game.quizTitle);
                                    setSelectedQuizForViewPlayers(game.quiz);
                                    setViewPlayersDialogOpen(true);
                                  }}
                                  className="border-white/20 text-white hover:bg-white/10"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Players
                                </Button>
                                <SharedQuizResultsActions
                                  quiz={game.quiz}
                                  players={Object.values(game.players || {})}
                                />
                                <Button
                                  onClick={() => {
                                    handleSendWhatsAppReports(game.id, [
                                      { 
                                        quiz: game.quiz, 
                                        quizId: game.id, 
                                        quizTitle: game.quizTitle, 
                                        players: game.players,
                                        createdBy: currentUser?.uid || ''
                                      }
                                    ]);
                                  }}
                                  disabled={whatsappSending === game.id}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                >
                                  {whatsappSending === game.id ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                      Sending... {whatsappProgress?.done}/{whatsappProgress?.total}
                                    </>
                                  ) : (
                                    <>
                                      <MessageCircle className="h-4 w-4 mr-2" />
                                      Send Reports
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="shared-quiz-history">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Shared Quiz History</h2>
                  {Object.keys(sharedQuizHistory).length > 0 && (
                    <div className="flex gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="border-white/10 text-gray-300 hover:text-white">
                            Clear Players
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-gray-900 border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Clear Players</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-400">
                              Are you sure you want to clear all players from shared quiz results?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-0">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearSharedQuizPlayers} className="bg-red-600 hover:bg-red-700">Clear</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                            Clear All
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-gray-900 border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Clear History</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-400">
                              Are you sure you want to clear all shared quiz history?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-0">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearSharedQuizHistory} className="bg-red-600 hover:bg-red-700">Clear</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {Object.keys(sharedQuizHistory).length === 0 ? (
                  <Card className="bg-white/5 border border-white/10 backdrop-blur-xl">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Share2 className="h-16 w-16 text-gray-500 mb-4" />
                      <p className="text-gray-400 text-lg">No shared quizzes yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(sharedQuizHistory).map(([quizId, entries], index) => (
                      <motion.div
                        key={quizId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="bg-white/10 border border-white/20 backdrop-blur-xl">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="text-white font-bold text-xl">{entries[0]?.quizTitle}</h3>
                                <p className="text-gray-400 text-sm mt-1">
                                  {Object.values(entries[0]?.players || {}).length} students attempted
                                </p>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedPlayers(entries[0]?.players || {});
                                    setSelectedQuizForPlayers(entries[0]?.quizTitle || '');
                                    setSelectedQuizForViewPlayers(entries[0]?.quiz);
                                    setViewPlayersDialogOpen(true);
                                  }}
                                  className="border-white/20 text-white hover:bg-white/10"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Players
                                </Button>
                                <SharedQuizResultsActions
                                  quiz={entries[0]?.quiz}
                                  players={Object.values(entries[0]?.players || {})}
                                />
                                <Button
                                  onClick={() => handleSendWhatsAppReports(quizId, entries)}
                                  disabled={whatsappSending === quizId}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                >
                                  {whatsappSending === quizId ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                      Sending... {whatsappProgress?.done}/{whatsappProgress?.total}
                                    </>
                                  ) : (
                                    <>
                                      <MessageCircle className="h-4 w-4 mr-2" />
                                      Send Reports
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="youtube-videos">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <YouTubeVideoManagement />
              </motion.div>
            </TabsContent>

            <TabsContent value="whatsapp">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <Suspense fallback={<div className="flex items-center justify-center h-40 text-white/60">Loading WhatsApp Dashboard...</div>}>
                  <WhatsAppAdminDashboard />
                </Suspense>
              </motion.div>
            </TabsContent>

            <TabsContent value="student-management">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <StudentManagement />
              </motion.div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Delete Quiz Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete this quiz? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (quizToDelete) {
                  handleDeleteQuiz(quizToDelete);
                }
                setDeleteDialogOpen(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Select Old Quizzes Dialog */}
      <AlertDialog open={selectQuizDialogOpen} onOpenChange={setSelectQuizDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-white/10 max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Select Quizzes to Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Select the quizzes older than 30 days that you want to delete
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2 my-4">
            {oldQuizzes.map(quiz => (
              <div key={quiz.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <input
                  type="checkbox"
                  checked={selectedQuizzesToDelete.includes(quiz.id)}
                  onChange={() => toggleQuizSelection(quiz.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800"
                />
                <div className="flex-1">
                  <p className="text-white font-medium">{quiz.title}</p>
                  <p className="text-gray-400 text-sm">{new Date(quiz.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteOldQuizzes}
              disabled={selectedQuizzesToDelete.length === 0}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              Delete Selected ({selectedQuizzesToDelete.length})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Players Dialog */}
      <Dialog open={viewPlayersDialogOpen} onOpenChange={setViewPlayersDialogOpen}>
        <DialogContent className="sm:max-w-4xl bg-gray-900/95 backdrop-blur-xl border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{selectedQuizForPlayers}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Players who attempted this quiz
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto">
            {selectedPlayers && Object.values(selectedPlayers).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white">Rank</TableHead>
                    <TableHead className="text-white">Name</TableHead>
                    <TableHead className="text-white">Score</TableHead>
                    <TableHead className="text-white">Correct</TableHead>
                    <TableHead className="text-white">Accuracy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(selectedPlayers)
                    .sort((a: any, b: any) => b.score - a.score)
                    .map((player: any, index) => (
                      <TableRow key={index} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-white font-semibold">
                          {index === 0 ? (
                            <span className="text-yellow-400">🥇 1st</span>
                          ) : index === 1 ? (
                            <span className="text-gray-300">🥈 2nd</span>
                          ) : index === 2 ? (
                            <span className="text-amber-600">🥉 3rd</span>
                          ) : (
                            `#${index + 1}`
                          )}
                        </TableCell>
                        <TableCell className="text-white">{player.nickname || 'Unknown'}</TableCell>
                        <TableCell className="text-green-400 font-semibold">{player.score || 0}</TableCell>
                        <TableCell className="text-indigo-400">
                          {(() => {
                            const correctCount = player.correctAnswersCount ?? (player.answers?.filter((a: any) => a.correct === true).length || 0);
                            const totalQuestions = selectedQuizForViewPlayers?.totalQuestions || selectedQuizForViewPlayers?.questions?.length || player.totalQuestions || 0;
                            const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
                            return (
                              <>
                                {correctCount} / {totalQuestions}
                              </>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-purple-400">
                          {(() => {
                            const correctCount = player.correctAnswersCount ?? (player.answers?.filter((a: any) => a.correct === true).length || 0);
                            const totalQuestions = selectedQuizForViewPlayers?.totalQuestions || selectedQuizForViewPlayers?.questions?.length || player.totalQuestions || 0;
                            const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
                            return (
                              <>
                                {typeof accuracy === 'number' 
                                  ? `${accuracy.toFixed(1)}%` 
                                  : 'N/A'}
                              </>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-16 w-16 text-gray-500 mb-4" />
                <p className="text-gray-400 text-lg">No players yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </BackgroundContainer>
  );
};

export default HostDashboardPage;
