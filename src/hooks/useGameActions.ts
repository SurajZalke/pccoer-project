import { useCallback } from 'react';
import { GameRoom, Player, Quiz, Question } from '@/types';
import { database } from '@/lib/firebaseConfig';
import { ref, update, get as getDatabaseData, set, serverTimestamp } from 'firebase/database';
import { generateExplanation } from '@/services/aiExplanationService';
import { isBackendConfigured, sendQuizResultsToAll } from '@/services/whatsappWebService';

// ── Auto-send quiz results after game ends ────────────────────────────────────
// Fetches player phone numbers from Realtime DB players/{classId}/{rollNo},
// cross-references by nickname match, then sends scorecard + PDF via WhatsApp.
async function sendQuizResultsViaWhatsApp(game: GameRoom) {
  if (!isBackendConfigured()) return;

  const players = Array.isArray(game.players)
    ? game.players
    : Object.values(game.players || {});

  if (!players.length) return;

  const totalMarks = game.quiz?.questions?.reduce((s: number, q: any) => s + (q.Marks || 1), 0) || 100;
  const sorted = [...players].sort((a: any, b: any) => b.score - a.score);

  // Try to look up phone numbers from Realtime DB by matching nickname → name
  const allPlayersSnap = await getDatabaseData(ref(database, 'players')).catch(() => null);
  const allPlayersData: Record<string, Record<string, any>> = allPlayersSnap?.val() || {};

  // Build a flat name→{mobile, parentPhone} lookup across all classes
  const phoneMap: Record<string, { mobile?: string; parentPhone?: string }> = {};
  Object.values(allPlayersData).forEach((classPlayers: any) => {
    Object.values(classPlayers || {}).forEach((p: any) => {
      if (p.name) {
        phoneMap[p.name.toLowerCase().trim()] = {
          mobile: p.mobile || '',
          parentPhone: p.parentPhone || '',
        };
      }
    });
  });

  const payload = sorted.map((p: any, i: number) => {
    const lookup = phoneMap[p.nickname?.toLowerCase().trim()] || {};
    const correct = p.answers?.filter((a: any) => a.correct).length || 0;
    const total   = p.answers?.length || game.quiz?.totalQuestions || 0;
    return {
      nickname:     p.nickname || 'Student',
      score:        p.score || 0,
      totalMarks,
      correct,
      total,
      accuracy:     total > 0 ? (correct / total) * 100 : 0,
      percentile:   totalMarks > 0 ? ((p.score || 0) / totalMarks) * 100 : 0,
      rank:         i + 1,
      totalPlayers: sorted.length,
      phone:        lookup.mobile || '',
      parentPhone:  lookup.parentPhone || '',
      // Pass per-player answers so the backend can build the answer sheet
      answers:      Array.isArray(p.answers) ? p.answers : [],
    };
  }).filter(p => p.phone || p.parentPhone);

  if (!payload.length) return;

  await sendQuizResultsToAll({
    gameId:    game.id,
    quizId:    game.quiz?.id || game.id,   // so backend can fetch quiz questions
    quizTitle: game.quiz?.title || 'Quiz',
    players:   payload,
  });

  console.log(`[WhatsApp] Quiz results sent to ${payload.length} students`);
}

