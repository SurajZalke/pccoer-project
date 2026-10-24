import { v4 as uuidv4 } from 'uuid';
import { getDatabase, ref, get, update } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';

function generateShortUuid(): string {
  return uuidv4().substring(0, 8);
}

// Percentile rank — score-based linear scaling:
//   Top scorer(s) = 100. percentile = (score / maxScore) * 100
//   Students with 0 score get a minimum of 1 (not absolute 0) since they
//   still participated. Everyone else is proportional to max score.
function calculatePercentileRank(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 0;
  if (allScores.length === 1) return 100;

  const maxScore = Math.max(...allScores);
  if (maxScore === 0) return 1; // all scored 0 — everyone gets minimum
  if (score >= maxScore) return 100;
  if (score <= 0) return 1; // participated but scored 0

  return Number(((score / maxScore) * 100).toFixed(1));
}

export const saveSharedUrlGameHistory = async (
  quizId: string, 
  quizTitle: string, 
  createdBy: string, 
  nickname: string, 
  avatar: string, 
  score: number, 
  answers?: { optionId: string; correct: boolean }[], 
  percentile?: number, 
  totalQuestions?: number,
  isCBT: boolean = false
) => {
  const db = getDatabase(app);
  let currentPlayerId = localStorage.getItem(`quiz_player_id_${quizId}`);
  if (!currentPlayerId) {
    currentPlayerId = generateShortUuid();
  }

  try {
    // Get existing scores for this quiz
    const existingScores = await fetchAllQuizScores(quizId);
    const allScores = [...existingScores, score];
    
    // Calculate percentile using the new function
    const calculatedPercentile = calculatePercentileRank(score, allScores);

    // Calculate correct answers and accuracy
    const sanitizedAnswers = answers?.map(answer => ({
      optionId: answer.optionId || '',
      correct: Boolean(answer.correct)
    })).filter(answer => answer.optionId !== '') || [];

    // Calculate correct answers count properly
    const correctAnswersCount = answers?.filter(a => a.correct).length || 0;
    const actualTotalQuestions = totalQuestions || answers?.length || 0;
    const accuracy = actualTotalQuestions > 0 ? (correctAnswersCount / actualTotalQuestions) * 100 : 0;

    const playerData = {
      nickname: nickname || 'Anonymous',
      avatar: avatar || '',
      score: Number(score) || 0,
      joinedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      answers: sanitizedAnswers,
      percentile: calculatedPercentile,
      correctAnswersCount,
      totalQuestions: Number(totalQuestions) || 0,
      accuracy: Number(accuracy.toFixed(2))
    };

    // Update quiz details
    await update(ref(db, `sharedQuizResults/${quizId}`), {
      quizTitle: quizTitle || 'Untitled Quiz',
      createdBy,
      createdAt: new Date().toISOString(),
    });

    // Save sanitized player data
    await update(ref(db, `sharedQuizResults/${quizId}/players/${currentPlayerId}`), playerData);

    localStorage.setItem(`quiz_player_id_${quizId}`, currentPlayerId);
    localStorage.setItem(`quiz_nickname_${quizId}`, nickname);
    localStorage.setItem(`quiz_avatar_${quizId}`, avatar);

    return { success: true, playerId: currentPlayerId };
  } catch (error) {
    console.error('Error saving shared URL game history:', error);
    return { success: false, error };
  }
};

export const fetchAllQuizScores = async (quizId: string): Promise<number[]> => {
  const db = getDatabase(app);
  const playersRef = ref(db, `sharedQuizResults/${quizId}/players`);

  try {
    const snapshot = await get(playersRef);
    if (snapshot.exists()) {
      const playersData = snapshot.val();
      return Object.values(playersData).map((player: any) => player.score);
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error fetching all quiz scores:', error);
    return [];
  }
};