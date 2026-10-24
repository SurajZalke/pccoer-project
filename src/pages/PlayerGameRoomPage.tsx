import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGame } from "@/contexts/GameContext";
import Logo from "@/components/Logo";
import { useIsMobile } from "@/hooks/use-mobile";
import { QuestionDisplay } from "@/components/QuestionDisplay";
import { Button } from "@/components/ui/button";
import BackgroundContainer from "@/components/BackgroundContainer";
import { AlertCircle, Award, Clock, Wifi, RefreshCw, CheckCircle, UserRound, LogIn, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import confetti from 'canvas-confetti';
import WaitingRoom from "@/components/WaitingRoom";
const CreatorAttribution = React.lazy(() => import("@/components/CreatorAttribution"));
import { Avatar, AvatarImage, AvatarFallback } from "@radix-ui/react-avatar";
import LeaderboardDisplay from "../components/LeaderboardDisplay";
import { motion, AnimatePresence } from 'framer-motion';
import VIPAdminEntryAnimation from "@/components/VIPAdminEntryAnimation";
import { listenVIPJoin, isVIPRoll, VIP_ADMIN_ROLL } from "@/utils/vipAdmin";
import { getOptimizedAvatarUrl } from "@/lib/imageOptimization";

import Picker from "@emoji-mart/react";
import { ref, push, onValue } from "firebase/database";
import { database } from '@/lib/firebaseConfig';

const warningSound = new Audio('/sounds/warning.mp3');

const useAudio = (url: string) => {
  const [audio] = useState(() => new Audio(url));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handleCanPlayThrough = () => setLoaded(true);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.load(); // Explicitly load the audio

    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [audio]);

  return { audio, loaded };
};