export const useGameActions = (
  activeGame: GameRoom | null,
  setActiveGame: (game: GameRoom | null) => void,
  currentPlayer: Player | null,
  currentQuestion: Question | null,
  currentQuiz: Quiz | null,
  questionStartTime: number | null,
  serverTimeOffset: number
) => {
  const startGame = useCallback(async () => {
    if (!activeGame || !currentQuiz) return;

    const gameRef = ref(database, `games/${activeGame.id}`);
    try {

      await update(gameRef, {
        status: 'active',
        currentQuestionIndex: 0,
        questionStartTime: Date.now() + serverTimeOffset,
      });

      // Explicitly clear all players' answers when the game starts
      const playersRef = ref(database, `games/${activeGame.id}/players`);
      const playersSnapshot = await getDatabaseData(playersRef);
      if (playersSnapshot.exists()) {
        const playersData = playersSnapshot.val();
        const updates: { [key: string]: any } = {};
        for (const playerId in playersData) {
          updates[`${playerId}/answers`] = [];
        }
        await update(playersRef, updates);
      }

      // Now, trigger explanation generation in the background
      // Do NOT await this call, so startGame can finish quickly
      generateMissingExplanations(currentQuiz.id, currentQuiz.questions)
        .catch(error => console.error("Background explanation generation failed:", error));

    } catch (error: any) {
      console.error('Error starting game in Realtime Database:', error);
    }
  }, [activeGame, currentQuiz, serverTimeOffset]);

  // Helper function to generate missing explanations in the background
  const generateMissingExplanations = useCallback(async (quizId: string, questions: Question[]) => {
    const updatedQuestions = [...questions];
    let needsUpdate = false;

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].explanation) {
        try {
          const exp = await generateExplanation(questions[i].text);
          updatedQuestions[i] = { ...questions[i], explanation: exp.toString() };
          needsUpdate = true;
        } catch (error) {
          console.error('Failed to generate explanation for question:', error);
        }
      }
    }

    if (needsUpdate) {
      const quizRef = ref(database, `quizzes/${quizId}`);
      await update(quizRef, { questions: updatedQuestions });
    }
  }, []);

  const endGame = useCallback(async () => {
    if (!activeGame) return;

    const gameRef = ref(database, `games/${activeGame.id}`);
    try {
      // Save final game state - only update specific fields, don't spread entire object
      const updates: any = {
        status: 'ended',
        endedAt: new Date().toISOString(),
      };

      // Update each player to include correctAnswersCount, totalQuestions, accuracy
      if (activeGame.players && Array.isArray(activeGame.players)) {
        activeGame.players.forEach((player) => {
          const correctAnswersCount = player.answers?.filter(a => a.correct).length || 0;
          const totalQuestions = activeGame.quiz?.totalQuestions || activeGame.quiz?.questions?.length || 0;
          const accuracy = totalQuestions > 0 ? (correctAnswersCount / totalQuestions) * 100 : 0;
          
          updates[`players/${player.player_id}/correctAnswersCount`] = correctAnswersCount;
          updates[`players/${player.player_id}/totalQuestions`] = totalQuestions;
          updates[`players/${player.player_id}/accuracy`] = Number(accuracy.toFixed(2));
        });
      }

      await update(gameRef, updates);

      // ── Auto-send quiz results via WhatsApp ──────────────────────────────
      // Fire-and-forget: don't block the UI while messages send
      sendQuizResultsViaWhatsApp(activeGame).catch(err =>
        console.warn('[WhatsApp] Auto-send results failed:', err.message)
      );

    } catch (error: any) {
      console.error('Error ending game in Realtime Database:', error);
      throw error; // Re-throw so caller knows there was an error
    }
  }, [activeGame]);

  const submitAnswer = useCallback(async (questionId: string, optionId: string) => {
    if (!currentPlayer || !currentQuestion || !activeGame || !currentQuiz) return;

    // Always fetch the latest questionStartTime from the database for accurate timing
    let latestQuestionStartTime = null;
    try {
      const gameRef = ref(database, `games/${activeGame.id}`);
      const gameSnapshot = await getDatabaseData(gameRef);
      let gameData = null;
      if (gameSnapshot.exists && typeof gameSnapshot.exists === 'function' ? gameSnapshot.exists() : gameSnapshot) {
        gameData = gameSnapshot.val ? gameSnapshot.val() : gameSnapshot;
        if (gameData && gameData.questionStartTime) {
          latestQuestionStartTime = gameData.questionStartTime;
        }
      }
    } catch (err) {
      // fallback to local questionStartTime if fetch fails
      latestQuestionStartTime = questionStartTime;
    }

    // If still not found, fallback to 0
    if (!latestQuestionStartTime) latestQuestionStartTime = 0;

    const isCorrect = optionId === currentQuestion.correctOption;
    const now = Date.now() + serverTimeOffset;
    const timeToAnswer = Math.max(0, Math.floor((now - latestQuestionStartTime) / 1000));

    let scoreChange = 0;
    if (isCorrect) {
      scoreChange = currentQuestion.Marks;
    } else if (currentQuiz.hasNegativeMarking) {
      scoreChange = -Math.floor(currentQuestion.Marks * currentQuiz.negativeMarkingValue / 100);
    }

    const newAnswer = {
      questionId,
      selectedOption: optionId,
      correct: isCorrect,
      timeToAnswer
    };

    // Update player's score and answers in Realtime Database
    const playerAnswersRef = ref(database, `games/${activeGame.id}/players/${currentPlayer.player_id}/answers`);
    const playerRef = ref(database, `games/${activeGame.id}/players/${currentPlayer.player_id}`);
    const gameRef = ref(database, `games/${activeGame.id}`); // Define gameRef here

    try {
      // Fetch current player data to get existing answers
      const playerSnapshot = await getDatabaseData(playerRef);
      const playerCurrentData = playerSnapshot.val() as Player;
      const existingAnswers = playerCurrentData.answers || [];

      // Append the new answer to the existing answers array
      const updatedAnswers = [...existingAnswers, newAnswer];

      // Calculate new streak
      let newStreak = playerCurrentData.streak || 0;
      if (isCorrect) {
        newStreak++;
      } else {
        newStreak = 0;
      }

      // Update player score, status, and streak
      await update(playerRef, {
        score: currentPlayer.score + scoreChange,
        status: 'answered',
        streak: newStreak,
        answers: updatedAnswers // Update answers directly on player object
      });

      // If the current player is the host, update hostSubmitted flag
      if (currentPlayer.player_id === activeGame.hostId) {
        await update(gameRef, {
          hostSubmitted: true
        });
      }

      // Check if all players have submitted their answers
      const gameSnapshot = await getDatabaseData(gameRef);
      const latestGame = gameSnapshot.val() as GameRoom;

      const allPlayersAnswered = latestGame.players.every(player => player.status === 'answered');

      if (allPlayersAnswered) {
        await update(gameRef, {
          showScores: true,
          lastAnsweredQuestion: currentQuestion.id
        });
      }

      // The refreshGameState in GameContext will handle updating the local state
      // based on the real-time subscription.
    } catch (playerUpdateError: any) {
      console.error('Error updating player score/answers in Realtime Database:', playerUpdateError);
    }
  }, [activeGame, currentPlayer, currentQuestion, currentQuiz]);

  const nextQuestion = useCallback(async () => {
    if (!activeGame || !currentQuiz) return;

    const nextIndex = activeGame.currentQuestionIndex + 1;

    if (nextIndex >= currentQuiz.questions.length) {
      try {
        await endGame();
      } catch (error: any) {
        console.error('Error calling endGame in nextQuestion:', error);
      }
    } else {
      // Update the current question index and reset player statuses in Firestore
      const gameRef = ref(database, `games/${activeGame.id}`);
      try {
        const updates: any = {
          currentQuestionIndex: activeGame.currentQuestionIndex + 1,
          questionStartTime: Date.now() + serverTimeOffset, // Use calculated server time
          showScores: false,
          hostSubmitted: false,
          status: 'active'
        };

        // Reset all players' status to 'waiting'
        if (activeGame.players && Array.isArray(activeGame.players)) {
          activeGame.players.forEach((player) => {
            updates[`players/${player.player_id}/status`] = 'waiting';
          });
        }

        await update(gameRef, updates);

        // The refreshGameState in GameContext will handle updating the local state
        // based on the real-time subscription.
      } catch (error: any) {
        console.error('Error updating question index in Realtime Database:', error);
      }
    }
  }, [activeGame, currentQuiz, endGame]);

  const deductPlayerScore = useCallback(async (playerId: string, pointsToDeduct: number) => {
    if (!activeGame) return;

    const playerRef = ref(database, `games/${activeGame.id}/players/${playerId}`);
    try {
      const snapshot = await getDatabaseData(playerRef);
      if (snapshot.exists()) {
        const currentPlayer = snapshot.val() as Player;
        const newScore = Math.max(0, currentPlayer.score - pointsToDeduct);
        await update(playerRef, { score: newScore });
        console.log(`Deducted ${pointsToDeduct} points from player ${playerId}. New score: ${newScore}`);
      }
    } catch (error) {
      console.error('Error deducting player score:', error);
    }
  }, [activeGame]);

  const removePlayer = useCallback(async (playerId: string) => {
    if (!activeGame) return;

    const gameRef = ref(database, `games/${activeGame.id}`);
    try {
      const snapshot = await getDatabaseData(gameRef);
      if (snapshot.exists()) {
        const gameData = snapshot.val() as GameRoom;
        const updatedPlayers = gameData.players.filter(player => player.player_id !== playerId);
        await update(gameRef, { players: updatedPlayers });
        console.log(`Player ${playerId} removed from game ${activeGame.id}`);
      }
    } catch (error) {
      console.error('Error removing player:', error);
    }
  }, [activeGame]);

  const setCorrectAnswer = useCallback(async (optionId: string, questionId: string | undefined) => {
    if (!activeGame || !currentQuestion || !currentPlayer) return;

    // Always fetch the latest questionStartTime from the database for accurate timing
    let latestQuestionStartTime = null;
    try {
      const gameRef = ref(database, `games/${activeGame.id}`);
      const gameSnapshot = await getDatabaseData(gameRef);
      let gameData = null;
      if (gameSnapshot.exists && typeof gameSnapshot.exists === 'function' ? gameSnapshot.exists() : gameSnapshot) {
        gameData = gameSnapshot.val ? gameSnapshot.val() : gameSnapshot;
        if (gameData && gameData.questionStartTime) {
          latestQuestionStartTime = gameData.questionStartTime;
        }
      }
    } catch (err) {
      // fallback to local questionStartTime if fetch fails
      latestQuestionStartTime = questionStartTime;
    }
    if (!latestQuestionStartTime) latestQuestionStartTime = 0;

    const timeToAnswer = Math.max(0, Math.floor((Date.now() - latestQuestionStartTime) / 1000));
    const isCorrect = optionId === currentQuestion.correctOption;

    // Create host's answer object
    const hostAnswer = {
      questionId,
      selectedOption: optionId,
      correct: isCorrect,
      timeToAnswer
    };

    // Update host's answers in the game
    const hostAnswersRef = ref(database, `games/${activeGame.id}/players/${currentPlayer.player_id}/answers`);
    const hostRef = ref(database, `games/${activeGame.id}/players/${currentPlayer.player_id}`);
    const gameRef = ref(database, `games/${activeGame.id}`);

    try {
      // Get existing answers
      const snapshot = await getDatabaseData(hostAnswersRef);
      const existingAnswers = snapshot.val() || [];
      const updatedAnswers = [...existingAnswers, hostAnswer];

      // Find host in players array
      const hostPlayer = activeGame.players.find(p => p.player_id === currentPlayer.player_id);
      const currentHostScore = hostPlayer?.score || 0;

      // Calculate host's score
      let scoreChange = 0;
      if (isCorrect) {
        const timeBonus = Math.max(0, (currentQuestion.timeLimit - timeToAnswer) / currentQuestion.timeLimit);
        scoreChange = currentQuestion.Marks + Math.floor(currentQuestion.Marks * timeBonus * 0.5);
      }

      // Update game state and host's data
      await update(gameRef, {
        [`questions.${currentQuestion.id}.correctOption`]: optionId,
        showScores: true,
        lastAnsweredQuestion: currentQuestion.id
      });

      await update(hostRef, {
        score: currentHostScore + scoreChange,
        answers: updatedAnswers,
        status: 'answered'
      });

      // Calculate and update scores for all players
      const players = activeGame.players;
      for (const playerId in players) {
        if (playerId === currentPlayer.player_id) continue; // Skip host

        const player = players[playerId];
        const playerAnswer = player.answers?.[activeGame.currentQuestionIndex];

        if (playerAnswer) {
          let playerScoreChange = 0;
          const isPlayerCorrect = playerAnswer.selectedOption === optionId;

          if (isPlayerCorrect) {
            const timeBonus = Math.max(0, (currentQuestion.timeLimit - playerAnswer.timeToAnswer) / currentQuestion.timeLimit);
            playerScoreChange = currentQuestion.Marks + Math.floor(currentQuestion.Marks * timeBonus * 0.5);
          } else if (activeGame.quiz.hasNegativeMarking) {
            playerScoreChange = -Math.floor(currentQuestion.Marks * activeGame.quiz.negativeMarkingValue / 100);
          }

          // Update player's score and answer correctness
          const playerRef = ref(database, `games/${activeGame.id}/players/${playerId}`);
          await update(playerRef, {
            score: player.score + playerScoreChange,
            [`answers.${activeGame.currentQuestionIndex}.correct`]: isPlayerCorrect
          });
        }
      }
    } catch (error) {
      console.error('Error setting correct answer:', error);
    }
  }, [activeGame, currentQuestion, currentPlayer]);

  return {
    startGame,
    endGame,
    submitAnswer,
    nextQuestion,
    setCorrectAnswer,
    deductPlayerScore,
    removePlayer
  };
};