const PlayerGameRoomPage: React.FC = () => {
  const { activeGame, currentPlayer, currentQuestion, submitAnswer, refreshGameState, joinGame, questionStartTime, questionEnded, deductPlayerScore, removePlayer, serverTimeOffset } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connected");
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [showLeaderboardAnimation, setShowLeaderboardAnimation] = useState(false);
  const [confettiTriggered, setConfettiTriggered] = useState(false);
  const { audio: warningSound, loaded: isSoundLoaded } = useAudio('/sounds/warning.mp3');
  // VIP admin animation — shown to ALL players on entry
  const [showVIPSelf, setShowVIPSelf] = useState(false);
  const [vipAdminName, setVipAdminName] = useState("MR SURAJ ZALKE");
  const [vipShownRef] = useState({ shown: false });

  const [timeLeft, setTimeLeft] = useState(0);
  const [timerFrozenPlayer, setTimerFrozenPlayer] = useState(false);

  // Direct VIP detection from players list — no Firebase signal needed
  const vipFromListRef = React.useRef(false);
  useEffect(() => {
    if (!activeGame?.players || vipFromListRef.current) return;
    const players = Array.isArray(activeGame.players)
      ? activeGame.players
      : Object.values(activeGame.players as Record<string, any>);
    const vipPlayer = players.find((p: any) =>
      isVIPRoll(p.nickname || '') ||
      isVIPRoll(p.rollNo || '') ||
      p.isVIP === true
    );
    if (vipPlayer) {
      vipFromListRef.current = true;
      setVipAdminName("MR SURAJ ZALKE");
      setShowVIPSelf(true);
    }
  }, [activeGame?.players]);

  // Listen for VIP admin joining via Firebase broadcast — fires on ALL player screens
  useEffect(() => {
    if (!activeGame?.id) return;

    const gameId = activeGame.id;
    (async () => {
      try {
        const { getDatabase: gdb, ref: fr, get: fg } = await import('firebase/database');
        const snap = await fg(fr(gdb(), `games/${gameId}/vipJoinSignal`));
        if (snap.exists()) {
          const d = snap.val();
          if (d?.timestamp && Date.now() - d.timestamp < 15000) {
            setVipAdminName(d.name || "MR SURAJ ZALKE");
            setShowVIPSelf(true);
          }
        }
      } catch {}
    })();

    const unsub = listenVIPJoin(activeGame.id, (adminName) => {
      setVipAdminName(adminName);
      setShowVIPSelf(true);
    });
    return unsub;
  }, [activeGame?.id]);

  // Also show VIP animation if THIS player IS the VIP admin
  useEffect(() => {
    if (currentPlayer && !vipShownRef.shown) {
      const isVIP =
        isVIPRoll(currentPlayer.nickname || '') ||
        isVIPRoll((currentPlayer as any).rollNo || '');
      if (isVIP) {
        vipShownRef.shown = true;
        setShowVIPSelf(true);
      }
    }
  }, [currentPlayer, vipShownRef]);

  // Stop player timer immediately when host reveals answer (showScores = true)
  useEffect(() => {
    if ((activeGame as any)?.showScores === true) {
      setTimerFrozenPlayer(true);
    }
  }, [(activeGame as any)?.showScores]);

  // Reset frozen timer for each new question
  useEffect(() => {
    setTimerFrozenPlayer(false);
  }, [currentQuestion?.id]);

  useEffect(() => {
    // Don't run timer if frozen (host submitted)
    if (timerFrozenPlayer) return;

    let timer: number | undefined;
    if (activeGame?.status === "active" && currentQuestion && questionStartTime) {
      const now = Date.now() + serverTimeOffset;
      const elapsed = Math.floor((now - questionStartTime) / 1000);
      const remaining = currentQuestion.timeLimit - elapsed;
      setTimeLeft(Math.max(0, remaining));
      
      timer = window.setInterval(() => {
        const currentTime = Date.now() + serverTimeOffset;
        const elapsedTime = Math.floor((currentTime - questionStartTime) / 1000);
        const remainingTime = currentQuestion.timeLimit - elapsedTime;
        setTimeLeft(Math.max(0, remainingTime));

        if (remainingTime <= 0 && timer !== undefined) {
          clearInterval(timer);
        }
      }, 1000);
    }

    return () => { if (timer !== undefined) clearInterval(timer); };
  }, [activeGame?.status, currentQuestion, questionStartTime, serverTimeOffset, timerFrozenPlayer]);

  useEffect(() => {
    if (activeGame?.status === 'finished' && !confettiTriggered) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      setTimeout(() => confetti.clear(), 5000);
      setShowLeaderboardAnimation(true);
      setConfettiTriggered(true);
    }


  }, [activeGame?.status, confettiTriggered, questionEnded]);

  // Timer for scoreboard display and transition to leaderboard




  const cardRef = useRef<HTMLDivElement>(null);
  const [pollingActive, setPollingActive] = useState(true);

  // Effect to handle initial game state loading from URL params
  useEffect(() => {
    const gameIdFromUrl = searchParams.get("gameId");
    const playerIdFromUrl = searchParams.get("playerId");

    if (gameIdFromUrl && !activeGame) {
      // If there's a gameId in the URL but no active game in context,
      // attempt to re-join or refresh the game state.
      // Pass playerIdFromUrl to refreshGameState to help identify the player.
      refreshGameState(gameIdFromUrl, playerIdFromUrl);
    }
  }, [activeGame, searchParams, refreshGameState]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }, []);
  
  const resetTilt = useCallback(() => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
  }, []);
  
  // Game state is kept live by the onValue listener in GameContext.
  // We only do a single manual refresh on mount (e.g. after a page reload)
  // and set connection status based on that result.
  useEffect(() => {
    if (!pollingActive) return;
    let mounted = true;

    const doRefresh = async () => {
      try {
        await refreshGameState();
        if (mounted) setConnectionStatus("connected");
      } catch (error) {
        console.error("Error refreshing game state:", error);
        if (mounted) setConnectionStatus("connecting");
      }
    };

    doRefresh();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingActive]);
  
  const [gameStartedToastShown, setGameStartedToastShown] = useState(false);
  const [tabSwitchPenaltyApplied, setTabSwitchPenaltyApplied] = useState(false);

  // Handle game status transitions
  useEffect(() => {
    if (activeGame?.status === "active" && currentQuestion && !gameStartedToastShown) {
      // Game just started
      toast({
        title: "Game started!",
        description: "The quiz has begun",
      });
      setGameStartedToastShown(true);
    }
  }, [activeGame?.status, currentQuestion, toast, gameStartedToastShown]);

  // Effect to handle tab switching penalty
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && activeGame?.status === 'active') {
        if (!tabSwitchPenaltyApplied) {
          setTabSwitchPenaltyApplied(true);
          if (currentPlayer) {
            deductPlayerScore(currentPlayer.player_id, 4);
          }
          toast({
            title: "Warning!",
            description: "You switched tabs during the game. 4 points have been deducted.",
            variant: "destructive",
          });
        } else if (currentPlayer) {
          deductPlayerScore(currentPlayer.player_id, 4);
          removePlayer(currentPlayer.player_id);
          toast({
            title: "Removed from Game",
            description: "You have been removed from the game for repeatedly switching tabs.",
            variant: "destructive",
          });
          navigate('/join'); // Redirect player out of the game
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeGame?.status, currentPlayer, toast, tabSwitchPenaltyApplied]);
  
  const handleAnswerSubmit = (questionId: string, optionId: string) => {

    submitAnswer(questionId, optionId);
    
    // Confetti effect on answer submission
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    });
    
    toast({
      title: "Answer submitted!",
      description: "Your answer has been recorded.",
    });
  };
  
  const handleLeaveGame = () => {
    const leaveGameConfirmation = window.confirm("Are you sure you want to leave the game?");
    if (leaveGameConfirmation) {
      <button onClick={() => removePlayer(currentPlayer.player_id)}>
        Leave Game
      </button>
      removePlayer(currentPlayer.player_id);
      navigate("/");
      toast({
        title: "Left game",
        description: "You've successfully left the game",
      });
    }
  };
  
  const handleManualRefresh = () => {
    setConnectionStatus("connecting");
    refreshGameState();
    setTimeout(() => {
      setConnectionStatus("connected");
      toast({
        title: "Refreshed",
        description: "Game state updated",
      });
    }, 600);
  };

  const hasAnsweredCurrentQuestion = () => {
    if (!currentPlayer || !currentQuestion) return false;
    const answers = Array.isArray(currentPlayer.answers) ? currentPlayer.answers : [];
    return answers.some(a => a.questionId === currentQuestion.id);
  };
  
  // Get the player's selected answer for the current question
  const getSelectedAnswer = () => {
    if (!currentPlayer || !currentQuestion) return null;
    const answers = Array.isArray(currentPlayer.answers) ? currentPlayer.answers : [];
    const answer = answers.find(a => a.questionId === currentQuestion.id);
    return answer ? answer.selectedOption : null;
  };
  
  // --- Emoji Chat State ---
  const [emojiMessage, setEmojiMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiChat, setEmojiChat] = useState<any[]>([]);
  const [animatedEmojis, setAnimatedEmojis] = useState<{
    avatar: any;emoji: string, player: string, id: string
}[]>([]);
  const [emojiBan, setEmojiBan] = useState(false);
  const [emojiTimestamps, setEmojiTimestamps] = useState<number[]>([]);

  // Listen for emoji chat updates
  useEffect(() => {
    if (!activeGame?.id) return;
    const chatRef = ref(database, `games/${activeGame.id}/emojiChat`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val() || {};
      setEmojiChat(Object.values(data));
    });
    return () => unsubscribe();
  }, [activeGame?.id]);

  // Send emoji to Firebase
  const handleSendEmoji = async () => {
    if (emojiBan || !emojiMessage || !activeGame?.id || !currentPlayer) return;

    // Spam protection: max 5 emojis in 10 seconds
    const now = Date.now();
    const recent = emojiTimestamps.filter(ts => now - ts < 10000);
    if (recent.length >= 5) {
      setEmojiBan(true);
      setTimeout(() => setEmojiBan(false), 60000); // Ban for 1 minute
      setEmojiTimestamps([]);
      toast({
        title: "Emoji Ban",
        description: "You sent too many emojis! Wait 1 minute before sending more.",
        variant: "destructive",
      });
      return;
    }
    setEmojiTimestamps([...recent, now]);

    await push(ref(database, `games/${activeGame.id}/emojiChat`), {
      emoji: emojiMessage,
      player: currentPlayer.nickname,
      avatar: currentPlayer.avatar || "",
      timestamp: now,
    });
    setEmojiMessage("");
  };

  // Listen for new emoji messages and trigger animation
  useEffect(() => {
    if (!activeGame?.id) return;
    const chatRef = ref(database, `games/${activeGame.id}/emojiChat`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.entries(data).map(([id, msg]: any) => ({ ...msg, id }));
      setEmojiChat(arr);

      // Animate only the latest emoji
      if (arr.length > 0) {
        const last = arr[arr.length - 1];
        setAnimatedEmojis((prev) => [
          ...prev,
          { avatar: last.avatar, emoji: last.emoji, player: last.player, id: last.id }
        ]);
        // Remove after animation duration (e.g., 2.5s)
        setTimeout(() => {
          setAnimatedEmojis((prev) => prev.filter(e => e.id !== last.id));
        }, 2500);
      }
    });
    return () => unsubscribe();
  }, [activeGame?.id]);

  const renderContent = () => {
    const gameIdFromUrl = searchParams.get("gameId");

    if (!gameIdFromUrl) {
      navigate("/join");
      return null; // Redirecting, so nothing to render here
    }

    if (!activeGame) {
      console.log("PlayerGameRoomPage: activeGame is null. Displaying loading state.");
      return (
        <div className="text-center space-y-4">
          <p className="dark:text-gray-300">Loading game or game not found...</p>
          <div className="flex justify-center space-x-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      );
    }

    console.log("PlayerGameRoomPage: Current activeGame status:", activeGame.status);
    console.log("PlayerGameRoomPage: activeGame.players:", activeGame.players);
    console.log("PlayerGameRoomPage: activeGame.quiz:", activeGame.quiz);


    if (activeGame.status === "ended") {

      console.log("PlayerGameRoomPage: Game status is 'finished'. Navigating to LeaderAnimationPage.");
      navigate('/leader-animation', {
        state: {
          players: activeGame.players,
          activeQuiz: activeGame.quiz,
          currentQuestionIndex: activeGame.quiz.questions.length - 1, // Assuming last question index
          isHost: false, // Indicate that this is a player viewing the page
        }
      });
      return (
        <div className={`space-y-6 transition-opacity duration-1000 ${showLeaderboardAnimation ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-quiz-dark dark:text-white">
              Game Results
            </h2>
            <Button 
              onClick={() => navigate('/')} 
              className="quiz-btn-primary"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return Home
            </Button>
          </div>
          {activeGame.players && activeGame.quiz ? (
            <LeaderboardDisplay 
              players={activeGame.players}
              activeQuiz={activeGame.quiz}
              showScores={activeGame.showScores}
              hasHostSubmitted={activeGame.hostSubmitted}
            />
          ) : (
            <div className="text-center text-red-500 py-8 text-lg">
              Error: Player data or quiz data missing for leaderboard.
            </div>
          )}
        </div>
      );
    }

    if (activeGame.status === "waiting") {
      return (
        <WaitingRoom
          nickname={currentPlayer?.nickname || "Player"}
          players={activeGame.players}
          onStartGame={() => {}}
          cardRef={cardRef}
          handleMouseMove={handleMouseMove}
          resetTilt={resetTilt}
          gameCode={activeGame.code}
          gameId={activeGame.id}
          isHost={false}
          onRefreshPlayers={handleManualRefresh}
        />
      );
    }

    if (currentQuestion) {
      const disableOptions = hasAnsweredCurrentQuestion();
      // Show waiting spinner only if questionStartTime is missing
      if (!questionStartTime) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[200px]">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Waiting for host to start the question...</p>
          </div>
        );
      }

      // Host has revealed answer — show results + leaderboard screen
      const hostRevealed = (activeGame as any).showScores === true;
      // Determine if correct answer should show: either time ended OR host revealed
      const showCorrect = questionEnded || hostRevealed;
      // Determine my answer correctness for background change
      const myAnswer = getSelectedAnswer();
      const isMyAnswerCorrect = myAnswer && currentQuestion
        ? myAnswer === currentQuestion.correctOption
        : null;

      const playerQuestionClasses = hostRevealed
        ? isMyAnswerCorrect === true
          ? 'bg-gradient-to-br from-green-950 via-emerald-950 to-slate-950 rounded-2xl p-4'
          : isMyAnswerCorrect === false
            ? 'bg-gradient-to-br from-red-950 via-rose-950 to-slate-950 rounded-2xl p-4'
            : 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 rounded-2xl p-4'
        : '';

      return (
        <div className={`space-y-5 transition-all duration-700 ${playerQuestionClasses}`}>
          {/* Question progress header */}
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium dark:text-gray-300">
              <h2 className="text-2xl font-bold text-quiz-dark dark:text-white">
                Question {activeGame.currentQuestionIndex + 1} of {activeGame.quiz.questions.length}
              </h2>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className={`inline-block w-2 h-2 rounded-full ${connectionStatus === "connected" ? "bg-green-500" : "bg-amber-500 animate-pulse"}`}></span>
              <span className="dark:text-gray-300">{connectionStatus === "connected" ? "Connected" : "Connecting..."}</span>
            </div>
          </div>

          {/* Host revealed banner */}
          <AnimatePresence>
            {hostRevealed && (
              <motion.div
                key="revealed-banner"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`flex items-center justify-center gap-3 p-3 rounded-2xl font-black text-lg shadow-lg ${
                  isMyAnswerCorrect === true
                    ? 'bg-green-500/30 border-2 border-green-400 text-green-300'
                    : isMyAnswerCorrect === false
                      ? 'bg-red-500/30 border-2 border-red-400 text-red-300'
                      : 'bg-indigo-500/20 border border-indigo-400 text-indigo-300'
                }`}
              >
                {isMyAnswerCorrect === true && <><span className="text-2xl">🎉</span> Correct! +{currentQuestion.Marks} pts</>}
                {isMyAnswerCorrect === false && <><span className="text-2xl">😔</span> Wrong answer — see below!</>}
                {isMyAnswerCorrect === null && <><span className="text-2xl">⏱️</span> Time ended — answer revealed!</>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question display */}
          <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={resetTilt}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="transition-all duration-300"
          >
            {currentQuestion && (
              <QuestionDisplay
                question={currentQuestion}
                onAnswer={handleAnswerSubmit}
                disableOptions={hasAnsweredCurrentQuestion() || questionEnded || hostRevealed}
                showCorrectAnswer={showCorrect}
                timeLeft={timeLeft}
                selectedAnswer={getSelectedAnswer()}
                aiExplanationEnabled={Boolean(activeGame?.quiz?.aiExplanationEnabled ?? false)}
              />
            )}

            {questionEnded && !hostRevealed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 text-center p-4 rounded-2xl bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border border-indigo-500/30"
              >
                <div className="text-3xl mb-1">⏰</div>
                <h3 className="text-xl font-black text-white">Time's Up!</h3>
                <p className="text-gray-300 text-sm mt-1">Waiting for host to reveal answer...</p>
              </motion.div>
            )}
          </motion.div>

          {/* Answered — waiting indicator */}
          {hasAnsweredCurrentQuestion() && !questionEnded && !hostRevealed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/30 text-center"
            >
              <div className="text-2xl mb-1">✅</div>
              <p className="text-green-300 font-bold">Answer locked in!</p>
              <p className="text-gray-400 text-sm">Waiting for other players...</p>
              <div className="flex justify-center space-x-2 mt-2">
                {[0, 0.15, 0.3].map((d, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </motion.div>
          )}

          {currentPlayer && (
            <>
              {/* Player Score Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/30 shadow-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-10 h-10 border-2 border-indigo-400">
                      <AvatarImage src={currentPlayer?.avatar || getOptimizedAvatarUrl(currentPlayer?.nickname || 'default')} loading="lazy" decoding="async" />
                      <AvatarFallback>{typeof currentPlayer?.nickname === 'string' && currentPlayer.nickname.length > 0 ? currentPlayer.nickname.charAt(0).toUpperCase() : ''}</AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-gray-900" />
                  </div>
                  <div>
                    <p className="font-black text-white">{currentPlayer?.nickname}</p>
                    <p className="text-xs text-indigo-300">
                      {(() => {
                        const correctCount = Array.isArray(currentPlayer.answers)
                          ? currentPlayer.answers.filter((a: any) => a.correct).length : 0;
                        const total = Array.isArray(currentPlayer.answers) ? currentPlayer.answers.length : 0;
                        return total > 0 ? `${correctCount}/${total} correct` : 'Ready to play!';
                      })()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <motion.p
                    key={currentPlayer?.score}
                    initial={{ scale: 1.5, color: '#a5b4fc' }}
                    animate={{ scale: 1, color: '#ffffff' }}
                    transition={{ duration: 0.4 }}
                    className="text-3xl font-black text-white"
                  >
                    {currentPlayer?.score || 0}
                  </motion.p>
                  <p className="text-xs text-indigo-300">points</p>
                </div>
              </motion.div>

              {/* Leaderboard — revealed dramatically when host submits */}
              <AnimatePresence>
                {hostRevealed && (
                  <motion.div
                    key="leaderboard-reveal"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.15 }}
                  >
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xl">🏆</span>
                      <span className="text-lg font-black text-white">Leaderboard</span>
                    </div>
                    <LeaderboardDisplay
                      players={activeGame.players}
                      activeQuiz={activeGame.quiz}
                      showScores={true}
                      hasHostSubmitted={true}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Regular leaderboard before reveal */}
              {!hostRevealed && (
                <LeaderboardDisplay
                  players={activeGame.players}
                  activeQuiz={activeGame.quiz}
                  showScores={activeGame.showScores}
                  hasHostSubmitted={activeGame.hostSubmitted}
                />
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <div className="text-center space-y-4">
        <p className="dark:text-gray-300">Waiting for host to select the next question...</p>
        <div className="flex justify-center space-x-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    );
  };
  


  useEffect(() => {
    const unlock = () => {
      if (isSoundLoaded) {
        warningSound.play().catch(() => {});
        warningSound.pause();
        warningSound.currentTime = 0;
      }
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [isSoundLoaded, warningSound]);

  return (
    <BackgroundContainer>
      {/* VIP Admin Entry Animation — shows on ALL player screens when admin joins */}
      <VIPAdminEntryAnimation
        show={showVIPSelf}
        adminNickname={vipAdminName}
        onDone={() => setShowVIPSelf(false)}
      />

      <div className="min-h-screen flex flex-col items-center justify-start py-8 px-4 space-y-8">
        <Logo />
        
        <div className="w-full max-w-4xl space-y-6">
          {renderContent()}
        </div>
      </div>

      {/* Emoji Sharing UI */}
      <div className="mt-4 mb-2">
        <div className="flex items-center">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="mr-2 px-2 py-1 rounded bg-gray-200"
            title="Pick Emoji"
          >
            😊
          </button>
          {showEmojiPicker && (
            <div className="absolute z-50">
              <Picker
                onEmojiSelect={emoji => {
                  // emoji object has .native in emoji-mart v5+
                  setEmojiMessage((emoji as any).native);
                  setShowEmojiPicker(false);
                }}
                theme="dark"
              />
            </div>
          )}
          <input
            type="text"
            value={emojiMessage}
            onChange={e => setEmojiMessage(e.target.value)}
            placeholder="Send emoji..."
            className="border rounded px-2 py-1 w-24"
          />
          <button
            onClick={handleSendEmoji}
            className="ml-2 px-3 py-1 bg-purple-500 text-white rounded"
          >
            Send
          </button>
        </div>
      </div>

{animatedEmojis.map((item) => (
  <div
    key={item.id}
    className="emoji-fall-cool"
    style={{
      left: `${30 + Math.random() * 40}%`,
      animationDuration: "5s", // Slower animation (was 2.8s)
    }}
  >
    <div className="emoji-bounce-spin" style={{ fontSize: "1.25rem" }}>{item.emoji}</div>
    <div className="emoji-sender flex items-center justify-center gap-2">
      {item.avatar && (
        <img
          src={item.avatar}
          alt={item.player}
          width={20}
          height={20}
          loading="lazy"
          decoding="async"
          className="w-5 h-5 rounded-full border border-white shadow"
        />
      )}
      <span style={{ fontSize: "0.95rem" }}>{item.player}</span>
    </div>
  </div>
))}

      {/* Emoji Fall Animation CSS */}
      <style>{`
.emoji-fall-cool {
  position: fixed;
  top: -40px;
  font-size: 1.25rem;
  z-index: 9999;
  pointer-events: none;
  text-align: center;
  width: 48px;
  margin-left: -24px;
  filter: drop-shadow(0 2px 8px #0008);
  animation: emojiCoolFall 5s cubic-bezier(.4,1.5,.5,1) forwards; /* Slower */
  opacity: 0.95;
}
        }
        .emoji-fall-cool {
          position: fixed;
          top: -60px;
          font-size: 2.8rem;
          z-index: 9999;
          pointer-events: none;
          text-align: center;
          width: 120px;
          margin-left: -60px;
          filter: drop-shadow(0 4px 16px #0008);
          animation: emojiCoolFall 2.8s cubic-bezier(.4,1.5,.5,1) forwards;
          opacity: 0.95;
        }
        .emoji-bounce-spin {
          display: inline-block;
          animation: emojiBounceSpin 1.2s cubic-bezier(.68,-0.55,.27,1.55) 1;
          filter: drop-shadow(0 0 12px #fff8) drop-shadow(0 0 24px #a5b4fc);
        }
        .emoji-sender {
          font-size: 1.1rem;
          color: #fff;
          text-shadow: 0 2px 8px #000a, 0 0 2px #a5b4fc;
          font-weight: bold;
          letter-spacing: 0.5px;
          margin-top: 0.2em;
          animation: emojiSenderFade 2.2s ease;
        }
        @keyframes emojiCoolFall {
          0% {
            transform: translateY(-60px) scale(1.3) rotate(-20deg);
            opacity: 0.7;
            filter: blur(2px) drop-shadow(0 0 16px #a5b4fc);
          }
          20% {
            opacity: 1;
            filter: blur(0px) drop-shadow(0 0 24px #a5b4fc);
          }
          60% {
            transform: translateY(60vh) scale(1.7) rotate(12deg);
            opacity: 1;
            filter: blur(0px) drop-shadow(0 0 32px #a5b4fc);
          }
          90% {
            filter: blur(1px) drop-shadow(0 0 8px #a5b4fc);
          }
          100% {
            transform: translateY(85vh) scale(2.1) rotate(24deg);
            opacity: 0;
            filter: blur(4px) drop-shadow(0 0 0px #a5b4fc);
          }
        }
        @keyframes emojiBounceSpin {
          0% { transform: scale(0.7) rotate(-40deg);}
          40% { transform: scale(1.3) rotate(20deg);}
          70% { transform: scale(1.1) rotate(-10deg);}
          100% { transform: scale(1) rotate(0);}
        }
        @keyframes emojiSenderFade {
          0% { opacity: 0; transform: translateY(-10px);}
          20% { opacity: 1; transform: translateY(0);}
          90% { opacity: 1;}
          100% { opacity: 0; transform: translateY(10px);}
        }
      `}</style>
      <Suspense fallback={<div>Loading Creator Attribution...</div>}>
        <CreatorAttribution />
      </Suspense>
    </BackgroundContainer>
  );
};

export default PlayerGameRoomPage;